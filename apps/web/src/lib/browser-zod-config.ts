import { z } from 'zod';

/**
 * Zod compiles validators with `new Function` when the browser allows it, and probes that by
 * trying. Under our Content Security Policy (no 'unsafe-eval') the probe fails harmlessly but
 * is reported as a policy violation, so the browser skips it (Zod's documented `jitless`).
 */
if (typeof window !== 'undefined') z.config({ jitless: true });
