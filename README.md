<p align="center">
  <img src="public/mycoach-icon.png" width="96" alt="MyCoach icon" />
</p>

<h1 align="center">MyCoach</h1>

<p align="center">
  A local-first desktop coach for goals, tasks, and habits — built with Tauri, React, and SQLite.
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" />
  <img alt="react" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
</p>

---

## What it is

MyCoach is a single-user productivity app that ties **goals**, **tasks**, and **habits** together instead of tracking them separately. Tasks roll up into goal progress, recurring tasks and habits share a calendar-aware streak model, and everything lives in a local SQLite database — no account, no server, no sync required.

## Features

- **Today** — focus view of what's due today, recurring tasks, and habit check-ins
- **Tasks** — todo → in-progress → done workflow with subtasks and recurrence (daily / workdays / custom weekdays)
- **Goals** — nest sub-goals, attach tasks, and watch a split progress bar (done vs. in-progress) fill in as work lands
- **Habits** — Mon–Sun calendar-week grid that resets automatically, with streak tracking for both daily and weekly habits
- **Inbox** — frictionless capture, triage into a goal or discard later
- **Calendar** / **Weekly Review** — zoom out and see the week or month at a glance
- Frameless, transparent window with a custom cursor and gradient border — built to feel like an app, not a browser tab

## Tech stack

| Layer | Choice |
|---|---|
| Shell | [Tauri 2](https://tauri.app) (Rust) |
| UI | React 19 + TypeScript |
| State | Zustand |
| Storage | SQLite via `@tauri-apps/plugin-sql` |
| Build | Vite |

## Getting started

Requires [Node.js](https://nodejs.org) and the [Rust toolchain](https://www.rust-lang.org/tools/install) (Tauri's prerequisites: https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

To build a release binary for your platform:

```bash
npm run tauri build
```

## Project layout

```
src/
  views/       top-level pages (Today, Tasks, Goals, Habits, Inbox, Calendar, Weekly)
  components/  shared UI (TaskItem, modals, Cursor, ConfirmDialog)
  store/       Zustand store — single source of app state
  db/          SQLite schema + query functions, one module per entity
src-tauri/     Rust shell, window config, SQL migrations
```

## License

MIT — see [LICENSE](LICENSE).
