import { randomUUID } from 'node:crypto';

import type { WorkbenchConfigService } from './workbench-config';
import type {
  AgentId,
  ArtifactBundle,
  Finding,
  FindingCategory,
  FindingSeverity,
  FusedFinding,
  FusionResult,
} from '@shared/types';

// ---------------------------------------------------------------------------
// Severity weights — maps severity to a numeric weight for scoring
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.2,
  info: 0.05,
};

// ---------------------------------------------------------------------------
// Category keywords for auto-categorization
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<FindingCategory, string[]> = {
  security: [
    'xss', 'sql injection', 'injection', 'csrf', 'auth', 'authentication',
    'authorization', 'sanitize', 'escape', 'vulnerability', 'cve', 'secret',
    'credential', 'token', 'password', 'encryption', 'ssrf', 'cors',
  ],
  performance: [
    'performance', 'slow', 'memory', 'leak', 'n+1', 'cache', 'latency',
    'bottleneck', 'optimize', 'benchmark', 'timeout', 'buffer',
  ],
  correctness: [
    'bug', 'error', 'incorrect', 'wrong', 'null', 'undefined', 'crash',
    'exception', 'race condition', 'deadlock', 'logic', 'off-by-one',
    'boundary', 'edge case', 'regression',
  ],
  style: [
    'style', 'naming', 'convention', 'format', 'lint', 'indent',
    'whitespace', 'readability', 'comment', 'documentation', 'typo',
  ],
  architecture: [
    'architecture', 'design', 'pattern', 'coupling', 'cohesion', 'solid',
    'abstraction', 'refactor', 'dependency', 'module', 'interface',
    'separation of concerns',
  ],
  other: [],
};

// ---------------------------------------------------------------------------
// Internal tagged finding — annotated with agent metadata for fusion
// ---------------------------------------------------------------------------

interface TaggedFinding {
  finding: Finding;
  agentId: AgentId;
  findingId: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// FindingsFusionService
// ---------------------------------------------------------------------------

export class FindingsFusionService {
  constructor(private readonly config: WorkbenchConfigService) {}

