import { PropertyType, type PublicHome } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PlanSelectionProvider, RoomLink } from './plan-selection';

/** The plan's rooms: the property types most visitors look for. */
const ROOMS = [
  PropertyType.APARTMENT,
  PropertyType.HOUSE,
  PropertyType.LAND,
  PropertyType.RETAIL,
] as const;

/** The plan's smaller rooms, in a row across the plan above the hallway: every other type. */
const CLOSETS = [
  PropertyType.VILLA,
  PropertyType.OFFICE,
  PropertyType.WAREHOUSE,
  PropertyType.GARAGE,
  PropertyType.OTHER,
] as const;

/**
 * Where each room's door is: always in an interior wall. The first room's left wall is the
 * living room's partition only when the plan is two columns wide, so that door shows from lg up.
 */
const DOORS = ['left-lg', 'left', 'top', 'top'] as const;
type DoorPlace = (typeof DOORS)[number];

/** Rotates the leaf about its hinge (the corner of the 44 × 44 box). */
const HINGE_STYLE = { transformBox: 'view-box', transformOrigin: '0 44px' } as const;
const TOP_HINGE_STYLE = { transformBox: 'view-box', transformOrigin: '0 0' } as const;

/**
 * A door in a plan: an opening cut into the room's wall, the leaf standing open into the room
 * and the arc it swings along, as plans draw them. When the room is hovered or focused the door
 * swings in from closed while its arc is drawn in green; the room chosen in the hallway search
 * keeps a green arc. Decorative; the room's link carries the meaning.
 */
function Door({ className, wall }: { className?: string; wall: 'left' | 'top' }) {
  const swing =
    'group-hover:[animation:plan-door-swing_220ms_ease-out] group-focus-visible:[animation:plan-door-swing_220ms_ease-out] motion-reduce:!animate-none';
  const draw =
    'group-hover:[animation:plan-door-arc_220ms_ease-out] group-focus-visible:[animation:plan-door-arc_220ms_ease-out] motion-reduce:!animate-none';
  const green =
    'transition-colors duration-150 group-hover:stroke-primary group-focus-visible:stroke-primary group-data-selected:stroke-primary';
  return (
    <span aria-hidden className={cn('pointer-events-none absolute size-11', className)}>
      {/* The opening: paper laid over the wall line. */}
      <span
        className={cn(
          'absolute bg-background',
          wall === 'left' ? 'top-0 -left-1 h-full w-1' : '-top-1 left-0 h-1 w-full',
        )}
      />
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full overflow-visible">
        {/* The arc starts at the closed position and ends at the open leaf. */}
        <path
          d={wall === 'left' ? 'M0 0A44 44 0 0 1 44 44' : 'M44 0A44 44 0 0 1 0 44'}
          pathLength={1}
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="1"
          className={cn('stroke-muted-foreground', green, draw)}
        />
        <path
          d={wall === 'left' ? 'M0 44H44' : 'M0 0V44'}
          strokeWidth="2.5"
          style={wall === 'left' ? HINGE_STYLE : TOP_HINGE_STYLE}
          className={cn('stroke-foreground', swing)}
        />
      </svg>
    </span>
  );
}

/**
 * A dimension line over the plan, labelled with the platform's totals as measurements:
 * published listings, the cities they are in, and professional advertisers. Zero counts are
 * left out, and an API that sends no totals leaves the line unlabelled.
 */
async function DimensionLine({ stats }: { stats: PublicHome['stats'] | undefined }) {
  const [t, format] = await Promise.all([getTranslations('home.stats'), getFormatter()]);
  const parts = stats
    ? (['listings', 'cities', 'partners'] as const)
        .filter((key) => stats[key] > 0)
        .map((key) => `${format.number(stats[key])} ${t(key, { count: stats[key] })}`)
    : [];
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span aria-hidden className="h-3 w-px shrink-0 bg-current" />
      <span aria-hidden className="h-px min-w-6 flex-1 bg-current" />
      {parts.length > 0 && (
        // Phones show the listings count only, so the line keeps reading as one dimension.
        <p className="shrink-0 font-mono text-xs whitespace-nowrap tabular-nums">
          {parts.map((part, index) => (
            <span key={part} className={cn(index > 0 && 'hidden sm:inline')}>
              {index > 0 && ' · '}
              {part}
            </span>
          ))}
        </p>
      )}
      <span aria-hidden className="h-px min-w-6 flex-1 bg-current" />
      <span aria-hidden className="h-3 w-px shrink-0 bg-current" />
    </div>
  );
}

const roomFloor =
  'relative bg-background transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent focus-visible:outline-none data-selected:bg-accent';
