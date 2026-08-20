import type { CDPSession } from 'playwright';
import type { Thresholds } from '../../config/thresholds.js';

/**
 * Applies CDP network + CPU throttling. Must be called on a fresh CDP session
 * BEFORE navigation — order matters, and Network.enable must precede
 * emulateNetworkConditions on some Chromium/CDP versions.
 */
export async function applyThrottling(cdp: CDPSession, throttle: Thresholds['throttle']): Promise<void> {
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttle.network.latencyMs,
    downloadThroughput: throttle.network.downloadBps,
    uploadThroughput: throttle.network.uploadBps,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle.cpuRate });
}
