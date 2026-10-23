# Admin support sessions and auto-invest controls

Apply `migrations/016_admin_support_auto_invest.sql` after migrations `001_users.sql` and `013_admin.sql`.

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
