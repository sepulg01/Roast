#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const localLibPath = join(process.cwd(), '.playwright-local-libs', 'usr', 'lib', 'x86_64-linux-gnu');
const env = { ...process.env };

if (existsSync(localLibPath)) {
  env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH
    ? `${localLibPath}:${env.LD_LIBRARY_PATH}`
    : localLibPath;
}

const executable = process.platform === 'win32'
  ? join(process.cwd(), 'node_modules', '.bin', 'playwright.cmd')
  : join(process.cwd(), 'node_modules', '.bin', 'playwright');

const child = spawn(executable, ['test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code || 0;
});
