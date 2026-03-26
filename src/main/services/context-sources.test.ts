/**
 * ContextSourceRegistry + built-in source tests.
 *
 * Uses vi.mock to stub child_process.execSync and fs operations
 * so tests run without a real git repo or filesystem.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextSource, ContextChunk } from './context-sources';
import { ContextSourceRegistry } from './context-sources';

// ---------------------------------------------------------------------------
// Mock child_process and fs for built-in sources
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => {
  const actual: Record<string, unknown> = {};
  return {
    default: {
      existsSync: vi.fn().mockReturnValue(false),
      statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
      readFileSync: vi.fn().mockReturnValue('{}'),
      readdirSync: vi.fn().mockReturnValue([]),
    },
    existsSync: vi.fn().mockReturnValue(false),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
    readFileSync: vi.fn().mockReturnValue('{}'),
    readdirSync: vi.fn().mockReturnValue([]),
    ...actual,
  };
});

// Import after mocks are set up
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { GitLogSource } from './context-sources/git-log-source';
import { FileTreeSource } from './context-sources/file-tree-source';
import { PackageInfoSource } from './context-sources/package-info-source';

const mockedExecSync = vi.mocked(execSync);
const mockedFs = vi.mocked(fs);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDummySource(id: string, chunks: ContextChunk[] = []): ContextSource {
  return {
    id,
    name: `Source ${id}`,
    description: `Dummy source ${id}`,
    available: vi.fn().mockResolvedValue(true),
    fetch: vi.fn().mockResolvedValue(chunks),
  };
}

function makeUnavailableSource(id: string): ContextSource {
  return {
    id,
    name: `Unavailable ${id}`,
    description: `Always unavailable`,
    available: vi.fn().mockResolvedValue(false),
    fetch: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe('ContextSourceRegistry', () => {
  let registry: ContextSourceRegistry;

  beforeEach(() => {
    registry = new ContextSourceRegistry();
    vi.clearAllMocks();
  });

  describe('register / get / list', () => {
    it('registers and retrieves a source by id', () => {
      const source = makeDummySource('test-1');
      registry.register(source);
      expect(registry.get('test-1')).toBe(source);
    });

    it('returns undefined for unknown id', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites existing source with same id', () => {
      const first = makeDummySource('dup');
      const second = makeDummySource('dup');
      registry.register(first);
      registry.register(second);
      expect(registry.get('dup')).toBe(second);
    });

    it('lists all registered sources with metadata', () => {
      registry.register(makeDummySource('a'));
      registry.register(makeDummySource('b'));
      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.id)).toContain('a');
      expect(list.map((s) => s.id)).toContain('b');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('description');
    });

    it('returns empty list when no sources registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('fetchAll', () => {
    it('fetches from all available sources', async () => {
      const chunkA: ContextChunk = {
        sourceId: 'a', title: 'A', content: 'content-a', relevance: 0.8,
      };
      const chunkB: ContextChunk = {
        sourceId: 'b', title: 'B', content: 'content-b', relevance: 0.5,
      };
      registry.register(makeDummySource('a', [chunkA]));
      registry.register(makeDummySource('b', [chunkB]));

      const results = await registry.fetchAll('/fake/project');
      expect(results).toHaveLength(2);
      // Sorted by relevance descending
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[1].relevance);
    });

    it('skips unavailable sources', async () => {
      const chunk: ContextChunk = {
        sourceId: 'good', title: 'Good', content: 'data', relevance: 0.9,
      };
      registry.register(makeDummySource('good', [chunk]));
      registry.register(makeUnavailableSource('bad'));

      const results = await registry.fetchAll('/fake/project');
      expect(results).toHaveLength(1);
      expect(results[0].sourceId).toBe('good');
    });

    it('skips sources that throw errors', async () => {
      const goodChunk: ContextChunk = {
        sourceId: 'ok', title: 'OK', content: 'fine', relevance: 0.5,
      };
      registry.register(makeDummySource('ok', [goodChunk]));

      const broken: ContextSource = {
        id: 'broken',
        name: 'Broken',
        description: 'Throws on fetch',
        available: vi.fn().mockResolvedValue(true),
        fetch: vi.fn().mockRejectedValue(new Error('boom')),
      };
      registry.register(broken);

      const results = await registry.fetchAll('/fake/project');
      expect(results).toHaveLength(1);
      expect(results[0].sourceId).toBe('ok');
    });

    it('returns empty array when no sources registered', async () => {
      const results = await registry.fetchAll('/fake/project');
      expect(results).toEqual([]);
    });

    it('passes query to sources', async () => {
      const source = makeDummySource('q');
      registry.register(source);
      await registry.fetchAll('/fake/project', 'search term');
      expect(source.fetch).toHaveBeenCalledWith('/fake/project', 'search term');
    });

    it('sorts results by relevance descending', async () => {
      const low: ContextChunk = { sourceId: 'lo', title: 'Lo', content: '', relevance: 0.1 };
      const high: ContextChunk = { sourceId: 'hi', title: 'Hi', content: '', relevance: 0.9 };
      const mid: ContextChunk = { sourceId: 'mid', title: 'Mid', content: '', relevance: 0.5 };
      registry.register(makeDummySource('lo', [low]));
      registry.register(makeDummySource('hi', [high]));
      registry.register(makeDummySource('mid', [mid]));

      const results = await registry.fetchAll('/fake');
      expect(results[0].relevance).toBe(0.9);
      expect(results[1].relevance).toBe(0.5);
      expect(results[2].relevance).toBe(0.1);
    });
  });
});

// ---------------------------------------------------------------------------
// GitLogSource tests
// ---------------------------------------------------------------------------

describe('GitLogSource', () => {
  let source: GitLogSource;

  beforeEach(() => {
    source = new GitLogSource();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(source.id).toBe('git-log');
    expect(source.name).toBe('Git History');
  });

  it('reports available when .git directory exists', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    expect(await source.available('/project')).toBe(true);
  });

  it('reports unavailable when .git directory missing', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(await source.available('/project')).toBe(false);
  });

  it('fetches git log and returns a chunk', async () => {
    const logOutput = 'abc1234 Initial commit\ndef5678 Add feature';
    mockedExecSync.mockReturnValue(logOutput);

    const chunks = await source.fetch('/project');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceId).toBe('git-log');
    expect(chunks[0].content).toContain('abc1234');
    expect(chunks[0].content).toContain('def5678');
    expect(chunks[0].metadata?.commitCount).toBe(2);
  });

  it('returns empty array when git log fails', async () => {
    mockedExecSync.mockImplementation(() => { throw new Error('not a git repo'); });
    const chunks = await source.fetch('/not-a-repo');
    expect(chunks).toEqual([]);
  });

  it('returns empty array when git log is empty', async () => {
    mockedExecSync.mockReturnValue('');
    const chunks = await source.fetch('/empty-repo');
    expect(chunks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FileTreeSource tests
// ---------------------------------------------------------------------------

describe('FileTreeSource', () => {
  let source: FileTreeSource;

  beforeEach(() => {
    source = new FileTreeSource();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(source.id).toBe('file-tree');
    expect(source.name).toBe('File Structure');
  });

  it('reports available when projectPath is a directory', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
    expect(await source.available('/project')).toBe(true);
  });

  it('reports unavailable when path does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(await source.available('/nope')).toBe(false);
  });

  it('uses git ls-files when available', async () => {
    const files = 'src/index.ts\nsrc/utils.ts\npackage.json';
    mockedExecSync.mockReturnValue(files);

    const chunks = await source.fetch('/project');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceId).toBe('file-tree');
    expect(chunks[0].content).toContain('src/index.ts');
    expect(chunks[0].metadata?.fileCount).toBe(3);
  });

  it('returns empty array when git ls-files returns nothing', async () => {
    mockedExecSync.mockReturnValue('');
    const chunks = await source.fetch('/empty');
    expect(chunks).toEqual([]);
  });

  it('falls back to walkDir when git ls-files fails', async () => {
    mockedExecSync.mockImplementation(() => { throw new Error('not a git repo'); });
    // walkDir will call readdirSync which returns [] by default
    mockedFs.readdirSync.mockReturnValue([]);
    const chunks = await source.fetch('/no-git');
    // No files found by walk, so empty
    expect(chunks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PackageInfoSource tests
// ---------------------------------------------------------------------------

describe('PackageInfoSource', () => {
  let source: PackageInfoSource;

  beforeEach(() => {
    source = new PackageInfoSource();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(source.id).toBe('package-info');
    expect(source.name).toBe('Package Info');
  });

  it('reports available when package.json exists', async () => {
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('package.json');
    });
    expect(await source.available('/project')).toBe(true);
  });

  it('reports available when pyproject.toml exists', async () => {
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('pyproject.toml');
    });
    expect(await source.available('/python-project')).toBe(true);
  });

  it('reports unavailable when neither manifest exists', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(await source.available('/empty')).toBe(false);
  });

  it('parses package.json and extracts name, version, scripts, deps', async () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      description: 'A test app',
      scripts: { build: 'tsc', test: 'vitest' },
      dependencies: { react: '^19.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    };

    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('package.json');
    });
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(pkg));

    const chunks = await source.fetch('/project');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceId).toBe('package-info');
    expect(chunks[0].title).toBe('package.json');
    expect(chunks[0].content).toContain('test-app');
    expect(chunks[0].content).toContain('1.0.0');
    expect(chunks[0].content).toContain('build: tsc');
    expect(chunks[0].content).toContain('react');
    expect(chunks[0].content).toContain('typescript');
  });

  it('parses pyproject.toml and extracts name/version', async () => {
    const toml = `[project]\nname = "my-tool"\nversion = "2.0.0"\n\n[tool.ruff]\nline-length = 100`;

    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('pyproject.toml');
    });
    mockedFs.readFileSync.mockReturnValue(toml);

    const chunks = await source.fetch('/py-project');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe('pyproject.toml');
    expect(chunks[0].content).toContain('my-tool');
    expect(chunks[0].content).toContain('2.0.0');
  });

  it('returns empty when package.json is malformed', async () => {
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      return String(p).includes('package.json');
    });
    mockedFs.readFileSync.mockReturnValue('not-json{{{');

    const chunks = await source.fetch('/bad-project');
    expect(chunks).toEqual([]);
  });
});
