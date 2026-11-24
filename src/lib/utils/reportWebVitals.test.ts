import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reportWebVitals } from './reportWebVitals';

describe('reportWebVitals', () => {
  const originalSendBeacon = navigator.sendBeacon;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      configurable: true,
      writable: true,
    });
    globalThis.fetch = originalFetch;
  });

  describe('Non-core metrics gating', () => {
    it('produces no console output and no network call for non-core metrics', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchSpy = vi.fn().mockResolvedValue(new Response());
      globalThis.fetch = fetchSpy;

      reportWebVitals({
        name: 'TTFB',
        value: 300,
        rating: 'good',
      });

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Development environment logging and threshold warnings', () => {
    it('logs console.info for core metrics within acceptable threshold', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      reportWebVitals({
        name: 'LCP',
        value: 2000,
        rating: 'good',
      });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        '[Web Vitals]',
        expect.objectContaining({ name: 'LCP', value: 2000, rating: 'good' }),
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('triggers console.warn when LCP exceeds 2500ms', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      reportWebVitals({
        name: 'LCP',
        value: 2800,
        rating: 'poor',
      });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Web Vitals] Warning: LCP is above threshold (2800ms > 2500ms)'),
        expect.objectContaining({ name: 'LCP', value: 2800, rating: 'poor' }),
      );
    });

    it('triggers console.warn when CLS exceeds 0.1', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      reportWebVitals({
        name: 'CLS',
        value: 0.25,
        rating: 'poor',
      });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Web Vitals] Warning: CLS is above threshold (0.25 > 0.1)'),
        expect.objectContaining({ name: 'CLS', value: 0.25, rating: 'poor' }),
      );
    });

    it('does not send to analytics in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const sendBeaconMock = vi.fn();
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      reportWebVitals({
        name: 'LCP',
        value: 1200,
        rating: 'good',
      });

      expect(sendBeaconMock).not.toHaveBeenCalled();
    });
  });

  describe('Production analytics transmission', () => {
    it('calls navigator.sendBeacon with the analytics endpoint when available', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      reportWebVitals({
        name: 'LCP',
        value: 1500,
        rating: 'good',
      });

      expect(sendBeaconMock).toHaveBeenCalledTimes(1);
      expect(sendBeaconMock).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.any(Blob),
      );
    });

    it('falls back to fetch with keepalive: true when sendBeacon is not available', () => {
      vi.stubEnv('NODE_ENV', 'production');
      // Remove sendBeacon
      // @ts-expect-error test sendBeacon removal
      delete navigator.sendBeacon;

      const fetchMock = vi.fn().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;

      reportWebVitals({
        name: 'INP',
        value: 80,
        rating: 'good',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }),
      );
    });
  });
});
