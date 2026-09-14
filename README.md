<p align="center"><img src="public/mycoach-web-icon.png" width="96" alt="MyCoach" /></p>
<h1 align="center">MyCoach</h1>

A private, single-owner web app for goals, tasks, habits, and performance history. One Mac hosts the app and SQLite database; your Windows, Mac, and Linux devices use the same data through a browser on your home network.

## Features

- Today, Tasks, Inbox, nested Goals, Habits, Calendar, Weekly Review, and Performance.
- One-time task lifecycle tracking, recurring task check-ins, and daily/weekly habit history.
- Finish and reopen habits while preserving performance history.
- Password-protected sessions, local HTTPS, and automatic refresh across devices.
- Three themes, browser Focus Mode, and navigation for smaller windows.
- Verified desktop database import, consistent SQLite backups, and restore tooling.

The host must stay awake and reachable. Editing requires a connection; no offline writes are queued. Themes are saved per browser. Calendar dates use America/Chicago. This is a single-owner home-network app with no cloud service or account registration.

## Setup

Requires Node.js **24 LTS** with npm. LAN hosting additionally requires Caddy and certificate trust on each device.

```sh
npm ci
npm run build
# Close the desktop app, then import before setup:
npm run db:import -- "$HOME/Library/Application Support/com.a.mycoach/mycoach.db"
npm run setup
```

For a fresh dataset, omit import. Follow [the deployment guide](deploy/README.md) for HTTPS, automatic startup, backups, recovery, and development. `npm run host:configure -- <reserved-LAN-IP> <absolute-caddy-path>` generates the host configuration.

## Architecture

React 19, TypeScript, Vite, and Zustand serve the browser UI. A Fastify API owns the local SQLite database through better-sqlite3. API routes validate input and enforce owner sessions; only Caddy is exposed to the LAN. Fonts and emoji assets are bundled locally.

- `src/`: browser screens, components, state, and typed API clients.
- `shared/`: shared API contracts and calendar rules.
- `server/`: API, sessions, database migrations, backups, and local administration commands.
- `deploy/`: operating instructions; `tests/`: browser acceptance tests.
- `src-tauri/`: retained desktop source for reference and rollback; not part of the web build.

```sh
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

## License

MIT — see [LICENSE](LICENSE). Bundled Twemoji graphics are licensed under [CC BY 4.0](public/emoji-LICENSE), attributed to Twitter and other contributors. Inter is distributed under the SIL Open Font License (see [public/inter-OFL.txt](public/inter-OFL.txt)). Cursor attribution is in `public/cursors/LICENSE.txt`.
