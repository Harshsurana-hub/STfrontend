```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportWebVitals } from './reportWebVitals';

describe('reportWebVitals', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    // Remove any sendBeacon stub installed during a test.
    delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
  });

  it('ignores non-core metrics', () => {
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: sendBeacon,
    });
    const fetchSpy = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetchSpy);

    reportWebVitals({ name: 'FCP', value: 5000 } as never);

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('in development', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('logs core metrics via console.info', () => {
      reportWebVitals({ name: 'LCP', value: 1000 } as never);

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns when LCP exceeds 2500ms', () => {
      reportWebVitals({ name: 'LCP', value: 3000 } as never);

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('does not warn when LCP is at the threshold', () => {
      reportWebVitals({ name: 'LCP', value: 2500 } as never);

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns when CLS exceeds 0.1', () => {
      reportWebVitals({ name: 'CLS', value: 0.2 } as never);

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('does not warn when CLS is at the threshold', () => {
      reportWebVitals({ name: 'CLS', value: 0.1 } as never);

      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not send analytics in development', () => {
      const sendBeacon = vi.fn();
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: sendBeacon,
      });
      const fetchSpy = vi.fn().mockResolvedValue({});
      vi.stubGlobal('fetch', fetchSpy);

      reportWebVitals({ name: 'LCP', value: 1000 } as never);

      expect(sendBeacon).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('in production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('sends analytics via navigator.sendBeacon', () => {
      const sendBeacon = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: sendBeacon,
      });
      const fetchSpy = vi.fn().mockResolvedValue({});
      vi.stubGlobal('fetch', fetchSpy);

      reportWebVitals({ name: 'LCP', value: 1000 } as never);

      expect(sendBeacon).toHaveBeenCalledTimes(1);
      const [url, body] = sendBeacon.mock.calls[0];
      expect(url).toBe('/api/analytics/web-vitals');
      expect(body).toBeInstanceOf(Blob);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('falls back to fetch with keepalive when sendBeacon is unavailable', () => {
      delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
      const fetchSpy = vi.fn().mockResolvedValue({});
      vi.stubGlobal('fetch', fetchSpy);

      reportWebVitals({ name: 'LCP', value: 1000 } as never);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/analytics/web-vitals');
      expect(options).toMatchObject({ keepalive: true });
    });

    it('does not log via console.info in production', () => {
      const sendBeacon = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: sendBeacon,
      });

      reportWebVitals({ name: 'LCP', value: 1000 } as never);

      expect(infoSpy).not.toHaveBeenCalled();
    });
  });
});