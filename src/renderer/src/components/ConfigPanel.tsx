import { useCallback, useEffect, useState } from 'react';

import type { WorkbenchConfig } from '@shared/config-schema';
import { WorkbenchConfigSchema } from '@shared/config-schema';

export interface ConfigPanelProps {
  /** Fetch current config via IPC. */
  loadConfig: () => Promise<WorkbenchConfig>;
  /** Persist updated config via IPC. Returns the saved config. */
  saveConfig: (config: WorkbenchConfig) => Promise<WorkbenchConfig>;
}

const WEBHOOK_TYPES = ['telegram', 'discord', 'slack', 'generic'] as const;
const PERMISSION_MODES = ['acceptEdits', 'plan', 'full'] as const;
const THEMES = ['dark', 'light'] as const;

function cloneConfig(config: WorkbenchConfig): WorkbenchConfig {
  return JSON.parse(JSON.stringify(config)) as WorkbenchConfig;
}

function getDefaults(): WorkbenchConfig {
  return WorkbenchConfigSchema.parse({});
}

export function ConfigPanel({ loadConfig, saveConfig }: ConfigPanelProps) {
  const [config, setConfig] = useState<WorkbenchConfig | null>(null);
  const [draft, setDraft] = useState<WorkbenchConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await loadConfig();
      setConfig(data);
      setDraft(cloneConfig(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadConfig]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const validated = WorkbenchConfigSchema.parse(draft);
      const result = await saveConfig(validated);
      setConfig(result);
      setDraft(cloneConfig(result));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults = getDefaults();
    setDraft(cloneConfig(defaults));
    setSaved(false);
  };

  /** Helper to update a nested path in draft. */
  const update = useCallback(<T,>(path: string[], value: T) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = cloneConfig(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      return next;
    });
    setSaved(false);
  }, []);

  if (loading && !draft) {
    return (
      <section className="card config-panel">
        <h2>Settings</h2>
        <p className="empty-state">Loading configuration...</p>
      </section>
    );
  }

  if (!draft) {
    return (
      <section className="card config-panel">
        <h2>Settings</h2>
        {error ? <p className="config-error">{error}</p> : <p className="empty-state">No configuration loaded.</p>}
      </section>
    );
  }

  return (
    <section className="card config-panel">
      <div className="config-header">
        <h2>Settings</h2>
        <div className="config-actions">
          <button className="config-reset-btn" onClick={handleReset} disabled={saving}>
            Reset to defaults
          </button>
          <button className="config-save-btn" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error ? <p className="config-error">{error}</p> : null}
      {saved ? <p className="config-saved">Configuration saved.</p> : null}

      {/* Agent Timeouts */}
      <fieldset className="config-section">
        <legend>Agent Timeouts</legend>

        <label className="config-field">
          Default timeout (ms)
          <input
            type="number"
            value={draft.agents.defaultTimeout}
            onChange={(e) => update(['agents', 'defaultTimeout'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Claude timeout (ms)
          <input
            type="number"
            value={draft.agents.claude.timeout}
            onChange={(e) => update(['agents', 'claude', 'timeout'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Claude permission mode
          <select
            value={draft.agents.claude.permissionMode}
            onChange={(e) => update(['agents', 'claude', 'permissionMode'], e.target.value)}
          >
            {PERMISSION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="config-field">
          Codex timeout (ms)
          <input
            type="number"
            value={draft.agents.codex.timeout}
            onChange={(e) => update(['agents', 'codex', 'timeout'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Gemini timeout (ms)
          <input
            type="number"
            value={draft.agents.gemini.timeout}
            onChange={(e) => update(['agents', 'gemini', 'timeout'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Ollama auto-start
          <input
            type="checkbox"
            checked={draft.agents.ollama.autoStart}
            onChange={(e) => update(['agents', 'ollama', 'autoStart'], e.target.checked)}
          />
        </label>

        <label className="config-field">
          Ollama preferred model
          <input
            type="text"
            value={draft.agents.ollama.preferredModel}
            onChange={(e) => update(['agents', 'ollama', 'preferredModel'], e.target.value)}
          />
        </label>

        <label className="config-field">
          Ollama endpoint
          <input
            type="text"
            value={draft.agents.ollama.endpoint}
            onChange={(e) => update(['agents', 'ollama', 'endpoint'], e.target.value)}
          />
        </label>
      </fieldset>

      {/* Workflow Defaults */}
      <fieldset className="config-section">
        <legend>Workflow Defaults</legend>

        <label className="config-field">
          Default workflow
          <input
            type="text"
            value={draft.workflows.defaultWorkflow}
            onChange={(e) => update(['workflows', 'defaultWorkflow'], e.target.value)}
          />
        </label>

        <label className="config-field">
          Auto-promote
          <input
            type="checkbox"
            checked={draft.workflows.autoPromote}
            onChange={(e) => update(['workflows', 'autoPromote'], e.target.checked)}
          />
        </label>

        <label className="config-field">
          Dry run by default
          <input
            type="checkbox"
            checked={draft.workflows.dryRunByDefault}
            onChange={(e) => update(['workflows', 'dryRunByDefault'], e.target.checked)}
          />
        </label>
      </fieldset>

      {/* Monitoring */}
      <fieldset className="config-section">
        <legend>Monitoring</legend>

        <label className="config-field">
          Enabled
          <input
            type="checkbox"
            checked={draft.monitoring.enabled}
            onChange={(e) => update(['monitoring', 'enabled'], e.target.checked)}
          />
        </label>

        <label className="config-field">
          Max history items
          <input
            type="number"
            value={draft.monitoring.maxHistoryItems}
            onChange={(e) => update(['monitoring', 'maxHistoryItems'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Slow threshold (ms)
          <input
            type="number"
            value={draft.monitoring.slowThresholdMs}
            onChange={(e) => update(['monitoring', 'slowThresholdMs'], Number(e.target.value))}
          />
        </label>
      </fieldset>

      {/* Notifications */}
      <fieldset className="config-section">
        <legend>Notifications</legend>

        <label className="config-field">
          Enabled
          <input
            type="checkbox"
            checked={draft.notifications.enabled}
            onChange={(e) => update(['notifications', 'enabled'], e.target.checked)}
          />
        </label>

        <label className="config-field">
          Sound
          <input
            type="checkbox"
            checked={draft.notifications.sound}
            onChange={(e) => update(['notifications', 'sound'], e.target.checked)}
          />
        </label>

        <label className="config-field">
          Webhook enabled
          <input
            type="checkbox"
            checked={draft.notifications.webhook.enabled}
            onChange={(e) => update(['notifications', 'webhook', 'enabled'], e.target.checked)}
          />
        </label>

        {draft.notifications.webhook.enabled ? (
          <>
            <label className="config-field">
              Webhook URL
              <input
                type="text"
                value={draft.notifications.webhook.url}
                onChange={(e) => update(['notifications', 'webhook', 'url'], e.target.value)}
              />
            </label>

            <label className="config-field">
              Webhook type
              <select
                value={draft.notifications.webhook.type}
                onChange={(e) => update(['notifications', 'webhook', 'type'], e.target.value)}
              >
                {WEBHOOK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </>
        ) : null}
      </fieldset>

      {/* Fusion Weights */}
      <fieldset className="config-section">
        <legend>Fusion Weights</legend>

        {Object.entries(draft.fusion.weights).map(([agent, weight]) => (
          <label key={agent} className="config-field">
            {agent}
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={weight}
              onChange={(e) => {
                const newWeights = { ...draft.fusion.weights, [agent]: Number(e.target.value) };
                update(['fusion', 'weights'], newWeights);
              }}
            />
          </label>
        ))}

        <label className="config-field">
          Deduplicate threshold
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={draft.fusion.deduplicateThreshold}
            onChange={(e) => update(['fusion', 'deduplicateThreshold'], Number(e.target.value))}
          />
        </label>
      </fieldset>

      {/* UI Preferences */}
      <fieldset className="config-section">
        <legend>UI Preferences</legend>

        <label className="config-field">
          Terminal buffer lines
          <input
            type="number"
            value={draft.ui.terminalBufferLines}
            onChange={(e) => update(['ui', 'terminalBufferLines'], Number(e.target.value))}
          />
        </label>

        <label className="config-field">
          Theme
          <select
            value={draft.ui.theme}
            onChange={(e) => update(['ui', 'theme'], e.target.value)}
          >
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </fieldset>
    </section>
  );
}
