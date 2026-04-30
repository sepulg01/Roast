#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MIN_APPROVAL_DATE = '2026-04-30';
const APPROVAL_DIR = 'copy-approvals/';

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: options.encoding ?? 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function splitGitPaths(output) {
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => path.replaceAll('\\', '/'));
}

function stagedPaths(args = []) {
  const output = git(['diff', '--cached', '--name-only', '-z', ...args], {
    encoding: 'buffer',
  });

  return splitGitPaths(output);
}

function changedWorktreePaths() {
  const tracked = git(['diff', '--name-only', '-z', 'HEAD'], {
    encoding: 'buffer',
  });
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], {
    encoding: 'buffer',
  });

  return [...new Set([...splitGitPaths(tracked), ...splitGitPaths(untracked)])];
}

function isDirectApprovalFile(path) {
  if (!path.startsWith(APPROVAL_DIR) || !path.endsWith('.md')) {
    return false;
  }

  return !path.slice(APPROVAL_DIR.length).includes('/');
}

function isCopySensitivePath(path) {
  return (
    path.endsWith('.html') ||
    path === 'assets/site.js' ||
    path === 'assets/checkout.js' ||
    path === 'assets/site.css' ||
    path.endsWith('.svg') ||
    path.startsWith('assets/products/') ||
    path.startsWith('assets/logos/')
  );
}

function readStagedFile(path) {
  try {
    return git(['show', `:${path}`]);
  } catch {
    return null;
  }
}

function readWorktreeFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function isRealIsoDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function hasApprovalDate(content) {
  const dateMatches = content.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g);

  for (const match of dateMatches) {
    const date = match[0];

    if (isRealIsoDate(date) && date >= MIN_APPROVAL_DATE) {
      return true;
    }
  }

  return false;
}

function approvalErrors(content) {
  const errors = [];

  if (!hasApprovalDate(content)) {
    errors.push(`date ${MIN_APPROVAL_DATE} or later`);
  }

  if (!/\bowner\b\s*:?\s*gonzalo\b/i.test(content)) {
    errors.push('owner Gonzalo');
  }

  if (!/\baprobado\b/i.test(content)) {
    errors.push('APROBADO/aprobado');
  }

  return errors;
}

function findValidApproval(approvalPaths, readApprovalFile) {
  const invalidApprovals = [];
  const validApproval = approvalPaths.find((path) => {
    const content = readApprovalFile(path);

    if (content === null) {
      invalidApprovals.push([path, ['content could not be read']]);
      return false;
    }

    const errors = approvalErrors(content);

    if (errors.length > 0) {
      invalidApprovals.push([path, errors]);
      return false;
    }

    return true;
  });

  return { validApproval, invalidApprovals };
}

function failForMissingApproval(scope, copySensitivePaths, invalidApprovals) {
  console.error(`copy approval required for ${scope} copy-sensitive changes:`);
  for (const path of copySensitivePaths) {
    console.error(`- ${path}`);
  }

  console.error(
    `Include a changed ${APPROVAL_DIR}*.md file with date ${MIN_APPROVAL_DATE} or later, owner Gonzalo, and APROBADO/aprobado.`,
  );

  if (invalidApprovals.length > 0) {
    console.error('Approval files found, but none were valid:');
    for (const [path, errors] of invalidApprovals) {
      console.error(`- ${path}: missing ${errors.join(', ')}`);
    }
  }

  process.exit(1);
}

const stagedChangedPaths = stagedPaths();
const stagedCopySensitivePaths = stagedChangedPaths.filter(isCopySensitivePath);

if (stagedCopySensitivePaths.length > 0) {
  const approvalPaths = stagedPaths(['--diff-filter=ACMRT']).filter(isDirectApprovalFile);
  const { validApproval, invalidApprovals } = findValidApproval(approvalPaths, readStagedFile);

  if (validApproval) {
    console.log(
      `copy approval: ${validApproval} covers ${stagedCopySensitivePaths.length} staged copy-sensitive change(s).`,
    );
    process.exit(0);
  }

  failForMissingApproval('staged', stagedCopySensitivePaths, invalidApprovals);
}

const worktreeChangedPaths = changedWorktreePaths();
const worktreeCopySensitivePaths = worktreeChangedPaths.filter(isCopySensitivePath);

if (worktreeCopySensitivePaths.length === 0) {
  console.log('copy approval: no staged or working-tree copy-sensitive changes.');
  process.exit(0);
}

const worktreeApprovalPaths = worktreeChangedPaths.filter(isDirectApprovalFile);
const { validApproval, invalidApprovals } = findValidApproval(worktreeApprovalPaths, readWorktreeFile);

if (validApproval) {
  console.log(
    `copy approval: ${validApproval} covers ${worktreeCopySensitivePaths.length} working-tree copy-sensitive change(s).`,
  );
  process.exit(0);
}

failForMissingApproval('working-tree', worktreeCopySensitivePaths, invalidApprovals);
