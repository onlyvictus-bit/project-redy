import fs from 'node:fs';
import path from 'node:path';

import { WorkbenchConfigSchema } from '@shared/config-schema';
import type { WorkbenchConfig } from '@shared/config-schema';

export class WorkbenchConfigService {
  private config: WorkbenchConfig;
  private readonly configPath: string;

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'workbench-config.json');
    this.config = this.load();
  }

  /**
   * Load config from disk. Validates with zod schema, returns defaults
   * for any missing or invalid fields. Returns full defaults if file
   * is missing or entirely invalid.
   */
  load(): WorkbenchConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        const result = WorkbenchConfigSchema.safeParse(parsed);
        if (result.success) {
          this.config = result.data;
          return this.config;
        }
        // Schema validation failed — log and fall through to defaults
        process.stderr.write(
          `[WorkbenchConfigService] Config validation failed, using defaults: ${result.error.message}\n`
        );
      }
    } catch (err) {
      process.stderr.write(
        `[WorkbenchConfigService] Failed to load config, using defaults: ${String(err)}\n`
      );
    }

    // Return defaults
    this.config = WorkbenchConfigSchema.parse({});
    return this.config;
  }

  /**
   * Deep-merge a partial config update with current config and write to disk.
   */
  save(partial: Partial<WorkbenchConfig>): void {
    const merged = deepMerge(this.config, partial);
    const result = WorkbenchConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new Error(`Invalid config after merge: ${result.error.message}`);
    }
    this.config = result.data;

    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Return the cached in-memory config.
   */
  get(): WorkbenchConfig {
    return this.config;
  }

  /**
   * Reset config to defaults and delete the config file.
   */
  reset(): void {
    this.config = WorkbenchConfigSchema.parse({});
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch {
      // Non-fatal — in-memory state is already reset
    }
  }
}

/**
 * Recursively deep-merge source into target. Arrays are replaced, not merged.
 * Only plain objects are recursed into.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      targetVal !== undefined &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}
