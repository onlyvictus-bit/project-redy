import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbenchConfig } from '@shared/config-schema';
import { WorkbenchConfigSchema } from '@shared/config-schema';

import { ConfigPanel } from './ConfigPanel';

function makeConfig(overrides: Partial<WorkbenchConfig> = {}): WorkbenchConfig {
  const defaults = WorkbenchConfigSchema.parse({});
  return { ...defaults, ...overrides };
}

describe('ConfigPanel', () => {
  let mockLoadConfig: ReturnType<typeof vi.fn>;
  let mockSaveConfig: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLoadConfig = vi.fn();
    mockSaveConfig = vi.fn();
  });

  it('shows loading state then renders config form', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    // Shows loading initially
    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();

    // After data loads, shows form sections
    await waitFor(() => {
      expect(screen.getByText('Agent Timeouts')).toBeInTheDocument();
    });

    expect(screen.getByText('Workflow Defaults')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Fusion Weights')).toBeInTheDocument();
    expect(screen.getByText('UI Preferences')).toBeInTheDocument();
  });

  it('displays default timeout value', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Agent Timeouts')).toBeInTheDocument();
    });

    // Default timeout should be 300000
    const defaultTimeoutInput = screen.getByLabelText('Default timeout (ms)');
    expect(defaultTimeoutInput).toHaveValue(300_000);
  });

  it('calls saveConfig with updated values on save', async () => {
    const config = makeConfig();
    mockLoadConfig.mockResolvedValue(config);
    mockSaveConfig.mockResolvedValue(config);

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Agent Timeouts')).toBeInTheDocument();
    });

    // Click save
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
    });

    // The saved config should be a valid WorkbenchConfig
    const savedArg = mockSaveConfig.mock.calls[0][0];
    expect(savedArg.agents).toBeDefined();
    expect(savedArg.workflows).toBeDefined();
  });

  it('shows saved confirmation after successful save', async () => {
    const config = makeConfig();
    mockLoadConfig.mockResolvedValue(config);
    mockSaveConfig.mockResolvedValue(config);

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Configuration saved.')).toBeInTheDocument();
    });
  });

  it('shows error when save fails', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());
    mockSaveConfig.mockRejectedValue(new Error('Disk write failed'));

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Disk write failed')).toBeInTheDocument();
    });
  });

  it('shows error when loadConfig rejects', async () => {
    mockLoadConfig.mockRejectedValue(new Error('Config not found'));

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Config not found')).toBeInTheDocument();
    });
  });

  it('reset to defaults resets all fields to schema defaults', async () => {
    const customConfig = makeConfig();
    customConfig.agents.defaultTimeout = 600_000;
    mockLoadConfig.mockResolvedValue(customConfig);

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Default timeout (ms)')).toHaveValue(600_000);
    });

    // Click reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    // Should reset to default 300000
    expect(screen.getByLabelText('Default timeout (ms)')).toHaveValue(300_000);
  });

  it('toggles webhook fields visibility', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    // Webhook is disabled by default, so URL field should not be visible
    expect(screen.queryByLabelText('Webhook URL')).not.toBeInTheDocument();

    // Enable webhook
    fireEvent.click(screen.getByLabelText('Webhook enabled'));

    // Now URL and type fields should appear
    expect(screen.getByLabelText('Webhook URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Webhook type')).toBeInTheDocument();
  });

  it('edits a text field', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Default workflow')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Default workflow');
    fireEvent.change(input, { target: { value: 'custom-workflow' } });
    expect(input).toHaveValue('custom-workflow');
  });

  it('edits a checkbox field', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Auto-promote')).toBeInTheDocument();
    });

    const checkbox = screen.getByLabelText('Auto-promote') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('renders fusion weight fields for all agents', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Fusion Weights')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('claude')).toBeInTheDocument();
    expect(screen.getByLabelText('codex')).toBeInTheDocument();
    expect(screen.getByLabelText('gemini')).toBeInTheDocument();
    expect(screen.getByLabelText('ollama')).toBeInTheDocument();
    expect(screen.getByLabelText('Deduplicate threshold')).toBeInTheDocument();
  });

  it('renders theme selector with current value', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig());

    render(<ConfigPanel loadConfig={mockLoadConfig} saveConfig={mockSaveConfig} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    });

    const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement;
    expect(themeSelect.value).toBe('dark');
  });
});
