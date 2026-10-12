import { Avatar, AvatarFallback, AvatarImage } from '@walls/ui/components/avatar';
import { cn } from '@walls/ui/lib/utils';
import { initials } from '@/lib/initials';

/** A profile picture, or the person's initials when there is none. */
export function ProfileAvatar({
  name,
  url,
  alt,
  className,
}: {
  name: string;
  url: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-24 text-2xl', className)}>
      {url && <AvatarImage src={url} alt={alt} className="object-cover" />}
      <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
