# Migration verification — 2026-09-14

## Completed

- Frontend TypeScript checking, Vite production build, and backend TypeScript build passed.
- 32 unit/integration tests passed: legacy migrations 0–5, unchanged source data, repeated startup, rejected schema/checksum/orphan failures, SQLite WAL backups and restoration, seven-backup retention, authorization, origin validation, session expiry/logout, login throttling, CRUD/cascades, history, concurrent/idempotent check-ins, server reopening, Chicago dates/DST, stale response rejection, and failed saves.
- Twelve browser acceptance tests passed across Chromium, Firefox, and WebKit on this Mac: two-session updates, Performance refresh, login/logout, browser reload, Focus Mode, retained input after network failure/session expiry, and startup retry. Responsive coverage checks 390, 768, 1280, and 1920 px widths, document scrolling to the last task, sticky headers, full-width Performance, calendar sizing, and collapsible/drawer navigation with keyboard focus restoration.
- Existing desktop data was imported into a separate web database. Domain records in all six application tables match the original database after import; the original was not modified.
- Caddy configuration and LaunchAgent plists validated. Both services were installed and started. A web-service restart recovered successfully and both backend and certificate-verified HTTPS health checks passed.
- The generated local CA was trusted in this Mac's login keychain. A real Chromium browser opened HTTPS without bypassing certificate validation, signed in using the private generated password, visited every screen, and verified Secure/HttpOnly session cookies. Final live verification reported no browser console/page errors or failed HTTP assets. Temporary QA sessions were signed out.
- Fonts and emoji are served locally. The dependency audit reported zero known vulnerabilities after dependency installation.

## Still requires the owner's other devices

- Reserve this Mac's current LAN address in the router to keep the URL stable.
- Import the local root certificate on each Windows/Linux/other Mac device, then verify sign-in and shared edits over the LAN. Those physical devices were not available for testing here.
- Keep the desktop installation and its original database until those real-device checks are complete. It does not receive new web changes.

See [deployment and recovery instructions](README.md). Local credentials, certificates, databases, logs, safety copies, and visual QA screenshots are excluded from Git.
