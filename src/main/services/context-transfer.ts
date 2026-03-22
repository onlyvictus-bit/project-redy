import type { ArtifactBundle, Finding } from '@shared/types';

const DIFF_MAX_BYTES = 50_000; // 50 KB
const SUMMARY_MAX_CHARS = 1_500;

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Truncate a diff that exceeds DIFF_MAX_BYTES.
 * Returns a per-file summary instead of the full patch.
 */
export function compressDiff(diff: string): string {
  if (Buffer.byteLength(diff, 'utf8') <= DIFF_MAX_BYTES) {
    return diff;
  }

  const blocks = diff.split(/^(?=diff --git )/m).filter(Boolean);
  const lines = blocks.map((block) => {
    const header = block.match(/^diff --git a\/(.+?) b\//);
    const file = header ? header[1] : '(unknown)';
    const added = (block.match(/^\+[^+]/mg) ?? []).length;
    const removed = (block.match(/^-[^-]/mg) ?? []).length;
    return `  ${file}: +${added} -${removed}`;
  });

  const sizeKb = Math.round(Buffer.byteLength(diff, 'utf8') / 1024);
  return `[Diff truncated (${sizeKb}KB). Changes by file:\n${lines.join('\n')}\n]`;
}

/**
 * Deduplicate findings by (title, file, line) and sort by descending severity.
 */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings
    .filter((f) => {
      const key = `${f.title.toLowerCase()}|${(f.file ?? '').toLowerCase()}|${f.line ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));
}

/**
 * Build a concise handoff context block from the most recent prior artifacts.
 * Summaries are truncated and findings are deduped + top-5 per artifact.
 */
export function buildHandoffContext(artifacts: ArtifactBundle[]): string {
  if (!artifacts.length) return '';

  const lines: string[] = ['--- Prior agent context ---'];
  for (const artifact of artifacts.slice(0, 3)) {
    const summary =
      artifact.summary.length > SUMMARY_MAX_CHARS
        ? `${artifact.summary.slice(0, SUMMARY_MAX_CHARS)}\u2026`
        : artifact.summary;
    lines.push(`[${artifact.agentId}/${artifact.role}] ${summary}`);

    const top = dedupeFindings(artifact.findings).slice(0, 5);
    for (const f of top) {
      const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : '';
      lines.push(`  \u2022 [${f.severity}] ${f.title}${loc}`);
    }
  }
  lines.push('--- End context ---');
  return lines.join('\n');
}
