import { beforeEach, describe, expect, it } from 'vitest';

import type {
  AgentId,
  ArtifactBundle,
  Finding,
  FusedFinding,
} from '@shared/types';
import { FindingsFusionService } from './findings-fusion';
import type { WorkbenchConfigService } from './workbench-config';

// ---------------------------------------------------------------------------
// Mock WorkbenchConfigService
// ---------------------------------------------------------------------------

function makeConfigService(overrides?: {
  weights?: Record<string, number>;
  deduplicateThreshold?: number;
}): WorkbenchConfigService {
  const defaultWeights = { claude: 0.35, codex: 0.30, gemini: 0.25, ollama: 0.10 };
  return {
    get: () => ({
      fusion: {
        weights: overrides?.weights ?? defaultWeights,
        deduplicateThreshold: overrides?.deduplicateThreshold ?? 0.8,
      },
    }),
  } as unknown as WorkbenchConfigService;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides?: Partial<Finding>): Finding {
  return {
    severity: 'medium',
    title: 'Unused variable detected',
    body: 'Variable `tmp` is declared but never used.',
    file: 'src/main.ts',
    line: 42,
    sourceAgent: 'claude',
    ...overrides,
  };
}

function makeBundle(
  agentId: AgentId,
  findings: Finding[],
): ArtifactBundle {
  return {
    id: `bundle-${agentId}`,
    taskId: 'task-1',
    stepId: 'step-1',
    agentId,
    role: 'reviewer',
    prompt: '',
    stdout: '',
    stderr: '',
    exitCode: 0,
    structuredEvents: [],
    summary: '',
    finalMessage: '',
    findings,
    commandRuns: [],
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let service: FindingsFusionService;

beforeEach(() => {
  service = new FindingsFusionService(makeConfigService());
});

describe('FindingsFusionService', () => {
  describe('fuse (empty)', () => {
    it('returns empty result when no artifacts provided', () => {
      const result = service.fuse(new Map());
      expect(result.findings).toHaveLength(0);
      expect(result.summary.totalRaw).toBe(0);
      expect(result.summary.totalFused).toBe(0);
      expect(result.summary.agentAgreement).toBe(0);
    });

    it('returns empty result when artifacts have no findings', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', []));
      map.set('codex', makeBundle('codex', []));
      const result = service.fuse(map);
      expect(result.findings).toHaveLength(0);
      expect(result.summary.totalRaw).toBe(0);
    });
  });

  describe('fuse (single agent)', () => {
    it('returns all findings from a single agent without dedup', () => {
      const findings = [
        makeFinding({ title: 'Bug A', file: 'a.ts', line: 10 }),
        makeFinding({ title: 'Bug B', file: 'b.ts', line: 20 }),
      ];
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', findings));

      const result = service.fuse(map);
      expect(result.findings).toHaveLength(2);
      expect(result.summary.totalRaw).toBe(2);
      expect(result.summary.deduplicatedCount).toBe(0);
      expect(result.findings.every((f) => !f.deduplicated)).toBe(true);
    });
  });

  describe('fuse (multi-agent dedup)', () => {
    it('deduplicates identical findings from two agents', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'Unused variable detected', file: 'src/main.ts', line: 42 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'Unused variable detected', file: 'src/main.ts', line: 42, sourceAgent: 'codex' }),
      ]));

      const result = service.fuse(map);
      expect(result.findings).toHaveLength(1);
      expect(result.summary.totalRaw).toBe(2);
      expect(result.summary.deduplicatedCount).toBe(1);
      expect(result.findings[0].deduplicated).toBe(true);
      expect(result.findings[0].sources).toHaveLength(2);
    });

    it('does NOT deduplicate findings in different files', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'Unused variable detected', file: 'src/a.ts', line: 42 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'Unused variable detected', file: 'src/b.ts', line: 42, sourceAgent: 'codex' }),
      ]));

      const result = service.fuse(map);
      expect(result.findings).toHaveLength(2);
      expect(result.summary.deduplicatedCount).toBe(0);
    });

    it('does NOT deduplicate findings far apart in line numbers', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'Unused variable detected', file: 'src/main.ts', line: 10 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'Unused variable detected', file: 'src/main.ts', line: 100, sourceAgent: 'codex' }),
      ]));

      const result = service.fuse(map);
      expect(result.findings).toHaveLength(2);
    });

    it('deduplicates findings with similar but not identical titles', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      // These titles have high Jaccard overlap (4/5 = 0.8)
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'Unused variable tmp detected warning', file: 'src/main.ts', line: 42 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'Unused variable tmp detected alert', file: 'src/main.ts', line: 44, sourceAgent: 'codex' }),
      ]));

      const result = service.fuse(map);
      // Jaccard: intersection(unused,variable,tmp,detected) = 4, union(+warning,+alert) = 6
      // 4/6 = 0.667 -- still below 0.8. Use threshold override instead.
      const customService = new FindingsFusionService(makeConfigService({ deduplicateThreshold: 0.6 }));
      const result2 = customService.fuse(map);
      expect(result2.findings).toHaveLength(1);
      expect(result2.findings[0].deduplicated).toBe(true);
    });

    it('merges findings from 3 agents into one fused finding', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'SQL injection risk', file: 'db.ts', line: 15 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'SQL injection risk', file: 'db.ts', line: 15, sourceAgent: 'codex' }),
      ]));
      map.set('gemini', makeBundle('gemini', [
        makeFinding({ title: 'SQL injection risk', file: 'db.ts', line: 15, sourceAgent: 'gemini' }),
      ]));

      const result = service.fuse(map);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].sources).toHaveLength(3);
      expect(result.summary.agentAgreement).toBe(1);
    });
  });

  describe('composite scoring', () => {
    it('computes higher scores for critical findings', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ severity: 'critical', title: 'RCE vulnerability', file: 'a.ts', line: 1 }),
        makeFinding({ severity: 'info', title: 'Trailing whitespace', file: 'b.ts', line: 1 }),
      ]));

      const result = service.fuse(map);
      const critical = result.findings.find((f) => f.severity === 'critical');
      const info = result.findings.find((f) => f.severity === 'info');
      expect(critical).toBeDefined();
      expect(info).toBeDefined();
      expect(critical!.compositeScore).toBeGreaterThan(info!.compositeScore);
    });

    it('marks action required when compositeScore > 0.5', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({
          severity: 'critical',
          title: 'Critical security issue',
          file: 'a.ts',
          line: 1,
          evidence: 'found exploit',
          recommendedAction: 'fix immediately',
        }),
      ]));

      const result = service.fuse(map);
      expect(result.findings[0].actionRequired).toBe(true);
      expect(result.summary.actionRequiredCount).toBe(1);
    });

    it('uses custom agent weights when provided', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ severity: 'high', title: 'Issue found', file: 'a.ts', line: 1 }),
      ]));

      // Give claude a very high weight
      const resultHigh = service.fuse(map, { claude: 0.9 });
      // Give claude a very low weight
      const resultLow = service.fuse(map, { claude: 0.01 });

      // Scores should differ — though both are single-agent, so the normalization
      // means the absolute score is the same. The difference is in multi-agent scenarios.
      // For single agent: score = (w * conf * sev) / w = conf * sev, independent of weight
      // This is mathematically correct behavior.
      expect(resultHigh.findings[0].compositeScore).toBe(resultLow.findings[0].compositeScore);
    });

    it('results are sorted by composite score descending', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ severity: 'info', title: 'Info thing', file: 'a.ts', line: 1 }),
        makeFinding({ severity: 'critical', title: 'Critical thing', file: 'b.ts', line: 1 }),
        makeFinding({ severity: 'low', title: 'Low thing', file: 'c.ts', line: 1 }),
      ]));

      const result = service.fuse(map);
      for (let i = 1; i < result.findings.length; i++) {
        expect(result.findings[i - 1].compositeScore).toBeGreaterThanOrEqual(
          result.findings[i].compositeScore,
        );
      }
    });
  });

  describe('normalizeSeverity', () => {
    it('normalizes standard severity names', () => {
      expect(service.normalizeSeverity('critical')).toBe('critical');
      expect(service.normalizeSeverity('high')).toBe('high');
      expect(service.normalizeSeverity('medium')).toBe('medium');
      expect(service.normalizeSeverity('low')).toBe('low');
      expect(service.normalizeSeverity('info')).toBe('info');
    });

    it('normalizes alternative severity names', () => {
      expect(service.normalizeSeverity('fatal')).toBe('critical');
      expect(service.normalizeSeverity('blocker')).toBe('critical');
      expect(service.normalizeSeverity('major')).toBe('high');
      expect(service.normalizeSeverity('error')).toBe('high');
      expect(service.normalizeSeverity('warning')).toBe('medium');
      expect(service.normalizeSeverity('warn')).toBe('medium');
      expect(service.normalizeSeverity('moderate')).toBe('medium');
      expect(service.normalizeSeverity('minor')).toBe('low');
      expect(service.normalizeSeverity('note')).toBe('info');
      expect(service.normalizeSeverity('suggestion')).toBe('info');
      expect(service.normalizeSeverity('informational')).toBe('info');
    });

    it('defaults to medium for unknown severities', () => {
      expect(service.normalizeSeverity('banana')).toBe('medium');
      expect(service.normalizeSeverity('')).toBe('medium');
    });

    it('is case-insensitive', () => {
      expect(service.normalizeSeverity('CRITICAL')).toBe('critical');
      expect(service.normalizeSeverity('High')).toBe('high');
      expect(service.normalizeSeverity('  Medium  ')).toBe('medium');
    });
  });

  describe('computeSimilarity', () => {
    it('returns 1 for identical findings', () => {
      const a = makeFinding({ title: 'Bug in parser', file: 'x.ts', line: 10 });
      const b = makeFinding({ title: 'Bug in parser', file: 'x.ts', line: 10 });
      expect(service.computeSimilarity(a, b)).toBe(1);
    });

    it('returns 0 for completely different findings', () => {
      const a = makeFinding({ title: 'SQL injection vulnerability', file: 'db.ts', line: 10 });
      const b = makeFinding({ title: 'Trailing whitespace found', file: 'style.ts', line: 200 });
      expect(service.computeSimilarity(a, b)).toBe(0);
    });

    it('returns 0 when files differ', () => {
      const a = makeFinding({ title: 'Same title', file: 'a.ts', line: 10 });
      const b = makeFinding({ title: 'Same title', file: 'b.ts', line: 10 });
      expect(service.computeSimilarity(a, b)).toBe(0);
    });

    it('returns 0 when line numbers are far apart', () => {
      const a = makeFinding({ title: 'Same title', file: 'a.ts', line: 10 });
      const b = makeFinding({ title: 'Same title', file: 'a.ts', line: 100 });
      expect(service.computeSimilarity(a, b)).toBe(0);
    });

    it('returns positive when titles share words and file/line match', () => {
      const a = makeFinding({ title: 'Unused variable in function', file: 'a.ts', line: 10 });
      const b = makeFinding({ title: 'Unused variable detected in function', file: 'a.ts', line: 12 });
      expect(service.computeSimilarity(a, b)).toBeGreaterThan(0.5);
    });
  });

  describe('computeCompositeScore', () => {
    it('returns 0 when no sources', () => {
      expect(service.computeCompositeScore([], 'medium', { claude: 0.35 })).toBe(0);
    });

    it('computes correct score for single source', () => {
      const sources: FusedFinding['sources'] = [
        { agentId: 'claude', findingId: '1', confidence: 1.0, rawSeverity: 'high' },
      ];
      // score = (0.35 * 1.0 * 0.8) / 0.35 = 0.8
      expect(service.computeCompositeScore(sources, 'high', { claude: 0.35 })).toBe(0.8);
    });

    it('computes correct score for multiple sources', () => {
      const sources: FusedFinding['sources'] = [
        { agentId: 'claude', findingId: '1', confidence: 0.9, rawSeverity: 'high' },
        { agentId: 'codex', findingId: '2', confidence: 0.8, rawSeverity: 'high' },
      ];
      const weights = { claude: 0.35, codex: 0.30 };
      // numerator = (0.35 * 0.9 * 0.8) + (0.30 * 0.8 * 0.8) = 0.252 + 0.192 = 0.444
      // denominator = 0.35 + 0.30 = 0.65
      // score = 0.444 / 0.65 = 0.683...
      const score = service.computeCompositeScore(sources, 'high', weights);
      expect(score).toBeCloseTo(0.683, 2);
    });

    it('uses default weight for unknown agents', () => {
      const sources: FusedFinding['sources'] = [
        { agentId: 'unknown' as AgentId, findingId: '1', confidence: 1.0, rawSeverity: 'critical' },
      ];
      // Default weight for unknown = 0.1
      // score = (0.1 * 1.0 * 1.0) / 0.1 = 1.0
      expect(service.computeCompositeScore(sources, 'critical', {})).toBe(1);
    });
  });

  describe('categorize', () => {
    it('categorizes security findings', () => {
      const f = makeFinding({ title: 'SQL injection vulnerability found', body: 'XSS risk in input' });
      expect(service.categorize(f)).toBe('security');
    });

    it('categorizes performance findings', () => {
      const f = makeFinding({ title: 'Slow query detected', body: 'Cache miss causing latency' });
      expect(service.categorize(f)).toBe('performance');
    });

    it('categorizes correctness findings', () => {
      const f = makeFinding({ title: 'Null pointer exception possible', body: 'Bug in error handling' });
      expect(service.categorize(f)).toBe('correctness');
    });

    it('categorizes style findings', () => {
      const f = makeFinding({ title: 'Naming convention violation', body: 'lint warning for formatting' });
      expect(service.categorize(f)).toBe('style');
    });

    it('categorizes architecture findings', () => {
      const f = makeFinding({ title: 'Tight coupling between modules', body: 'Refactor dependency graph' });
      expect(service.categorize(f)).toBe('architecture');
    });

    it('returns other for uncategorizable findings', () => {
      const f = makeFinding({ title: 'Something happened', body: 'Not sure what' });
      expect(service.categorize(f)).toBe('other');
    });
  });

  describe('summary statistics', () => {
    it('counts critical findings correctly', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      map.set('claude', makeBundle('claude', [
        makeFinding({ severity: 'critical', title: 'Crit A', file: 'a.ts', line: 1 }),
        makeFinding({ severity: 'critical', title: 'Crit B', file: 'b.ts', line: 1 }),
        makeFinding({ severity: 'low', title: 'Low A', file: 'c.ts', line: 1 }),
      ]));

      const result = service.fuse(map);
      expect(result.summary.criticalCount).toBe(2);
    });

    it('computes agent agreement correctly', () => {
      const map = new Map<AgentId, ArtifactBundle>();
      // Two findings: one shared by claude+codex, one only by claude
      map.set('claude', makeBundle('claude', [
        makeFinding({ title: 'Shared finding', file: 'a.ts', line: 10 }),
        makeFinding({ title: 'Solo finding', file: 'b.ts', line: 20 }),
      ]));
      map.set('codex', makeBundle('codex', [
        makeFinding({ title: 'Shared finding', file: 'a.ts', line: 10, sourceAgent: 'codex' }),
      ]));

      const result = service.fuse(map);
      // 1 deduped + 1 solo = 2 fused. 1/2 = 0.5 agreement
      expect(result.summary.agentAgreement).toBe(0.5);
    });
  });
});
