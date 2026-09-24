# Zoom Marketplace review: draft material (not submitted)

Drafts for publishing the iCoach Zoom app. Review and adapt every section before submitting,
especially the legal text. Replace `<your-domain>`, `<support email>` and the test-account
placeholders.

---

## 1. Privacy policy: text to add

> **Zoom integration**
>
> If you are a coach and choose to connect your Zoom account, iCoach receives from Zoom:
> - your Zoom user ID and account ID
> - the email address of your Zoom account
> - OAuth access and refresh tokens that let iCoach act on your behalf, limited to the
>   permissions you approved
>
> iCoach uses this access only to create, update and delete the Zoom meetings you schedule in
> iCoach, and to get the link that starts them. For each meeting we store its Zoom meeting ID,
> join link and passcode, and whether Zoom reports that it started or ended.
>
> - We do not access your recordings, contacts, chats or any other meetings.
> - We do not sell or share this data with third parties.
> - We do not use it for advertising.
> - Tokens are encrypted at rest and are never visible to you, your athletes, or other users.
>
> Your athletes see only the join link and passcode for meetings you schedule with them.
>
> **Removing access.** You can disconnect Zoom at any time in iCoach under Settings → Integrations,
> or remove the iCoach app from your Zoom account (App Marketplace → Manage → Added Apps). When you
> do, we delete your stored Zoom tokens immediately. Meetings already created stay in your Zoom
> account until you delete them there. To delete all your iCoach data, contact `<support email>`.

## 2. Terms of use: text to add

> **Third-party services: Zoom.** iCoach can create Zoom meetings on the Zoom account you connect.
> Your use of Zoom is governed by Zoom's own terms and plan limits (for example, the 40-minute limit
> on meetings with other people on free Zoom plans). iCoach is not responsible for Zoom's
> availability. You are responsible for the meetings created on your Zoom account.

## 3. Public documentation page (needs a public URL, e.g. `https://<your-domain>/help/zoom`)

**Using Zoom with iCoach**

- **Connect.** In iCoach, go to Settings → Integrations → **Connect Zoom**. Sign in to Zoom and
  approve the requested permissions. You'll return to iCoach showing "Connected as
  <your Zoom email>". Free Zoom accounts are supported.
- **Schedule.** Go to Meetings → **Schedule meeting**. Choose the athlete, title, date and time,
  duration and notes. iCoach creates the Zoom meeting on your account automatically.
- **Start and join.** You click **Start meeting** to open Zoom as host. Your athlete sees **Join
  Zoom meeting** and the passcode in their iCoach calendar.
- **Edit or cancel.** Open the meeting in iCoach → **Edit** or **Cancel meeting**. Zoom is updated
  automatically.
- **Disconnect.** Settings → Integrations → **Disconnect**. This revokes iCoach's access and
  deletes the stored tokens. You can also remove the app in Zoom (App Marketplace → Manage →
  Added Apps), which has the same effect.
- **Data.** See the Zoom section of our privacy policy. To request deletion of all data, contact
  `<support email>`.

## 4. Reviewer test steps

Provide one coach account and one athlete account that already belong together:

- Coach: `<coach test email>` / `<password>`
- Athlete: `<athlete test email>` / `<password>`

1. Open `https://<your-domain>/sign-in?as=coach` and sign in as the coach.
2. Settings → Integrations → **Connect Zoom**. Approve with your Zoom test account. Expect
   "Zoom connected" and "Connected as <email>".
3. Meetings → **Schedule meeting**: pick the athlete, a title, a time about 10 minutes ahead,
   30 minutes. Expect the meeting in the list, and in the Zoom web portal under Meetings.
4. Open the meeting → **Start meeting**. Zoom opens as host. End the meeting; its status becomes
   Completed (webhook).
5. Schedule another meeting → open it → **Edit**, change the time and save. The change appears
   in Zoom.
6. **Cancel meeting** → confirm. It is removed from Zoom.
7. Sign in as the athlete at `https://<your-domain>/sign-in?as=athlete` → Meetings shows the
   upcoming meeting with **Join Zoom meeting** and the passcode.
8. As the coach: Settings → Integrations → **Disconnect**. The status shows "Not connected" and
   the app no longer appears in the Zoom account's Added Apps.

## 5. Security questionnaire: draft answers

| Question | Draft answer |
| --- | --- |
| Where are Zoom tokens stored? | In our PostgreSQL database (Supabase, encrypted at rest). They are also encrypted by the application with AES-256-GCM, using a key held only in server environment variables. |
| Who can access tokens? | Only server-side code using a service credential. The table has row-level security with no client access. Tokens are never sent to browsers or logged. |
| How do you use refresh tokens? | Access tokens are refreshed shortly before expiry. The newly issued refresh token replaces the old one each time, with protection against concurrent refreshes. If Zoom rejects a refresh token, the connection is deleted. |
| OAuth protections | A single-use, time-limited `state` parameter (CSRF) and PKCE (S256). Authorizations that start from Zoom without our state are not accepted automatically. |
| Webhook verification | Every request's `x-zm-signature` is verified (HMAC-SHA256 with the secret token, constant-time comparison). Requests older than 5 minutes are rejected. We answer `endpoint.url_validation` as specified. |
| Deauthorization | On `app_deauthorized` we delete that user's tokens immediately. Disconnecting in iCoach also calls Zoom's revoke endpoint. |
| Data minimization / scopes | Only `meeting:write:meeting`, `meeting:update:meeting`, `meeting:delete:meeting`, `meeting:read:meeting`, `user:read:user`. We store the user ID, account ID and email, plus meeting ID, join link and passcode. Host start links are fetched on demand and never stored. |
| Transport security | HTTPS only (TLS via Vercel). |
| Secrets management | Client secret, webhook secret and encryption key are environment variables in the hosting platform, never in source control or client code. |
| Logging | Errors are logged with status codes and error codes only, never tokens or response bodies. |
| Data deletion | Disconnect or deauthorization deletes the tokens. Account deletion cascades to all related rows. Users can request deletion via `<support email>`. |
| Vulnerability management | Dependencies are pinned by lockfile with a 24-hour minimum release age for new packages. Automated tests cover token handling and webhook verification. |
