import { GoogleSignInOutcome, enumValues } from '@walls/shared';
import { useTranslations } from 'next-intl';
import { FormAlert } from '../forms/form-alert';

/** Outcomes the page explains with its own message instead (e.g. the profile page). */
type ExplainedOutcome = Exclude<GoogleSignInOutcome, typeof GoogleSignInOutcome.REAUTHENTICATED>;

const OUTCOMES = new Set<string>(enumValues(GoogleSignInOutcome));

const isExplained = (value: string | null): value is ExplainedOutcome =>
  value !== null && OUTCOMES.has(value) && value !== GoogleSignInOutcome.REAUTHENTICATED;

/**
 * Explains how a "Continue with Google" round trip ended (`?google=<outcome>`, SPEC §3.1).
 * Unknown values show nothing.
 */
export function GoogleOutcomeAlert({ outcome }: { outcome: string | null }) {
  const t = useTranslations('auth.google.outcomes');
  if (!isExplained(outcome)) return null;
  return (
    <FormAlert tone={outcome === GoogleSignInOutcome.LINK_SENT ? 'success' : 'error'}>
      {t(outcome)}
    </FormAlert>
  );
}
