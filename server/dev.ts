import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--import','tsx','--watch','server/index.ts'], {stdio:'inherit'}),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {stdio:'inherit'}),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); process.exitCode = code; }
children.forEach(child => child.on('exit', code => stop(code ?? 1)));
process.on('SIGTERM', () => stop()); process.on('SIGINT', () => stop());
