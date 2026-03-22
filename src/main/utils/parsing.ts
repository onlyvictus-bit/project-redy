import { normalizeLineEndings } from './path-mapping';

import type { AgentId, Finding, ParsedTriadPayload } from '@shared/types';

const TRIAD_JSON_REGEX = /<triad-json>([\s\S]*?)<\/triad-json>/i;
const FENCED_JSON_REGEX = /```json\s*([\s\S]*?)```/i;
const DIFF_REGEX = /(diff --git[\s\S]*$|--- [\s\S]*?\n\+\+\+ [\s\S]*$)/m;

export function parseJsonLines(input: string): unknown[] {
  return normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

export function extractTriadPayload(input: string, sourceAgent: AgentId): ParsedTriadPayload {
  const normalized = normalizeLineEndings(input);
  const matched = normalized.match(TRIAD_JSON_REGEX) ?? normalized.match(FENCED_JSON_REGEX);

  if (!matched) {
    return {
      summary: normalized.trim().slice(0, 2000),
      findings: extractFindingsFromPlainText(normalized, sourceAgent)
    };
  }

  try {
    const parsed = JSON.parse(matched[1]) as Partial<ParsedTriadPayload>;

    return {
      summary: parsed.summary ?? '',
      findings: (parsed.findings ?? []).map((finding) => ({
        sourceAgent,
        severity: finding.severity ?? 'info',
        title: finding.title ?? 'Finding',
        body: finding.body ?? '',
        file: finding.file,
        line: finding.line,
        evidence: finding.evidence,
        recommendedAction: finding.recommendedAction
      })),
      recommendedRole: parsed.recommendedRole,
      notes: parsed.notes ?? []
    };
  } catch {
    return {
      summary: normalized.trim().slice(0, 2000),
      findings: extractFindingsFromPlainText(normalized, sourceAgent)
    };
  }
}

export function extractFindingsFromPlainText(input: string, sourceAgent: AgentId): Finding[] {
  const lines = normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => line.startsWith('-') || line.startsWith('*'))
    .slice(0, 20)
    .map((line) => ({
      sourceAgent,
      severity: classifySeverity(line),
      title: line.replace(/^[-*]\s*/, '').slice(0, 120),
      body: line.replace(/^[-*]\s*/, '')
    }));
}

function classifySeverity(line: string): Finding['severity'] {
  const lower = line.toLowerCase();
  if (lower.includes('critical')) {
    return 'critical';
  }
  if (lower.includes('high') || lower.includes('security')) {
    return 'high';
  }
  if (lower.includes('medium') || lower.includes('bug')) {
    return 'medium';
  }
  if (lower.includes('low') || lower.includes('style')) {
    return 'low';
  }
  return 'info';
}

export function extractPatch(input: string): string | undefined {
  return normalizeLineEndings(input).match(DIFF_REGEX)?.[1];
}

export function summarizeText(input: string): string {
  return normalizeLineEndings(input)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(' ')
    .slice(0, 500);
}
