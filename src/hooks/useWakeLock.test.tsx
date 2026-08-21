// src/hooks/useWakeLock.test.tsx
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from '@/hooks/useWakeLock';

/** jsdom ships no Wake Lock API, so each test installs exactly the one it needs. */
function installWakeLock(request: () => Promise<{ release(): Promise<void> }>) {
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: vi.fn(request) },
    configurable: true,
    writable: true,
  });
  return (navigator as Navigator & { wakeLock: { request: ReturnType<typeof vi.fn> } }).wakeLock;
}

function removeWakeLock() {
  Reflect.deleteProperty(navigator, 'wakeLock');
}

afterEach(removeWakeLock);

describe('useWakeLock', () => {
  it('asks for nothing while the round is not running', () => {
    const wakeLock = installWakeLock(async () => ({ release: vi.fn(async () => {}) }));
    renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    expect(wakeLock.request).not.toHaveBeenCalled();
  });

  it('holds the screen awake while a round runs', () => {
    const wakeLock = installWakeLock(async () => ({ release: vi.fn(async () => {}) }));
    renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    expect(wakeLock.request).toHaveBeenCalledWith('screen');
  });

  it('releases the lock when the round stops', async () => {
    const release = vi.fn(async () => {});
    installWakeLock(async () => ({ release }));

    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await vi.waitFor(() => expect(release).not.toHaveBeenCalled());
    rerender({ active: false });

    expect(release).toHaveBeenCalled();
  });

  it('releases a lock that only arrives after the round already ended', async () => {
    // The request is async, so the round can end while it is still in flight.
    // Without the cancelled flag the screen would stay awake for good.
    const release = vi.fn(async () => {});
    let grant: (lock: { release(): Promise<void> }) => void = () => {};
    installWakeLock(() => new Promise((resolve) => { grant = resolve; }));

    const { unmount } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    unmount();
    grant({ release });

    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('carries on quietly when the browser refuses', async () => {
    installWakeLock(() => Promise.reject(new Error('denied')));
    const { unmount } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });

    // An unhandled rejection here would fail the run; nothing else to assert,
    // because a refusal is meant to be invisible.
    await vi.waitFor(() => expect(true).toBe(true));
    expect(() => unmount()).not.toThrow();
  });

  it('does nothing at all on a browser without the API', () => {
    removeWakeLock();
    expect(() => {
      renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } }).unmount();
    }).not.toThrow();
  });
});
