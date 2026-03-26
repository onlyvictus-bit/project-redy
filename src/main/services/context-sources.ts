/**
 * ContextSourceRegistry -- structured project context for agent prompts.
 *
 * Registry owns the interface contract and built-in source registration.
 * Individual sources live under ./context-sources/*.ts.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ContextChunk {
  sourceId: string;
  title: string;
  content: string;
  relevance: number; // 0-1
  metadata?: Record<string, unknown>;
}

export interface ContextSource {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  /** Check whether this source can provide data for the given project. */
  available(projectPath: string): Promise<boolean>;

  /** Fetch context chunks. `query` is an optional search/filter hint. */
  fetch(projectPath: string, query?: string): Promise<ContextChunk[]>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ContextSourceRegistry {
  private readonly sources = new Map<string, ContextSource>();

  /** Register a context source. Overwrites if id already exists. */
  register(source: ContextSource): void {
    this.sources.set(source.id, source);
  }

  /** Get a single source by id. */
  get(id: string): ContextSource | undefined {
    return this.sources.get(id);
  }

  /** List all registered sources (lightweight metadata only). */
  list(): Array<{ id: string; name: string; description: string }> {
    return [...this.sources.values()].map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));
  }

  /**
   * Fetch from ALL available sources in parallel.
   * Sources that are unavailable or throw are silently skipped.
   */
  async fetchAll(projectPath: string, query?: string): Promise<ContextChunk[]> {
    const results = await Promise.allSettled(
      [...this.sources.values()].map(async (source) => {
        const ok = await source.available(projectPath);
        if (!ok) return [];
        return source.fetch(projectPath, query);
      }),
    );

    const chunks: ContextChunk[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        chunks.push(...result.value);
      }
    }

    // Sort by relevance descending
    chunks.sort((a, b) => b.relevance - a.relevance);
    return chunks;
  }
}

// ---------------------------------------------------------------------------
// Factory: creates a registry pre-loaded with built-in sources
// ---------------------------------------------------------------------------

import { GitLogSource } from './context-sources/git-log-source';
import { FileTreeSource } from './context-sources/file-tree-source';
import { PackageInfoSource } from './context-sources/package-info-source';

export function createDefaultRegistry(): ContextSourceRegistry {
  const registry = new ContextSourceRegistry();
  registry.register(new GitLogSource());
  registry.register(new FileTreeSource());
  registry.register(new PackageInfoSource());
  return registry;
}
