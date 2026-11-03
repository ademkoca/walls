import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { fakeAuthorizationCode } from './fake-identity-provider';

const FORM_BODY_LIMIT = '10kb';

const screenQuerySchema = z.object({
  redirect_uri: z.string(),
  state: z.string(),
  nonce: z.string(),
  code_challenge: z.string(),
});

const screenFormSchema = screenQuerySchema.extend({
  action: z.enum(['continue', 'cancel']),
  email: z.string().trim().default(''),
  name: z.string().trim().default(''),
  hostedDomain: z.string().trim().default(''),
  emailVerified: z.literal('on').optional(),
});

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

const hidden = (name: string, value: string) =>
  `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

function screenHtml(query: z.infer<typeof screenQuerySchema>): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fake Google sign-in</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem">
<h1>Fake Google sign-in</h1>
<p>Development and tests only (GOOGLE_SIGN_IN_FAKE=on). Make up the Google account to continue with.</p>
<form method="post" style="display: grid; gap: 0.75rem">
${hidden('redirect_uri', query.redirect_uri)}${hidden('state', query.state)}${hidden('nonce', query.nonce)}${hidden('code_challenge', query.code_challenge)}
<label>Email <input name="email" type="email" required style="width: 100%"></label>
<label>Name <input name="name" style="width: 100%"></label>
<label>Google Workspace domain (optional) <input name="hostedDomain" style="width: 100%"></label>
<label><input name="emailVerified" type="checkbox" checked> Google has verified this email</label>
<div style="display: flex; gap: 0.5rem">
<button name="action" value="continue">Continue</button>
<button name="action" value="cancel" formnovalidate>Cancel</button>
</div>
</form>
</body>
</html>`;
}

/**
 * The fake Google sign-in screen (development and tests; see FakeIdentityProvider). It only
 * returns to the API's own callback address, so it cannot redirect anywhere else.
 */
export function fakeGoogleScreenRoutes(redirectUri: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query = screenQuerySchema.parse(req.query);
    if (query.redirect_uri !== redirectUri) {
      res.status(400).send('Unexpected redirect_uri');
      return;
    }
    // Helmet's "no-referrer" would make the browser send `Origin: null` with the form, which
    // the CSRF check refuses.
    res.set('Referrer-Policy', 'same-origin').type('html').send(screenHtml(query));
  });

  router.post('/', express.urlencoded({ extended: false, limit: FORM_BODY_LIMIT }), (req, res) => {
    const form = screenFormSchema.parse(req.body);
    if (form.redirect_uri !== redirectUri) {
      res.status(400).send('Unexpected redirect_uri');
      return;
    }
    const target = new URL(redirectUri);
    target.searchParams.set('state', form.state);
    if (form.action === 'cancel' || !form.email) {
      target.searchParams.set('error', 'access_denied');
    } else {
      const code = fakeAuthorizationCode(
        {
          // The same made-up address is the same Google account every time.
          subject: `fake-${createHash('sha256').update(form.email.toLowerCase()).digest('hex').slice(0, 24)}`,
          email: form.email,
          emailVerified: form.emailVerified === 'on',
          hostedDomain: form.hostedDomain || null,
          name: form.name || null,
          picture: null,
        },
        form.nonce,
        form.code_challenge,
      );
      target.searchParams.set('code', code);
    }
    res.redirect(target.toString());
  });

  return router;
}
