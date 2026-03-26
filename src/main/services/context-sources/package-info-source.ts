/**
 * PackageInfoSource -- dependency and script info from package.json or pyproject.toml.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { ContextSource, ContextChunk } from '../context-sources';

export class PackageInfoSource implements ContextSource {
  readonly id = 'package-info';
  readonly name = 'Package Info';
  readonly description = 'Dependencies and scripts from package.json or pyproject.toml';

  async available(projectPath: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(projectPath, 'package.json')) ||
      fs.existsSync(path.join(projectPath, 'pyproject.toml'))
    );
  }

  async fetch(projectPath: string, _query?: string): Promise<ContextChunk[]> {
    const chunks: ContextChunk[] = [];

    // --- package.json ---
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw) as Record<string, unknown>;

        const lines: string[] = [];
        if (pkg.name) lines.push(`Name: ${pkg.name}`);
        if (pkg.version) lines.push(`Version: ${pkg.version}`);
        if (pkg.description) lines.push(`Description: ${pkg.description}`);

        if (pkg.scripts && typeof pkg.scripts === 'object') {
          lines.push('', 'Scripts:');
          for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
            lines.push(`  ${name}: ${cmd}`);
          }
        }

        if (pkg.dependencies && typeof pkg.dependencies === 'object') {
          const deps = Object.keys(pkg.dependencies as Record<string, string>);
          lines.push('', `Dependencies (${deps.length}): ${deps.join(', ')}`);
        }

        if (pkg.devDependencies && typeof pkg.devDependencies === 'object') {
          const devDeps = Object.keys(pkg.devDependencies as Record<string, string>);
          lines.push(`DevDependencies (${devDeps.length}): ${devDeps.join(', ')}`);
        }

        chunks.push({
          sourceId: this.id,
          title: 'package.json',
          content: lines.join('\n'),
          relevance: 0.7,
          metadata: { file: 'package.json' },
        });
      } catch {
        // malformed package.json -- skip
      }
    }

    // --- pyproject.toml ---
    const pyPath = path.join(projectPath, 'pyproject.toml');
    if (fs.existsSync(pyPath)) {
      try {
        const raw = fs.readFileSync(pyPath, 'utf-8');

        // Simple extraction: grab [project] section name, version, dependencies
        const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m);
        const versionMatch = raw.match(/^version\s*=\s*"([^"]+)"/m);

        const lines: string[] = [];
        if (nameMatch) lines.push(`Name: ${nameMatch[1]}`);
        if (versionMatch) lines.push(`Version: ${versionMatch[1]}`);

        // Include a truncated view of the file (first 80 lines)
        const preview = raw.split('\n').slice(0, 80).join('\n');
        lines.push('', preview);

        chunks.push({
          sourceId: this.id,
          title: 'pyproject.toml',
          content: lines.join('\n'),
          relevance: 0.7,
          metadata: { file: 'pyproject.toml' },
        });
      } catch {
        // malformed pyproject.toml -- skip
      }
    }

    return chunks;
  }
}
