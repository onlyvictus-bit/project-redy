import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkbenchConfigService } from './workbench-config';
import { WorkbenchConfigSchema } from '@shared/config-schema';
import type { WorkbenchConfig } from '@shared/config-schema';

// ---------------------------------------------------------------------------
// Setup — use a temp directory per test
// ---------------------------------------------------------------------------

let tmpDir: string;
let service: WorkbenchConfigService;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-config-test-'));
  service = new WorkbenchConfigService(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const configPath = () => path.join(tmpDir, 'workbench-config.json');

function writeRawConfig(data: unknown): void {
  fs.writeFileSync(configPath(), JSON.stringify(data), 'utf-8');
}

function readRawConfig(): unknown {
  return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkbenchConfigService', () => {
  describe('constructor / load', () => {
    it('returns full defaults when no config file exists', () => {
      const config = service.get();
      const defaults = WorkbenchConfigSchema.parse({});
      expect(config).toEqual(defaults);
    });

    it('loads a valid config from disk', () => {
      const custom: Partial<WorkbenchConfig> = {
        agents: {
          ...WorkbenchConfigSchema.parse({}).agents,
          defaultTimeout: 120_000,
        },
      };
      writeRawConfig(custom);
      const freshService = new WorkbenchConfigService(tmpDir);
      expect(freshService.get().agents.defaultTimeout).toBe(120_000);
    });

    it('falls back to defaults on corrupt JSON', () => {
      fs.writeFileSync(configPath(), '{INVALID-JSON!!!', 'utf-8');
      const freshService = new WorkbenchConfigService(tmpDir);
      const defaults = WorkbenchConfigSchema.parse({});
      expect(freshService.get()).toEqual(defaults);
    });

    it('falls back to defaults when zod validation fails for partial schema', () => {
      // Write something that looks like JSON but has wrong types
      writeRawConfig({ agents: { defaultTimeout: 'not-a-number' } });
      const freshService = new WorkbenchConfigService(tmpDir);
      // Should fall back to defaults since defaultTimeout must be a number
      const defaults = WorkbenchConfigSchema.parse({});
      expect(freshService.get()).toEqual(defaults);
    });
  });

  describe('save', () => {
    it('deep-merges partial config and persists to disk', () => {
      service.save({
        notifications: {
          enabled: false,
          sound: true,
          webhook: { enabled: false, url: '', type: 'generic' },
        },
      });

      expect(service.get().notifications.enabled).toBe(false);
      expect(service.get().notifications.sound).toBe(true);
      // Other sections should remain defaults
      expect(service.get().agents.defaultTimeout).toBe(300_000);

      // Verify written to disk
      const raw = readRawConfig() as WorkbenchConfig;
      expect(raw.notifications.enabled).toBe(false);
    });

    it('preserves existing config when merging new values', () => {
      service.save({ ui: { terminalBufferLines: 10_000, theme: 'dark' } });
      service.save({ ui: { terminalBufferLines: 10_000, theme: 'light' } });

      expect(service.get().ui.theme).toBe('light');
      expect(service.get().ui.terminalBufferLines).toBe(10_000);
    });

    it('creates the directory if it does not exist', () => {
      const nestedDir = path.join(tmpDir, 'nested', 'deep');
      const nestedService = new WorkbenchConfigService(nestedDir);
      nestedService.save({ monitoring: { enabled: false, maxHistoryItems: 1000, slowThresholdMs: 60_000 } });

      expect(fs.existsSync(path.join(nestedDir, 'workbench-config.json'))).toBe(true);
    });
  });

  describe('get', () => {
    it('returns cached config without re-reading disk', () => {
      const before = service.get();
      // Mutate the file behind the service's back
      writeRawConfig({ ...before, ui: { ...before.ui, theme: 'light' } });
      // get() should return cached value, not re-read
      expect(service.get().ui.theme).toBe('dark');
    });
  });

  describe('reset', () => {
    it('resets in-memory config to defaults', () => {
      service.save({ ui: { terminalBufferLines: 99, theme: 'light' } });
      expect(service.get().ui.terminalBufferLines).toBe(99);

      service.reset();
      const defaults = WorkbenchConfigSchema.parse({});
      expect(service.get()).toEqual(defaults);
    });

    it('deletes the config file from disk', () => {
      service.save({ monitoring: { enabled: false, maxHistoryItems: 500, slowThresholdMs: 30_000 } });
      expect(fs.existsSync(configPath())).toBe(true);

      service.reset();
      expect(fs.existsSync(configPath())).toBe(false);
    });

    it('does not throw when config file is already missing', () => {
      expect(() => service.reset()).not.toThrow();
    });
  });

  describe('fusion weights', () => {
    it('has correct default agent weights', () => {
      const weights = service.get().fusion.weights;
      expect(weights.claude).toBe(0.35);
      expect(weights.codex).toBe(0.30);
      expect(weights.gemini).toBe(0.25);
      expect(weights.ollama).toBe(0.10);
    });

    it('allows overriding fusion weights', () => {
      service.save({
        fusion: {
          weights: { claude: 0.5, codex: 0.2, gemini: 0.2, ollama: 0.1 },
          deduplicateThreshold: 0.7,
        },
      });
      expect(service.get().fusion.weights.claude).toBe(0.5);
      expect(service.get().fusion.deduplicateThreshold).toBe(0.7);
    });
  });
});
