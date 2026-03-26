import type { WorkbenchConfigService } from './workbench-config';

// ---------------------------------------------------------------------------
// Webhook payload types
// ---------------------------------------------------------------------------

type WebhookType = 'telegram' | 'discord' | 'slack' | 'generic';

interface NotifyOptions {
  title: string;
  body: string;
  urgency?: 'low' | 'normal' | 'critical';
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export class NotificationService {
  /**
   * Optional Electron Notification constructor injected from main process.
   * We accept it via setter so tests can mock or omit it entirely
   * (Electron APIs are not available in test/renderer contexts).
   */
  private ElectronNotification: (typeof import('electron'))['Notification'] | null = null;

  constructor(private readonly config: WorkbenchConfigService) {}

  /**
   * Inject the Electron Notification class from the main process.
   * Call this once during app initialization:
   *   notificationService.setElectronNotification(Notification);
   */
  setElectronNotification(ctor: typeof import('electron').Notification): void {
    this.ElectronNotification = ctor;
  }

  /**
   * Send a notification via all configured channels.
   */
  async notify(opts: NotifyOptions): Promise<void> {
    const notifConfig = this.config.get().notifications;
    if (!notifConfig.enabled) return;

    // Native Electron notification (non-fatal if Electron not available)
    this.sendElectronNotification(opts.title, opts.body);

    // Optional webhook
    if (notifConfig.webhook.enabled && notifConfig.webhook.url) {
      await this.sendWebhook(opts.title, opts.body);
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private sendElectronNotification(title: string, body: string): void {
    try {
      if (!this.ElectronNotification) return;
      const silent = !this.config.get().notifications.sound;
      const notification = new this.ElectronNotification({ title, body, silent });
      notification.show();
    } catch {
      // Non-fatal — Electron might not be available in all contexts
    }
  }

  private async sendWebhook(title: string, body: string): Promise<void> {
    const { url, type } = this.config.get().notifications.webhook;
    if (!url) return;

    const payload = this.formatPayload(type, title, body);

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-fatal — webhook delivery is best-effort
    }
  }

  private formatPayload(
    type: WebhookType,
    title: string,
    body: string,
  ): Record<string, unknown> {
    switch (type) {
      case 'telegram':
        return { text: `${title}\n${body}` };
      case 'discord':
        return { content: `**${title}**\n${body}` };
      case 'slack':
        return { text: `*${title}*\n${body}` };
      default:
        return { title, body, timestamp: new Date().toISOString() };
    }
  }
}