  /**
   * Fuse findings from multiple agents into a unified, deduplicated, scored list.
   */
  fuse(
    artifactsByAgent: Map<AgentId, ArtifactBundle>,
    agentWeights?: Record<string, number>,
  ): FusionResult {
    const weights = agentWeights ?? this.config.get().fusion.weights;
    const threshold = this.config.get().fusion.deduplicateThreshold;

    // 1. Collect all findings tagged with their source agent
    const tagged: TaggedFinding[] = [];
    for (const [agentId, bundle] of artifactsByAgent) {
      for (const finding of bundle.findings) {
        tagged.push({
          finding,
          agentId,
          findingId: randomUUID(),
          confidence: this.estimateConfidence(finding),
        });
      }
    }

    const totalRaw = tagged.length;

    if (totalRaw === 0) {
      return {
        findings: [],
        summary: {
          totalRaw: 0,
          totalFused: 0,
          deduplicatedCount: 0,
          criticalCount: 0,
          actionRequiredCount: 0,
          agentAgreement: 0,
        },
      };
    }

    // 2. Deduplicate and merge
    const fused = this.deduplicateFindings(tagged, threshold);

    // 3. Compute composite scores and action-required flag
    for (const f of fused) {
      f.compositeScore = this.computeCompositeScore(f.sources, f.severity, weights);
      f.actionRequired = f.compositeScore > 0.5;
    }

    // 4. Sort by composite score descending
    fused.sort((a, b) => b.compositeScore - a.compositeScore);

    // 5. Compute summary
    const deduplicatedCount = totalRaw - fused.length;
    const criticalCount = fused.filter((f) => f.severity === 'critical').length;
    const actionRequiredCount = fused.filter((f) => f.actionRequired).length;

    // Agent agreement: ratio of findings detected by multiple agents
    const multiAgentFindings = fused.filter((f) => f.sources.length > 1).length;
    const agentAgreement = fused.length > 0 ? multiAgentFindings / fused.length : 0;

    return {
      findings: fused,
      summary: {
        totalRaw,
        totalFused: fused.length,
        deduplicatedCount,
        criticalCount,
        actionRequiredCount,
        agentAgreement: Math.round(agentAgreement * 100) / 100,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internal methods
  // -------------------------------------------------------------------------

  /**
   * Normalize a raw severity string to a canonical FindingSeverity.
   */
  normalizeSeverity(raw: string): FindingSeverity {
    const lower = raw.toLowerCase().trim();
    if (lower === 'critical' || lower === 'fatal' || lower === 'blocker') return 'critical';
    if (lower === 'high' || lower === 'major' || lower === 'error') return 'high';
    if (lower === 'medium' || lower === 'moderate' || lower === 'warning' || lower === 'warn') return 'medium';
    if (lower === 'low' || lower === 'minor') return 'low';
    if (lower === 'info' || lower === 'informational' || lower === 'note' || lower === 'suggestion') return 'info';
    return 'medium'; // default fallback
  }

  /**
   * Compute Jaccard similarity between two findings based on title words,
   * exact file path match, and line proximity (within +-5 lines).
   */
  computeSimilarity(a: Finding, b: Finding): number {
    // File path must match (if both have file)
    if (a.file && b.file && a.file !== b.file) return 0;

    // Line proximity check (if both have line numbers)
    if (a.line !== undefined && b.line !== undefined) {
      if (Math.abs(a.line - b.line) > 5) return 0;
    }

    // Jaccard similarity on title words
    const wordsA = new Set(tokenize(a.title));
    const wordsB = new Set(tokenize(b.title));

    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }

    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Deduplicate findings by merging those that are similar enough.
   * Uses greedy clustering: for each tagged finding, try to merge into
   * an existing fused finding cluster.
   */
  private deduplicateFindings(
    tagged: TaggedFinding[],
    threshold: number,
  ): FusedFinding[] {
    const clusters: FusedFinding[] = [];

    for (const t of tagged) {
      let merged = false;

      for (const cluster of clusters) {
        // Build a temporary Finding from the cluster for comparison
        const clusterFinding: Finding = {
          severity: cluster.severity,
          title: cluster.title,
          body: cluster.body,
          file: cluster.file,
          line: cluster.line,
          sourceAgent: cluster.sources[0].agentId,
        };

        const similarity = this.computeSimilarity(t.finding, clusterFinding);
        if (similarity >= threshold) {
          // Merge into this cluster
          cluster.sources.push({
            agentId: t.agentId,
            findingId: t.findingId,
            confidence: t.confidence,
            rawSeverity: t.finding.severity,
          });

          // Take the highest severity
          cluster.severity = higherSeverity(cluster.severity, this.normalizeSeverity(t.finding.severity));
          cluster.deduplicated = true;

          // Merge body if substantially different
          if (t.finding.body && !cluster.body.includes(t.finding.body.slice(0, 50))) {
            cluster.body += `\n\n[${t.agentId}]: ${t.finding.body}`;
          }

          merged = true;
          break;
        }
      }

      if (!merged) {
        // Create new cluster
        clusters.push({
          id: randomUUID(),
          title: t.finding.title,
          body: t.finding.body,
          severity: this.normalizeSeverity(t.finding.severity),
          compositeScore: 0, // computed later
          sources: [
            {
              agentId: t.agentId,
              findingId: t.findingId,
              confidence: t.confidence,
              rawSeverity: t.finding.severity,
            },
          ],
          file: t.finding.file,
          line: t.finding.line,
          category: this.categorize(t.finding),
          deduplicated: false,
          actionRequired: false, // computed later
        });
      }
    }

    return clusters;
  }

  /**
   * Compute the weighted composite score for a fused finding.
   *
   * compositeScore = sum(agentWeight * confidence * severityWeight) / sum(agentWeight)
   */
  computeCompositeScore(
    sources: FusedFinding['sources'],
    severity: FindingSeverity,
    weights: Record<string, number>,
  ): number {
    const sevWeight = SEVERITY_WEIGHTS[severity];

    let numerator = 0;
    let denominator = 0;

    for (const source of sources) {
      const agentWeight = weights[source.agentId] ?? 0.1;
      numerator += agentWeight * source.confidence * sevWeight;
      denominator += agentWeight;
    }

    if (denominator === 0) return 0;
    const score = numerator / denominator;
    return Math.round(score * 1000) / 1000; // 3 decimal places
  }

  /**
   * Auto-categorize a finding based on keyword matching in title and body.
   */
  categorize(finding: Finding): FindingCategory {
    const text = `${finding.title} ${finding.body}`.toLowerCase();

    let bestCategory: FindingCategory = 'other';
    let bestCount = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (category === 'other') continue;
      const count = keywords.filter((kw) => text.includes(kw)).length;
      if (count > bestCount) {
        bestCount = count;
        bestCategory = category as FindingCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Estimate confidence from a finding.
   * Findings with evidence or recommended actions are higher confidence.
   */
  private estimateConfidence(finding: Finding): number {
    let confidence = 0.7; // base
    if (finding.evidence) confidence += 0.15;
    if (finding.recommendedAction) confidence += 0.1;
    if (finding.file) confidence += 0.05;
    return Math.min(confidence, 1.0);
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Tokenize a string into lowercase words, stripping punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Return the higher of two severities.
 */
function higherSeverity(a: FindingSeverity, b: FindingSeverity): FindingSeverity {
  const order: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}
