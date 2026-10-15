/**
 * Descriptions for the demo listings (`pnpm demo:seed`), written from each listing's facts so
 * keyword search finds what the listing actually has ("lift", "terasa", "Dunav", …).
 */
import {
  Amenity,
  FurnishedStatus,
  HeatingType,
  Locale,
  PropertyType,
  RentalPeriod,
  TransactionType,
} from '@walls/shared';
import type { DemoListing } from './demo-data';

type Words = Readonly<Record<Locale, string>>;

const HEATING: Readonly<Record<HeatingType, Words>> = {
  [HeatingType.DISTRICT]: { sr: 'Grejanje je centralno (CG).', en: 'District heating.' },
  [HeatingType.INDIVIDUAL_CENTRAL]: {
    sr: 'Grejanje je etažno (EG).',
    en: 'Individual central heating.',
  },
  [HeatingType.ELECTRIC]: { sr: 'Grejanje je na struju.', en: 'Electric heating.' },
  [HeatingType.GAS]: { sr: 'Grejanje je na gas.', en: 'Gas heating.' },
  [HeatingType.STORAGE_HEATERS]: { sr: 'Grejanje: TA peći.', en: 'Storage heaters.' },
  [HeatingType.UNDERFLOOR]: { sr: 'Grejanje je podno.', en: 'Underfloor heating.' },
  [HeatingType.HEAT_PUMP]: { sr: 'Grejanje: toplotna pumpa.', en: 'Heated by a heat pump.' },
  [HeatingType.SOLID_FUEL]: { sr: 'Grejanje je na čvrsto gorivo.', en: 'Solid-fuel heating.' },
  [HeatingType.OTHER]: { sr: 'Grejanje po dogovoru.', en: 'Other heating.' },
  [HeatingType.NONE]: { sr: 'Prostor nema grejanje.', en: 'No heating.' },
};

const FURNISHED: Readonly<Record<FurnishedStatus, Words>> = {
  [FurnishedStatus.FURNISHED]: { sr: 'Namešteno.', en: 'Furnished.' },
  [FurnishedStatus.SEMI_FURNISHED]: { sr: 'Polunamešteno.', en: 'Partly furnished.' },
  [FurnishedStatus.UNFURNISHED]: { sr: 'Nenamešteno.', en: 'Unfurnished.' },
};

const FEATURES: Readonly<Record<Amenity, Words>> = {
  [Amenity.ELEVATOR]: { sr: 'lift', en: 'lift' },
  [Amenity.AIR_CONDITIONING]: { sr: 'klima', en: 'air conditioning' },
  [Amenity.BALCONY]: { sr: 'balkon', en: 'balcony' },
  [Amenity.TERRACE]: { sr: 'terasa', en: 'terrace' },
  [Amenity.GARDEN]: { sr: 'dvorište', en: 'garden' },
  [Amenity.PARKING]: { sr: 'parking', en: 'parking' },
  [Amenity.GARAGE]: { sr: 'garaža', en: 'garage' },
  [Amenity.SECURITY_SYSTEM]: { sr: 'alarm i video nadzor', en: 'alarm and video surveillance' },
  [Amenity.INTERNET]: { sr: 'internet', en: 'internet' },
  [Amenity.PETS_ALLOWED]: { sr: 'dozvoljeni kućni ljubimci', en: 'pets allowed' },
  [Amenity.SMOKING_ALLOWED]: { sr: 'dozvoljeno pušenje', en: 'smoking allowed' },
  [Amenity.ELECTRICITY]: { sr: 'struja', en: 'electricity' },
  [Amenity.WATER]: { sr: 'voda', en: 'water' },
  [Amenity.SEWAGE]: { sr: 'kanalizacija', en: 'sewerage' },
  [Amenity.GAS_CONNECTION]: { sr: 'gasni priključak', en: 'gas connection' },
  [Amenity.ROAD_ACCESS]: { sr: 'asfaltni prilaz', en: 'paved road access' },
  [Amenity.BUILDING_PERMIT]: { sr: 'građevinska dozvola', en: 'building permit' },
};

const SR_NUMBERS = ['nula', 'jedna', 'dve', 'tri', 'četiri'];
const SR_NUMBERS_NEUTER = ['nula', 'jedno', 'dva', 'tri', 'četiri'];
const EN_NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

