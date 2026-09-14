import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { isIPv4 } from 'node:net';
const xml = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function generateHost(dataDir: string, ip: string, caddyPath: string) {
  if (!isIPv4(ip) || !(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))) throw new Error('Provide the Mac’s reserved private LAN IPv4 address.');
  if (!caddyPath.startsWith('/')) throw new Error('Caddy path must be absolute.');
  const origin = `https://${ip}:8443`, root = resolve('.'), directory = resolve('.local');
  mkdirSync(directory, {recursive:true, mode:0o700}); mkdirSync(dataDir,{recursive:true,mode:0o700});
  mkdirSync(resolve(dataDir, 'logs'),{recursive:true,mode:0o700});
  writeFileSync(resolve(dataDir,'host.json'), JSON.stringify({origin}, null, 2)+'\n',{mode:0o600});
  const caddyFile = resolve(directory,'Caddyfile');
  writeFileSync(caddyFile, `{
  admin 127.0.0.1:2019
  auto_https disable_redirects
  skip_install_trust
  storage file_system {
    root ${JSON.stringify(resolve(dataDir, 'caddy'))}
  }
}
${origin} {
  bind ${ip} 127.0.0.1
  tls internal
  reverse_proxy 127.0.0.1:3001
}
`);
  function plist(label: string, args: string[], extra = '') {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map(a=>`<string>${xml(a)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer><key>Umask</key><integer>63</integer>
<key>EnvironmentVariables</key><dict><key>MYCOACH_DATA_DIR</key><string>${xml(dataDir)}</string><key>HOME</key><string>${xml(homedir())}</string></dict>
<key>StandardOutPath</key><string>${xml(resolve(dataDir,'logs',label+'.log'))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(dataDir,'logs',label+'.error.log'))}</string>${extra}
</dict></plist>\n`;
  }
  writeFileSync(resolve(directory,'com.a.mycoach.web.plist'),plist('com.a.mycoach.web',['/usr/bin/caffeinate','-i',process.execPath,resolve(root,'server-dist/server/index.js')]));
  writeFileSync(resolve(directory,'com.a.mycoach.https.plist'),plist('com.a.mycoach.https',[caddyPath,'run','--config',caddyFile]));
  return {origin,directory,caddyFile};
}
