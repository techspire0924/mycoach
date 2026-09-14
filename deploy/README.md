# Run MyCoach on your home network

MyCoach has one owner and one database. This Mac hosts the server; Windows, Mac, and Linux devices use a browser. The host must stay awake and logged in. Use a trusted home LAN; do not configure router port forwarding.

## Install and import

Install Node.js **24 LTS** (including npm) and [Caddy](https://caddyserver.com/docs/install). Work from the project directory:

```sh
npm ci
npm run build
```

Close the old MyCoach desktop app. Import **before** running setup; import refuses to overwrite an existing web database:

```sh
npm run db:import -- "$HOME/Library/Application Support/com.a.mycoach/mycoach.db"
npm run setup
```

Import saves a pre-upgrade backup, validates migration checksums/schema/relationships, copies the database, applies only missing migrations, and verifies existing data. The original database is never used by the web server. If validation fails, keep the original intact and investigate the reported problem; do not delete history or skip validation. Existing migrations 0–5 are supported. Already-applied migration SQL must never be edited.

The setup command asks for a password without echoing it. Alternatively, `npm run setup -- --generate` creates a strong password and saves it to `.data/owner-password.txt` with owner-only permissions; copy it into your password manager and remove that plaintext file when no longer needed. It stores a salted scrypt hash and revokes existing sessions. To change the password later, stop the server, rerun setup, and restart. There is no default password or public registration.

By default data is stored in `.data/`, separate from source and build outputs. Set `MYCOACH_DATA_DIR` consistently for every command to use another directory. Keep this directory on the host's local disk, not a network share or synced folder. It contains the database, backups, host configuration, and logs. Do not copy it into `public/` or `dist/`.

## Configure HTTPS and startup

Reserve this Mac's private IPv4 address in your router's DHCP settings. Use that address below; the example `192.168.1.20` must be replaced with your Mac's address. Find Caddy's absolute executable path with `command -v caddy`.

```sh
npm run host:configure -- 192.168.1.20 /opt/homebrew/bin/caddy
```

This generates `.local/Caddyfile`, two LaunchAgent plists, and `.data/host.json`. Open the generated files to review the paths. The resulting address is `https://192.168.1.20:8443`. The backend binds only to `127.0.0.1:3001`; Caddy handles HTTPS on port 8443. The generated files capture the current Node executable and project directory. Regenerate them if either moves. Production does not use Vite's development server.

```sh
caddy validate --config .local/Caddyfile
mkdir -p "$HOME/Library/LaunchAgents"
cp .local/com.a.mycoach.web.plist "$HOME/Library/LaunchAgents/"
cp .local/com.a.mycoach.https.plist "$HOME/Library/LaunchAgents/"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.a.mycoach.web.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.a.mycoach.https.plist"
```

Allow Caddy through the Mac firewall for the home network. Ensure Wi-Fi client isolation is disabled for the devices that need access. The generated server LaunchAgent uses `caffeinate -i` to prevent idle sleep while the service runs. Closing a laptop lid or manually choosing Sleep can still put it to sleep. These LaunchAgents restart on failure and start after login, not before login. FileVault may require a local login after reboot.

### Trust the local certificate

Caddy issues local certificates using its own certificate authority. Each client must trust **the root certificate**, not just dismiss a browser warning. See [Caddy's local HTTPS documentation](https://caddyserver.com/docs/automatic-https#local-https).

For the generated macOS service, the root certificate is normally at:

```text
.data/caddy/pki/authorities/local/root.crt
```

With a custom `MYCOACH_DATA_DIR`, use its `caddy/pki/authorities/local/root.crt` file. The generated config keeps Caddy storage in the web data directory and leaves certificate trust installation explicit. Transfer only `root.crt` to your devices. Never share `root.key` or the Caddy data directory.

- **macOS:** Import `root.crt` into Keychain Access → System, then set it to Always Trust for SSL.
- **Windows:** Import it into Certificates (Local Computer) → Trusted Root Certification Authorities, using the certificate import wizard. Administrator permission may be required.
- **Debian/Ubuntu Linux:** Copy it to `/usr/local/share/ca-certificates/mycoach-local.crt`, then run `sudo update-ca-certificates`.
- **Fedora/RHEL Linux:** Copy it to `/etc/pki/ca-trust/source/anchors/`, then run `sudo update-ca-trust`.
- **Firefox:** If system trust is not picked up, Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import; trust this CA to identify websites.

Compare certificate fingerprints when transferring it. Restart the browser and open the same configured HTTPS URL on every device. The login uses a Secure, HttpOnly, SameSite cookie; sessions expire after 30 days. Device clock errors can cause certificate validation failures.

## Verify availability

```sh
curl --fail http://127.0.0.1:3001/api/health
curl --fail --cacert .data/caddy/pki/authorities/local/root.crt https://192.168.1.20:8443/api/health
launchctl print "gui/$(id -u)/com.a.mycoach.web"
```

Logs are in `.data/logs/`. The public health endpoint returns only database availability. All application data requires authentication. Test sign-in and changes on a second device; an active visible tab refreshes within five seconds under normal LAN conditions. Background browsers may throttle timers; returning to the tab refreshes immediately.

## Back up, update, and restore

The server makes a consistent SQLite backup at startup if today's backup is missing, and checks hourly while running. It retains seven daily backups. Manual and pre-upgrade backups are retained until you remove them. Backups include the password hash and session records; store them privately. A backup on the same disk protects against editing mistakes, not disk failure; copy backups to a separate disk periodically.

```sh
npm run db:backup
```

To stop before an update or restore:

```sh
launchctl bootout "gui/$(id -u)/com.a.mycoach.https"
launchctl bootout "gui/$(id -u)/com.a.mycoach.web"
```

Back up before updating, then update the checkout, run `npm ci`, `npm test`, and `npm run build`, and bootstrap both services again. Do not remove `.data/`. Startup validates migrations; pending SQL migrations create an additional pre-upgrade backup before applying changes.

To restore while the server is stopped:

```sh
npm run db:restore -- /absolute/path/to/backup.db
```

Restore validates a separate candidate, backs up the current web database, replaces it, and revokes restored sessions. Restart both services and sign in. A desktop-era backup without an owner password needs `npm run setup` before restart.

The old desktop installation remains a rollback option using its original database. It does **not** receive changes made in the web app. Do not use both datasets as if they were synchronized.

## Development and tests

For a separate development dataset, use a dedicated directory and the loopback origin:

```sh
MYCOACH_DATA_DIR=.data/dev MYCOACH_ORIGIN=http://localhost:1420 npm run setup
MYCOACH_DATA_DIR=.data/dev MYCOACH_ORIGIN=http://localhost:1420 npm run dev
```

Visit `http://localhost:1420`. Development permits an insecure cookie only on loopback. Never expose the Vite development server to the LAN.

```sh
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Browser tests create temporary databases and a test-only password; they never load the owner database. Run real-device acceptance on Windows, Mac, and Linux before retiring desktop usage. The automated browser engines on one Mac do not substitute for those checks.
