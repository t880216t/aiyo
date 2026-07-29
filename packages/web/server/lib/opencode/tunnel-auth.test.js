import { describe, expect, it } from 'vitest';
import { createTunnelAuth } from './tunnel-auth.js';

describe('tunnel request scope', () => {
  it('does not trust a private Host header from a public peer', () => {
    const controller = createTunnelAuth();
    controller.setActiveTunnel({
      tunnelId: 'tunnel-1',
      mode: 'managed',
      publicUrl: 'https://tunnel.example.com',
    });

    expect(controller.classifyRequestScope({
      headers: { host: '192.168.1.5:57123' },
      socket: { remoteAddress: '203.0.113.10' },
    })).toBe('unknown-public');
  });

  it('allows a loopback host only from a private or loopback peer', () => {
    const controller = createTunnelAuth();
    controller.setActiveTunnel({ tunnelId: 'tunnel-1', mode: 'managed', publicUrl: 'https://tunnel.example.com' });

    expect(controller.classifyRequestScope({
      headers: { host: '127.0.0.1:57123' },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('local');
  });
});
