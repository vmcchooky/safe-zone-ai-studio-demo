import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '8787' },
  stdio: 'inherit',
});

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill('SIGTERM');
  vite.kill('SIGTERM');
  setTimeout(() => process.exit(code), 150);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
server.on('exit', (code) => {
  if (!shuttingDown && code && code !== 0) shutdown(code);
});
vite.on('exit', (code) => {
  if (!shuttingDown && code && code !== 0) shutdown(code);
});
