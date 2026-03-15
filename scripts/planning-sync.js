#!/usr/bin/env node

/**
 * planning:sync — mirror .planning/phases/ plan and summary docs
 * into docs/superpowers/plans/ as read-only generated files.
 *
 * Source of truth: .planning/
 * Mirror target: docs/superpowers/plans/_mirror-*
 * Existing dated manual docs are never overwritten.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const phasesDir = path.join(root, '.planning', 'phases');
const mirrorDir = path.join(root, 'docs', 'superpowers', 'plans');

if (!fs.existsSync(phasesDir)) {
  console.log('No .planning/phases/ directory found. Nothing to sync.');
  process.exit(0);
}

fs.mkdirSync(mirrorDir, { recursive: true });

// Remove old mirror files before regenerating
const existingMirrors = fs.readdirSync(mirrorDir).filter((f) => f.startsWith('_mirror-'));
for (const old of existingMirrors) {
  fs.unlinkSync(path.join(mirrorDir, old));
}

const phases = fs.readdirSync(phasesDir, { withFileTypes: true }).filter((d) => d.isDirectory());
let count = 0;

for (const phase of phases) {
  const phaseDir = path.join(phasesDir, phase.name);
  const files = fs.readdirSync(phaseDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const sourcePath = path.join(phaseDir, file);
    const content = fs.readFileSync(sourcePath, 'utf8');
    const mirrorName = `_mirror-${phase.name}--${file}`;
    const mirrorPath = path.join(mirrorDir, mirrorName);

    const header = [
      `<!-- Generated from .planning/phases/${phase.name}/${file} -->`,
      '<!-- Do not edit here; edit the canonical .planning file -->',
      ''
    ].join('\n');

    fs.writeFileSync(mirrorPath, header + content, 'utf8');
    console.log(`  SYNCED: ${mirrorName}`);
    count++;
  }
}

console.log(`\nSynced ${count} file(s) to docs/superpowers/plans/.`);
