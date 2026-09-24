# Zoom integration

Coaches connect **their own** Zoom account. When a coach schedules a meeting in iCoach, the server
creates a real Zoom meeting on that account and stores its join link on the meeting. Coaches get a
**Start** button, athletes a **Join** button; both open Zoom in a new tab (nothing is embedded).
Editing or cancelling the meeting in iCoach updates or deletes it in Zoom. Free Zoom accounts work
(free-plan meetings with other people end after 40 minutes).

## 1. Zoom app setup (Zoom App Marketplace)

1. **Develop → Build App → General App**, managed by **User**. Name: iCoach.
2. **Development vs Production** (the switch at the top of every app page). Each side has its own
   Client ID/Secret, redirect URLs and event subscriptions. Keep them paired:
   - **Development** credentials only work for users on your own Zoom account, but need no
     review. Use them locally and for your first deployment.
   - **Production** credentials are for other coaches' Zoom accounts. They need the Production
     redirect/webhook set **and** the app published through Zoom's review (see
     `zoom-marketplace-review-draft.md`).

   Putting one side's Client ID in `.env` while its redirect URL is registered only on the other
   side causes "Invalid redirect (4,700)".
3. **Basic Information → OAuth Information** (on the side you use):
   - **OAuth Redirect URL**: the exact value of `ZOOM_REDIRECT_URI`.
   - **OAuth Allow List**: add the same URL.
   - Exact match: same scheme, host, port and path, **no trailing slash**.
   - **It must be HTTPS.** Zoom answers `http://localhost:8080/...` with "Invalid redirect
     (4,700)" even when it is registered (tested September 2026, including with Zoom's own
     generated authorization URL).

   | Environment | Redirect URL |
   | --- | --- |
   | Local | An HTTPS tunnel to port 8080, e.g. `cloudflared tunnel --url http://localhost:8080` → `https://<random>.trycloudflare.com/api/zoom/callback`. Open iCoach through that same tunnel address, because the callback returns you to the site in `ZOOM_REDIRECT_URI`. |
   | Production | `https://<your-domain>/api/zoom/callback` |

   Free quick-tunnel addresses change on every restart and can expire. Re-register the new
   address in the Zoom app and `.env`, or use a tunnel with a fixed name.

4. **Scopes**: only these. Check that `user:read:user` is there; without it, Connect fails at `GET /users/me`.

   | Scope | Why |
   | --- | --- |
   | `meeting:write:meeting` | Create the Zoom meeting when a coach schedules one |
   | `meeting:update:meeting` | Apply edits (title, time, duration, notes) |
   | `meeting:delete:meeting` | Delete it when the coach cancels |
   | `meeting:read:meeting` | Fetch a fresh host start link on demand |
   | `user:read:user` | Identify the connected Zoom user (id, email) |

5. **Features → Access**
   - Turn on **Event Subscription** → **Add New Event Subscription** → Method **Webhook**.
   - Endpoint URL: `https://<your-domain>/api/zoom/webhook` (locally, the tunnel address). It
     must be public HTTPS and reachable when you save; otherwise Zoom says "Invalid URL".
   - **Add Events** → Meeting: **Start Meeting**, **End Meeting**, **Meeting has been deleted**.
   - **Save**: Zoom validates the URL on save, and iCoach answers the challenge automatically.
   - The **Secret Token** at the top of the page goes in `ZOOM_WEBHOOK_SECRET_TOKEN`. It is shared
     by Development and Production.
   - There is no "App deauthorized" event to select. Zoom sends `app_deauthorized` on its own,
     and only once the app is published; iCoach already handles it.
6. Don't use Zoom's "Add app" / Local Test install button to connect. Coaches connect from
   **iCoach → Settings → Integrations → Connect Zoom**. An install that starts on Zoom's side carries
   no `state`, so iCoach can't know which coach it belongs to. It shows "click Connect Zoom"
   instead of accepting it, because accepting it would allow OAuth CSRF.

## 2. Environment variables (server-only; never `VITE_`)

