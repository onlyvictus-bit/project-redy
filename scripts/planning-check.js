#!/usr/bin/env node

/**
 * planning:check — verify required .planning/ files exist.
 * Exit 0 if healthy, exit 1 if missing files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const planningDir = path.join(root, '.planning');

const REQUIRED_FILES = [
  'config.json',
  'PROJECT.md',
  'REQUIREMENTS.md',
  'ROADMAP.md',
  'STATE.md'
];

let ok = true;

if (!fs.existsSync(planningDir)) {
  console.error('ERROR: .planning/ directory not found.');
  console.error('Run the planning bootstrap flow to create it.');
  process.exit(1);
}

for (const file of REQUIRED_FILES) {
  const filePath = path.join(planningDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: .planning/${file}`);
    ok = false;
  } else {
    console.log(`   OK: .planning/${file}`);
  }
}

if (ok) {
  console.log('\nAll required .planning/ files present.');
  process.exit(0);
} else {
  console.error('\nSome .planning/ files are missing.');
  process.exit(1);
}