const roomLabel =
  'text-xs font-bold tracking-[0.12em] uppercase transition-colors duration-150 group-data-selected:text-primary';

/** One room of the plan: a property type, with the number of its public listings. */
async function Room({
  type,
  count,
  door,
}: {
  type: PropertyType;
  count: number | undefined;
  door: DoorPlace;
}) {
  const [t, tEnums, format] = await Promise.all([
    getTranslations('home'),
    getTranslations('enums'),
    getFormatter(),
  ]);
  return (
    <RoomLink
      type={type}
      className={cn(
        roomFloor,
        'flex min-h-40 flex-col justify-between gap-6 p-5 sm:p-6 lg:min-h-44',
      )}
    >
      <Door
        wall={door === 'top' ? 'top' : 'left'}
        className={cn(
          door === 'top' ? 'top-0 right-6' : 'top-12 left-0',
          door === 'left-lg' && 'hidden lg:block',
        )}
      />
      <span className={cn(roomLabel, door === 'top' && 'pr-14')}>
        {tEnums(`propertyType.${type}`)}
      </span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-3xl font-medium tabular-nums">
          {format.number(count)}
          <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
            {' '}
            {t('roomListings', { count })}
          </span>
        </span>
      )}
    </RoomLink>
  );
}

/** A small room: a less common property type, with its count. */
async function Closet({ type, count }: { type: PropertyType; count: number | undefined }) {
  const [t, tEnums, format] = await Promise.all([
    getTranslations('home'),
    getTranslations('enums'),
    getFormatter(),
  ]);
  return (
    <RoomLink
      type={type}
      className={cn(roomFloor, 'flex min-h-20 flex-col justify-between gap-2 p-3 sm:p-4')}
    >
      <span className={cn(roomLabel, 'text-[0.68rem] tracking-[0.1em]')}>
        {tEnums(`propertyType.${type}`)}
      </span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-lg font-medium tabular-nums">
          {format.number(count)}
          <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
            {' '}
            {t('roomListings', { count })}
          </span>
        </span>
      )}
    </RoomLink>
  );
}

/**
 * The home page's first screen (SPEC §16), drawn as an apartment plan: the living room holds
 * the headline, four rooms and five smaller ones lead into the search by property type, and
 * the hallway along the bottom wall holds the search itself. Ink walls are the grid's gaps
 * showing through.
 */
export async function FloorPlan({
  stats,
  intro,
  hallway,
}: {
  stats: PublicHome['stats'] | undefined;
  intro: React.ReactNode;
  hallway: React.ReactNode;
}) {
  const t = await getTranslations('home');
  return (
    <PlanSelectionProvider>
      <div className="space-y-3">
        <DimensionLine stats={stats} />
        <div className="relative border-4 border-foreground bg-foreground sm:border-8">
          <div className="grid gap-1 [grid-template-areas:'living''hall''rooms''closets'] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:[grid-template-areas:'living_rooms''closets_closets''hall_hall']">
            <div className="bg-background p-6 [grid-area:living] sm:p-10 lg:p-12">{intro}</div>
            <nav aria-label={t('browseByTypeTitle')} className="contents">
              <ul className="grid grid-cols-2 gap-1 [grid-area:rooms]">
                {ROOMS.map((type, index) => (
                  <li key={type} className="grid">
                    <Room
                      type={type}
                      count={stats?.byPropertyType?.[type]}
                      door={DOORS[index] ?? 'top'}
                    />
                  </li>
                ))}
              </ul>
              <ul className="grid grid-cols-2 gap-1 [grid-area:closets] sm:grid-cols-5">
                {CLOSETS.map((type, index) => (
                  <li
                    key={type}
                    className={cn(
                      'grid',
                      index === CLOSETS.length - 1 && 'col-span-2 sm:col-span-1',
                    )}
                  >
                    <Closet type={type} count={stats?.byPropertyType?.[type]} />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="bg-background p-4 [grid-area:hall] sm:p-6">{hallway}</div>
          </div>
          {/* The entrance: an opening in the bottom wall with the green front door. */}
          <span
            aria-hidden
            className="absolute -bottom-1 left-[58%] hidden h-1 w-14 bg-background sm:-bottom-2 sm:block sm:h-2"
          />
          <svg
            aria-hidden
            viewBox="0 0 56 56"
            className="absolute top-full left-[58%] mt-0.5 hidden size-14 overflow-visible sm:mt-0 sm:block"
          >
            <path
              d="M0 0A56 56 0 0 0 56 56"
              fill="none"
              strokeWidth="1.5"
              className="stroke-primary"
            />
            <path d="M56 0V56" strokeWidth="3" className="stroke-primary" />
          </svg>
        </div>
      </div>
    </PlanSelectionProvider>
  );
}
