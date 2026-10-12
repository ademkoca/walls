import { describe, expect, it } from 'vitest';
import { isAutomatedClient, visitorHash } from './listing-views';

const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('listing view counting (decision, Phase 9)', () => {
  it('tells browsers from crawlers and scripts', () => {
    expect(isAutomatedClient(SAFARI)).toBe(false);
    for (const agent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'facebookexternalhit/1.1',
      'curl/8.7.1',
      '',
    ]) {
      expect(isAutomatedClient(agent), agent).toBe(true);
    }
  });

  it('fingerprints a visitor per day without revealing the IP address', () => {
    const today = visitorHash('secret', '2026-10-13', '203.0.113.7', SAFARI);
    expect(visitorHash('secret', '2026-10-13', '203.0.113.7', SAFARI)).toBe(today);
    expect(visitorHash('secret', '2026-10-14', '203.0.113.7', SAFARI)).not.toBe(today);
    expect(visitorHash('secret', '2026-10-13', '203.0.113.8', SAFARI)).not.toBe(today);
    expect(visitorHash('other', '2026-10-13', '203.0.113.7', SAFARI)).not.toBe(today);
    expect(today).not.toContain('203');
  });
});
