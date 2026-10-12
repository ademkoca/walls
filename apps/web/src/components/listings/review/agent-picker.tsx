'use client';

import type { UserReference, UserSummary } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { SearchIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api/users';
import { useErrorMessage } from '@/lib/use-error-message';

/** Shows the assigned agent and lets a reviewer assign another active agent or remove it. */
export function AgentPicker({
  agent,
  onAssign,
  busy,
}: {
  agent: UserReference | null;
  onAssign: (agentId: string | null) => void;
  busy: boolean;
}) {
  const t = useTranslations('review');
  const errorMessage = useErrorMessage();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      setResults((await usersApi.activeAgents(query.trim())).items);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <UserIcon className="size-4 text-muted-foreground" aria-hidden />
          {agent?.displayName ?? t('details.none')}
        </span>
        {agent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onAssign(null)}
          >
            <XIcon data-icon="inline-start" />
            {t('unassign')}
          </Button>
        )}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          {t('searchAgents')}
        </label>
        <Input
          id={searchId}
          value={query}
          placeholder={t('searchAgents')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="outline" size="icon" aria-label={t('searchAgents')}>
          {searching ? <Spinner /> : <SearchIcon />}
        </Button>
      </form>
      {results && results.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('noAgents')}</p>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y rounded-md border">
          {results.map((candidate) => (
            <li key={candidate.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium">{candidate.displayName}</span>
                <span className="block truncate text-muted-foreground">{candidate.email}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || candidate.id === agent?.id}
                onClick={() => {
                  onAssign(candidate.id);
                  setResults(null);
                  setQuery('');
                }}
              >
                {t('assign')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
