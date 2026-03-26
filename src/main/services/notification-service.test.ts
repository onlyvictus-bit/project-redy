import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from './notification-service';
import type { WorkbenchConfigService } from './workbench-config';

// ---------------------------------------------------------------------------
// Mock WorkbenchConfigService
// ---------------------------------------------------------------------------

function makeConfigService(overrides?: {
  enabled?: boolean;
  sound?: boolean;
  webhookEnabled?: boolean;
  webhookUrl?: string;
  webhookType?: 'telegram' | 'discord' | 'slack' | 'generic';
}): WorkbenchConfigService {
  return {
    get: () => ({
      notifications: {
        enabled: overrides?.enabled ?? true,
        sound: overrides?.sound ?? false,
        webhook: {
          enabled: overrides?.webhookEnabled ?? false,
          url: overrides?.webhookUrl ?? '',
          type: overrides?.webhookType ?? 'generic',
        },
      },
    }),
  } as unknown as WorkbenchConfigService;
}

// ---------------------------------------------------------------------------
// Mock Electron Notification
// ---------------------------------------------------------------------------

function makeMockNotificationCtor() {
  const instances: Array<{ title: string; body: string; silent: boolean; shown: boolean }> = [];

  const Ctor = vi.fn().mockImplementation((opts: { title: string; body: string; silent: boolean }) => {
    const instance = { ...opts, shown: false };
    instances.push(instance);
    return {
      show: () => { instance.shown = true; },
    };
  });

  return { Ctor, instances };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('notify (disabled)', () => {
    it('does nothing when notifications are disabled', async () => {
      service = new NotificationService(makeConfigService({ enabled: false }));
      const { Ctor, instances } = makeMockNotificationCtor();
      service.setElectronNotification(Ctor as never);

      await service.notify({ title: 'Test', body: 'Body' });
      expect(instances).toHaveLength(0);
    });
  });

  describe('Electron notifications', () => {
    it('creates and shows an Electron notification', async () => {
      service = new NotificationService(makeConfigService({ enabled: true }));
      const { Ctor, instances } = makeMockNotificationCtor();
      service.setElectronNotification(Ctor as never);

      await service.notify({ title: 'Hello', body: 'World' });
      expect(Ctor).toHaveBeenCalledWith({ title: 'Hello', body: 'World', silent: true });
      expect(instances).toHaveLength(1);
      expect(instances[0].shown).toBe(true);
    });

    it('respects the sound setting', async () => {
      service = new NotificationService(makeConfigService({ enabled: true, sound: true }));
      const { Ctor } = makeMockNotificationCtor();
      service.setElectronNotification(Ctor as never);

      await service.notify({ title: 'Hello', body: 'World' });
      expect(Ctor).toHaveBeenCalledWith({ title: 'Hello', body: 'World', silent: false });
    });

    it('does not throw when Electron Notification is not set', async () => {
      service = new NotificationService(makeConfigService({ enabled: true }));
      // No setElectronNotification called
      await expect(service.notify({ title: 'Hello', body: 'World' })).resolves.toBeUndefined();
    });
  });

  describe('webhook notifications', () => {
    it('sends a generic webhook when enabled', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://hooks.example.com/webhook',
        webhookType: 'generic',
      }));

      await service.notify({ title: 'Build done', body: 'All tests pass' });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://hooks.example.com/webhook');
      expect(opts?.method).toBe('POST');

      const payload = JSON.parse(opts?.body as string);
      expect(payload.title).toBe('Build done');
      expect(payload.body).toBe('All tests pass');
      expect(payload.timestamp).toBeDefined();
    });

    it('formats discord payload correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://discord.com/api/webhooks/123',
        webhookType: 'discord',
      }));

      await service.notify({ title: 'Alert', body: 'Something happened' });

      const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(payload.content).toBe('**Alert**\nSomething happened');
    });

    it('formats slack payload correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://hooks.slack.com/services/123',
        webhookType: 'slack',
      }));

      await service.notify({ title: 'Alert', body: 'Something happened' });

      const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(payload.text).toBe('*Alert*\nSomething happened');
    });

    it('formats telegram payload correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://api.telegram.org/bot123/sendMessage',
        webhookType: 'telegram',
      }));

      await service.notify({ title: 'Alert', body: 'Something happened' });

      const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(payload.text).toBe('Alert\nSomething happened');
    });

    it('does not send webhook when disabled', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: false,
      }));

      await service.notify({ title: 'Test', body: 'Body' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not throw on webhook failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://hooks.example.com/webhook',
      }));

      await expect(
        service.notify({ title: 'Test', body: 'Body' }),
      ).resolves.toBeUndefined();
    });

    it('does not send webhook when URL is empty', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: '',
      }));

      await service.notify({ title: 'Test', body: 'Body' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('combined behavior', () => {
    it('sends both Electron and webhook notifications', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      service = new NotificationService(makeConfigService({
        enabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://hooks.example.com/webhook',
      }));
      const { Ctor, instances } = makeMockNotificationCtor();
      service.setElectronNotification(Ctor as never);

      await service.notify({ title: 'Done', body: 'All good' });

      expect(instances).toHaveLength(1);
      expect(instances[0].shown).toBe(true);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });
});
