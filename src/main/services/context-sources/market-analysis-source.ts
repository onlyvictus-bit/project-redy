/**
 * MarketAnalysisSource -- fetches trend, momentum, and OI signals from OpenAlgo AI endpoints.
 *
 * This is an optional source: if OpenAlgo is not running, available() returns false
 * and the registry silently skips it.
 */

import type { ContextSource, ContextChunk } from '../context-sources';

export class MarketAnalysisSource implements ContextSource {
  readonly id = 'market-analysis';
  readonly name = 'Market Analysis';
  readonly description = 'Trend, momentum, and OI signals from OpenAlgo AI engine';

  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint: string = 'http://localhost:5000', apiKey: string = '') {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  async available(_projectPath: string): Promise<boolean> {
    try {
      const resp = await fetch(`${this.endpoint}/api/v1/agent/status`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = (await resp.json()) as { status?: string };
      return data?.status === 'success';
    } catch {
      return false;
    }
  }

  async fetch(_projectPath: string, query?: string): Promise<ContextChunk[]> {
    if (!query || !this.apiKey) return [];

    const chunks: ContextChunk[] = [];

    // Parse query for symbol (e.g., "RELIANCE NSE" or just "NIFTY")
    const parts = query.trim().split(/\s+/);
    const symbol = parts[0]?.toUpperCase() || '';
    const exchange = parts[1]?.toUpperCase() || 'NSE';

    if (!symbol) return [];

    try {
      // Fetch AI analysis
      const analysisResp = await fetch(`${this.endpoint}/api/v1/agent/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: this.apiKey, symbol, exchange, interval: '1d' }),
        signal: AbortSignal.timeout(30_000),
      });
      const analysis = (await analysisResp.json()) as {
        status?: string;
        data?: {
          signal: string;
          confidence: number;
          score: number;
          regime: string;
          sub_scores: Record<string, number>;
          indicators?: { rsi_14?: number; macd?: number; adx_14?: number };
        };
      };

      if (analysis?.status === 'success' && analysis?.data) {
        const d = analysis.data;
        chunks.push({
          sourceId: this.id,
          title: `AI Signal: ${symbol}`,
          content: [
            `Signal: ${d.signal} | Confidence: ${d.confidence}% | Score: ${d.score} | Regime: ${d.regime}`,
            `Sub-scores: ${JSON.stringify(d.sub_scores)}`,
            `Key indicators: RSI=${d.indicators?.rsi_14}, MACD=${d.indicators?.macd}, ADX=${d.indicators?.adx_14}`,
          ].join('\n'),
          relevance: 0.95,
          metadata: { symbol, exchange, signal: d.signal, confidence: d.confidence },
        });
      }

      // Fetch market analysis report (trend + momentum + OI)
      const marketResp = await fetch(`${this.endpoint}/api/v1/market-analysis/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: this.apiKey, symbol, exchange, interval: '1d' }),
        signal: AbortSignal.timeout(30_000),
      });
      const market = (await marketResp.json()) as {
        status?: string;
        data?: {
          overall_bias: string;
          overall_score: number;
          trend?: {
            direction: string;
            strength: number;
            details?: { adx?: number; ema_alignment?: string };
          };
          momentum?: {
            bias: string;
            score: number;
            details?: { rsi?: number; macd?: string };
          };
          oi?: {
            bias: string;
            pcr_oi?: number;
            max_pain?: number;
          };
        };
      };

      if (market?.status === 'success' && market?.data) {
        const m = market.data;
        const lines: string[] = [
          `Overall: ${m.overall_bias} (score: ${m.overall_score})`,
        ];
        if (m.trend) {
          lines.push(
            `Trend: ${m.trend.direction} (strength: ${m.trend.strength}) — ADX: ${m.trend.details?.adx}, EMA: ${m.trend.details?.ema_alignment}`,
          );
        }
        if (m.momentum) {
          lines.push(
            `Momentum: ${m.momentum.bias} (score: ${m.momentum.score}) — RSI: ${m.momentum.details?.rsi}, MACD: ${m.momentum.details?.macd}`,
          );
        }
        if (m.oi) {
          lines.push(
            `OI: ${m.oi.bias} — PCR: ${m.oi.pcr_oi}, Max Pain: ${m.oi.max_pain}`,
          );
        }

        chunks.push({
          sourceId: this.id,
          title: `Market Analysis: ${symbol}`,
          content: lines.join('\n'),
          relevance: 0.9,
          metadata: { symbol, exchange, bias: m.overall_bias, score: m.overall_score },
        });
      }
    } catch {
      // Non-fatal: market analysis is optional context
    }

    return chunks;
  }
}
