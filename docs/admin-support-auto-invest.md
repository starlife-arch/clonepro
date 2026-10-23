# Admin support sessions and auto-invest controls

Apply `migrations/016_admin_support_auto_invest.sql` after migrations `001_users.sql` and `013_admin.sql`, then apply `migrations/017_auto_reinvest_overrides.sql`. Migration 017 converts the default rows created by 016 into nullable overrides; explicit admin choices are preserved.

## API

The endpoint is `/api/admin-controls`. It requires the existing `x-admin-uid` identity header to resolve to an account whose role is `admin`.

POST actions:
- `status`: return global setting and counts.
- `set-global-auto-invest` with `{ "disabled": true|false }`: change a global override without changing users' saved preferences.
- `set-user-auto-invest` with `{ "targetUid": "...", "enabled": true|false }`: update one user's preference.
- `get-user-auto-invest` with `{ "targetUid": "..." }`: return saved and effective state.
- `start-support-session` with `{ "targetUid": "...", "reason": "..." }`: create an audited, 30-minute support session.
- `end-support-session` with `{ "sessionId": "..." }`: end the current admin's active session.
- `approve-withdrawal` with `{ "withdrawalId": "...", "confirmed": true, "reason": "..." }`: mark a pending withdrawal approved using a transaction and write an audit event. This records approval; it does not itself issue a payout.

Support sessions are explicitly marked and audited. They do not impersonate a user's authentication token, expose passwords/OTPs, or automatically grant unrestricted access to all existing endpoints. Financial operations should require explicit action confirmation and use the audited admin API.

## Important remaining integration

The repository scan did not reveal a clearly identifiable automatic-invest scheduler or an existing auto-invest preference field. Therefore, the new setting and per-user preference are stored and queryable, but **the global switch is not yet guaranteed to stop automatic investments** until the real investment scheduler checks both:
`admin_settings.auto_invest_global_disabled` and `user_auto_invest_preferences.enabled` immediately before creating each automatic investment. Locate and wire that execution path before enabling this in production.

The UI fix in `styles.css` introduces light/dark theme tokens, better contrast for common controls and content surfaces, responsive message/channel headers, and non-overlapping megaphone layout. Since the main page is a large single HTML file and its exact message markup did not appear in the available source response, confirm the actual selectors in-browser and adjust them if the app uses different class names.

## Safe verification checklist

- Run migrations on a disposable database.
- Confirm non-admin requests are rejected.
- Confirm global disable/restore never overwrites individual preferences.
- Confirm an ended/expired support session cannot be ended as active.
- Confirm withdrawal approval only changes a pending record and is audited; never test against production payment credentials.
- Verify the scheduler guard and UI changes before production use.


## Auto-reinvest rules

The daily profit job reads the global disable switch and per-user admin overrides before processing investment profits. The global switch suppresses reinvestment while still crediting the user's full profit to their available balance. Per-user overrides are nullable: when no admin override exists, the user's own `autoReinvest` setting is honored; an explicit admin on/off setting overrides that preference for that customer. Global restore does not alter those saved settings.

The default minimum reinvestment amount is **$1.00**. If the calculated percentage of profit is below this threshold, no reinvestment record is created and the entire profit is credited to the user's available balance. Admins can change this threshold with `set-minimum-reinvest-amount` and `{ "amount": 1.00 }`. Setting it to zero disables the minimum threshold.

## Admin actions on behalf of customers

For an API endpoint that uses the shared `requireUser` guard, the admin client must send all of:
- `x-admin-uid: <admin account id>`
- `x-support-session-id: <active session id>`
- `x-user-uid: <selected customer id>`

The session must belong to that admin, target that customer, remain active, and not be expired. Each guarded API call is recorded in `admin_activity` with method and route. Use the existing endpoint for the intended operation so its validation and business logic still run.

**Scope caveat:** this shared guard only covers API handlers that call `requireUser`. Features that write directly from the browser to Firestore, or use other authorization helpers, need their own audited support-session authorization before they can be operated this way. This draft does not claim every platform feature is already covered. Do not treat it as complete until all user-capable actions have been inventoried and verified.
