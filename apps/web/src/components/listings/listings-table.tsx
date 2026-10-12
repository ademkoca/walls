import type { ListingSummary } from '@walls/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@walls/ui/components/table';
import { ImageIcon } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ListingStatusBadge } from './listing-status-badge';

/** The editor's listings, newest change first. */
export async function ListingsTable({ listings }: { listings: ListingSummary[] }) {
  const t = await getTranslations('listings');
  const tEnums = await getTranslations('enums');
  const format = await getFormatter();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.listing')}</TableHead>
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('columns.images')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('columns.updated')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((listing) => {
            const details = [
              listing.propertyType && tEnums(`propertyType.${listing.propertyType}`),
              listing.transactionType && tEnums(`transactionType.${listing.transactionType}`),
              listing.city,
            ].filter(Boolean);
            return (
              <TableRow key={listing.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/listings/${listing.id}`}
                    className="flex items-center gap-3 rounded focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {listing.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.coverImageUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {listing.title ?? t('untitled')}
                      </span>
                      {details.length > 0 && (
                        <span className="block truncate text-sm text-muted-foreground">
                          {details.join(' · ')}
                        </span>
                      )}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <ListingStatusBadge status={listing.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {t('imageCount', { count: listing.imageCount })}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {format.dateTime(new Date(listing.updatedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