| Variable | Value |
| --- | --- |
| `ZOOM_CLIENT_ID` | App Credentials → Client ID |
| `ZOOM_CLIENT_SECRET` | App Credentials → Client Secret |
| `ZOOM_REDIRECT_URI` | `https://<tunnel>/api/zoom/callback` locally, `https://<your-domain>/api/zoom/callback` in production |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Event Subscription → Secret Token |
| `ZOOM_TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

The integration also uses `SUPABASE_SECRET_KEY` and the two `VITE_SUPABASE_*` variables. If any
Zoom variable is missing, Settings → Integrations shows "Zoom isn't set up on this server" and
the Connect button is disabled.

Use the same `ZOOM_TOKEN_ENCRYPTION_KEY` in every environment that shares a database. If it
changes, stored tokens can't be decrypted: each affected coach is asked to reconnect once (the
connection is dropped automatically, nothing breaks permanently).

## 3. Deploying on Vercel

- `vercel.json` already builds with `NITRO_PRESET=vercel`. The app and `/api/zoom/*` run in one
  Node.js serverless function, and no rewrites or CORS settings are needed: the browser only calls
  its own origin, and Zoom calls the webhook server-to-server.
- In Project → Settings → Environment Variables, add the variables from `.env.example` except
  `SUPABASE_DB_URL`, with `ZOOM_REDIRECT_URI` set to your production URL. The `VITE_*` ones are
  baked in at build time, so redeploy after changing them.
- Register the production redirect URL and webhook URL in the Zoom app (section 1), on the
  same Development/Production side as the credentials you put in Vercel.
- **Preview deployments** get a different URL on every deploy. Zoom only redirects to registered
  URLs, so Connect Zoom works only on the domain in `ZOOM_REDIRECT_URI`.
- **Custom domain later:** change `ZOOM_REDIRECT_URI`, add the new redirect URL to the Zoom app,
  and update the webhook URL. The code doesn't hard-code any domain.

## 4. How it works

```
Coach: Settings → Connect Zoom
  → startZoomConnect (server fn)    verifies the coach, stores a one-time state + PKCE verifier
  → zoom.us/oauth/authorize          coach approves
  → GET /api/zoom/callback           consumes state (single use, 10 min), exchanges the code,
                                     GET /users/me, stores encrypted tokens
  → /coach/settings?zoom=connected
```

| Piece | File |
| --- | --- |
| Server functions (status, connect, disconnect, schedule, edit, cancel, start) | `src/lib/zoom.functions.ts` |
| OAuth callback | `src/routes/api.zoom.callback.ts` |
| Webhook receiver | `src/routes/api.zoom.webhook.ts` |
| Zoom REST/OAuth client and error codes | `src/lib/server/zoom/api.ts` |
| Token storage, refresh, retry | `src/lib/server/zoom/tokens.ts` |
| Token encryption (AES-256-GCM) | `src/lib/server/zoom/crypto.ts` |
| Signature check, URL-validation answer | `src/lib/server/zoom/webhook.ts` |
| Webhook event handling | `src/lib/server/zoom/events.ts` |
| Schema | `supabase/migrations/0011_zoom_integration.sql` |

- **Meetings.** Scheduling creates the Zoom meeting first (`POST /users/me/meetings`, type 2),
  then saves the row. If the save fails, the Zoom meeting is deleted again. Edit sends `PATCH`; if
  the meeting was deleted on Zoom's side, a new one is created. Cancel sends `DELETE`, marks the
  session cancelled and clears its links. Start fetches `start_url` fresh (`GET /meetings/{id}`)
  every time: it embeds a host token and expires after about 2 hours, so it is never stored.
- **Tokens.** Access tokens last an hour. They are refreshed a minute before expiry, and every
  refresh saves the new (rotated) refresh token with a compare-and-swap, so two concurrent
  refreshes can't overwrite each other. A 401 from Zoom triggers one forced refresh and retry.
  A refresh token Zoom rejects means access was revoked: the connection is deleted and the coach
  is asked to reconnect.
- **Webhooks.** Checks the `x-zm-signature` HMAC over the raw body with a constant-time compare.
  Requests older than 5 minutes are rejected. Meeting events only touch meetings whose Zoom id
  matches and whose coach is connected as that host.
  - `meeting.started` sets `zoom_started_at` (UI shows LIVE NOW).
  - `meeting.ended` completes a still-scheduled meeting.
  - `meeting.deleted` clears the links.
  - `app_deauthorized` deletes the stored tokens.
- **Errors** reach the UI as stable codes and are translated: `ZOOM_NOT_CONNECTED`,
  `ZOOM_REVOKED`, `ZOOM_RATE_LIMITED`, `ZOOM_NOT_FOUND`, `ZOOM_REQUEST_FAILED`,
  `ZOOM_NOT_CONFIGURED`. Tokens and Zoom response bodies are never logged.

## 5. Security

- Secrets and tokens exist only on the server. The browser gets connection status (connected +
  Zoom email) and never a token. The client bundle is checked to contain no Zoom secret or
  token code.
- `zoom_connections` and `zoom_oauth_states` have RLS with no policies and no grants to `anon` or
  `authenticated`: only the service role can reach them.
- Every server function re-verifies the caller's Supabase session and coach role. Meeting writes
  go through the coach's own RLS-scoped client, and scheduling checks that the athlete is linked
  to that coach.
- OAuth uses a single-use `state` (CSRF) and PKCE (S256).

## 6. Tests

`npm test` runs the unit tests with Zoom mocked (`src/lib/server/zoom/*.test.ts`):

- token encryption
- the OAuth and meeting API calls, and Zoom error mapping
- token refresh: expiry, rotation, revocation, concurrent refresh, retry on 401, changed key
- webhook signature and replay checks, the URL-validation answer, and each event