const enCount = (n: number, noun: string) =>
  `${EN_NUMBERS[n] ?? String(n)} ${noun}${n === 1 ? '' : 's'}`;

function srBedrooms(n: number): string {
  if (n === 1) return 'jednu spavaću sobu';
  return n <= 4 ? `${SR_NUMBERS[n]} spavaće sobe` : `${n} spavaćih soba`;
}

function srBathrooms(n: number): string {
  if (n === 1) return 'jedno kupatilo';
  return n <= 4 ? `${SR_NUMBERS_NEUTER[n]} kupatila` : `${n} kupatila`;
}

/** "1 sprat", "3 sprata", "6 spratova". */
function srStoreys(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return `${n} sprat`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} sprata`;
  return `${n} spratova`;
}

function srFloor(floor: number): string {
  if (floor === 0) return 'u prizemlju';
  return floor > 0 ? `na ${floor}. spratu` : `na ${-floor}. podzemnom nivou`;
}

function enOrdinal(n: number): string {
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? 'st'
      : n % 10 === 2 && n % 100 !== 12
        ? 'nd'
        : n % 10 === 3 && n % 100 !== 13
          ? 'rd'
          : 'th';
  return `${n}${suffix}`;
}

function enFloor(floor: number): string {
  if (floor === 0) return 'on the ground floor';
  return floor > 0 ? `on the ${enOrdinal(floor)} floor` : `on basement level ${-floor}`;
}

/** "P+1" for two storeys; "prizemna" for one. */
const srHouseStoreys = (n: number) => (n <= 1 ? 'prizemna' : `P+${n - 1}`);

function srPlot(m2: number): string {
  return m2 >= 10000 ? `${(m2 / 10000).toLocaleString('sr-Latn')} ha` : `${m2 / 100} ari`;
}

function enPlot(m2: number): string {
  return m2 >= 10000
    ? `${(m2 / 10000).toLocaleString('en-GB')} ha`
    : `${m2.toLocaleString('en-GB')} m²`;
}

const m2 = (value: number, locale: Locale) =>
  `${value.toLocaleString(locale === Locale.SR ? 'sr-Latn' : 'en-GB')} m²`;

/** The facts paragraph: size, floor, rooms, year. */
function facts(listing: DemoListing, locale: Locale): string {
  const sr = locale === Locale.SR;
  const { area = 0, plot = 0, beds = 0, baths = 0, floor = 0, floors = 1, year, parking } = listing;
  const built = year ? (sr ? ` Izgrađeno ${year}. godine.` : ` Built in ${year}.`) : '';
  const parkingSpaces =
    parking && parking > 1
      ? sr
        ? ` Uz objekat ide ${parking} parking mesta.`
        : ` Comes with ${parking} parking spaces.`
      : '';

  switch (listing.type) {
    case PropertyType.APARTMENT: {
      const layout =
        beds === 0
          ? sr
            ? 'Garsonjera ima jedan prostor sa kuhinjom i jedno kupatilo.'
            : 'The studio has one open-plan room with a kitchenette and one bathroom.'
          : sr
            ? `Raspored: dnevna soba sa kuhinjom i trpezarijom, ${srBedrooms(beds)} i ${srBathrooms(baths)}.`
            : `Layout: a living room with kitchen and dining area, ${enCount(beds, 'bedroom')} and ${enCount(baths, 'bathroom')}.`;
      return sr
        ? `Stan ima ${m2(area, locale)} i nalazi se ${srFloor(floor)} zgrade koja ima ${srStoreys(floors)}. ${layout}${built}`
        : `The flat has ${m2(area, locale)} and is ${enFloor(floor)} in a building with ${enCount(floors, 'floor')}. ${layout}${built}`;
    }
    case PropertyType.HOUSE:
    case PropertyType.VILLA: {
      const noun =
        listing.type === PropertyType.HOUSE
          ? sr
            ? 'Kuća'
            : 'The house'
          : sr
            ? 'Vila'
            : 'The villa';
      return sr
        ? `${noun} ima ${m2(area, locale)} na placu od ${srPlot(plot)}, spratnost ${srHouseStoreys(floors)}. Ima ${srBedrooms(beds)} i ${srBathrooms(baths)}.${built}${parkingSpaces}`
        : `${noun} has ${m2(area, locale)} on a ${enPlot(plot)} plot, over ${enCount(floors, 'storey')}. It has ${enCount(beds, 'bedroom')} and ${enCount(baths, 'bathroom')}.${built}${parkingSpaces}`;
    }
    case PropertyType.OTHER:
      return sr
        ? `Objekat ima ${m2(area, locale)} na placu od ${srPlot(plot)}, spratnost ${srHouseStoreys(floors)}, sa ${beds} soba i ${baths} kupatila.${built}${parkingSpaces}`
        : `The building has ${m2(area, locale)} on a ${enPlot(plot)} plot, over ${enCount(floors, 'storey')}, with ${beds} rooms and ${baths} bathrooms.${built}${parkingSpaces}`;
    case PropertyType.OFFICE:
    case PropertyType.RETAIL: {
      const noun =
        listing.type === PropertyType.OFFICE
          ? sr
            ? 'Kancelarijski prostor'
            : 'The office'
          : sr
            ? 'Lokal'
            : 'The shop';
      return sr
        ? `${noun} ima ${m2(area, locale)} i nalazi se ${srFloor(floor)} zgrade koja ima ${srStoreys(floors)}.${built}${parkingSpaces}`
        : `${noun} has ${m2(area, locale)} and is ${enFloor(floor)} in a building with ${enCount(floors, 'floor')}.${built}${parkingSpaces}`;
    }
    case PropertyType.WAREHOUSE:
      return sr
        ? `Hala ima ${m2(area, locale)} na placu od ${srPlot(plot)}.${built}${parkingSpaces}`
        : `The building has ${m2(area, locale)} on a ${enPlot(plot)} plot.${built}${parkingSpaces}`;
    case PropertyType.LAND:
      return sr ? `Površina placa je ${srPlot(plot)}.` : `The plot measures ${enPlot(plot)}.`;
    case PropertyType.GARAGE:
      return sr
        ? `Garažno mesto ima ${m2(area, locale)} i nalazi se ${srFloor(floor)}.`
        : `The space has ${m2(area, locale)} and is ${enFloor(floor)}.`;
  }
}

function equipment(listing: DemoListing, locale: Locale): string {
  const sr = locale === Locale.SR;
  const parts: string[] = [];
  if (listing.heating) parts.push(HEATING[listing.heating][locale]);
  if (listing.furnished) parts.push(FURNISHED[listing.furnished][locale]);
  if (listing.features.length > 0) {
    const list = listing.features.map((feature) => FEATURES[feature][locale]).join(', ');
    const label =
      listing.type === PropertyType.LAND
        ? sr
          ? 'Priključci i dozvole'
          : 'Utilities and permits'
        : sr
          ? 'Dodatno'
          : 'Also';
    parts.push(`${label}: ${list}.`);
  }
  return parts.join(' ');
}

function closing(listing: DemoListing, locale: Locale): string {
  const sr = locale === Locale.SR;
  const contact = sr
    ? 'Za razgledanje i dodatne informacije pošaljite upit.'
    : 'Send an inquiry to arrange a viewing or for more details.';
  if (listing.deal === TransactionType.SALE) {
    return `${sr ? 'Uknjiženo, bez tereta.' : 'Registered title, no encumbrances.'} ${contact}`;
  }
  const shortStay =
    listing.price?.period === RentalPeriod.DAY || listing.price?.period === RentalPeriod.WEEK;
  const terms = shortStay
    ? sr
      ? 'Cena uključuje komunalije i internet.'
      : 'Utilities and internet are included.'
    : sr
      ? 'Dostupno odmah, depozit u visini jedne kirije.'
      : 'Available now; one month’s deposit.';
  return `${terms} ${contact}`;
}

/** The description in `locale`, or null when the listing has no text in that language. */
export function demoDescription(listing: DemoListing, locale: Locale): string | null {
  const intro = locale === Locale.SR ? listing.intro[0] : listing.intro[1];
  if (!intro) return null;
  return [intro, facts(listing, locale), equipment(listing, locale), closing(listing, locale)]
    .filter(Boolean)
    .join('\n\n');
}
