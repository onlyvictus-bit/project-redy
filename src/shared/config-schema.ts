import { z } from 'zod';

export const WorkbenchConfigSchema = z.object({
  // Agent defaults
  agents: z.object({
    defaultTimeout: z.number().default(300_000), // 5 min
    maxPromptSize: z.number().default(1_048_576), // 1MB
    claude: z.object({
      timeout: z.number().default(300_000),
      permissionMode: z.enum(['acceptEdits', 'plan', 'full']).default('acceptEdits'),
    }).default({}),
    codex: z.object({
      timeout: z.number().default(300_000),
    }).default({}),
    gemini: z.object({
      timeout: z.number().default(300_000),
    }).default({}),
    ollama: z.object({
      autoStart: z.boolean().default(true),
      preferredModel: z.string().default(''),
      endpoint: z.string().default('http://localhost:11434'),
    }).default({}),
  }).default({}),

  // Workflow defaults
  workflows: z.object({
    defaultWorkflow: z.string().default('code-review-fix-verify'),
    autoPromote: z.boolean().default(false),
    dryRunByDefault: z.boolean().default(false),
  }).default({}),

  // Monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    maxHistoryItems: z.number().default(1000),
    slowThresholdMs: z.number().default(60_000), // 1 min
  }).default({}),

  // Notifications
  notifications: z.object({
    enabled: z.boolean().default(true),
    sound: z.boolean().default(false),
    webhook: z.object({
      enabled: z.boolean().default(false),
      url: z.string().default(''),
      type: z.enum(['telegram', 'discord', 'slack', 'generic']).default('generic'),
    }).default({}),
  }).default({}),

  // Findings fusion
  fusion: z.object({
    weights: z.record(z.string(), z.number()).default({
      claude: 0.35,
      codex: 0.30,
      gemini: 0.25,
      ollama: 0.10,
    }),
    deduplicateThreshold: z.number().default(0.8),
  }).default({}),

  // UI
  ui: z.object({
    terminalBufferLines: z.number().default(5000),
    theme: z.enum(['dark', 'light']).default('dark'),
  }).default({}),
});

export type WorkbenchConfig = z.infer<typeof WorkbenchConfigSchema>;
