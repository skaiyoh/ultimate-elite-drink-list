// src/hooks/useSessionMachine.test.tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionMachine } from '@/hooks/useSessionMachine';
import { defaultSessionConfig } from '@/lib/session/config';
import { createSession } from '@/lib/session/machine';
import { loadActiveSession, loadSession, loadSessionIndex, saveActiveSession } from '@/lib/session/repository';

const START = 1_800_000_000_000;

async function mountWithSession(roundCount: number) {
  const config = { ...defaultSessionConfig(), roundCount };
  saveActiveSession(createSession('s1', 'p1', config, START));
  const rendered = renderHook(() => useSessionMachine());
  await act(async () => {});
  return rendered;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionMachine', () => {
  it('hydrates the stored active session at rest', async () => {
    const { result } = await mountWithSession(2);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.state?.status).toBe('resting');
    expect(result.current.elapsedMs).toBe(0);
  });

  it('deals seven distinct drinks when a round starts', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    const ticket = result.current.state?.current?.ticket ?? [];
    expect(ticket).toHaveLength(7);
    expect(new Set(ticket.map((line) => line.drinkId)).size).toBe(7);
    expect(result.current.state?.status).toBe('running');
  });

  it('records the round duration from wall-clock timestamps', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    vi.setSystemTime(START + 200_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.rounds[0].durationMs).toBe(200_000);
    expect(result.current.state?.status).toBe('resting');
    expect(result.current.averageMs).toBe(200_000);
  });

  it('excludes paused time from the recorded duration', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });

    vi.setSystemTime(START + 50_000);
    await act(async () => { result.current.pause(); });
    vi.setSystemTime(START + 80_000);
    await act(async () => { result.current.resume(); });
    vi.setSystemTime(START + 230_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.rounds[0].durationMs).toBe(200_000);
    expect(result.current.state?.rounds[0].pausedMs).toBe(30_000);
  });

  it('persists progress after every round so a refresh can resume', async () => {
    const { result } = await mountWithSession(2);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 100_000);
    await act(async () => { result.current.advance(); });

    expect(loadActiveSession()?.rounds).toHaveLength(1);
  });

  it('commits the session and clears the active slot on the final round', async () => {
    const { result } = await mountWithSession(1);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 100_000);
    await act(async () => { result.current.advance(); });

    expect(result.current.state?.status).toBe('complete');
    expect(loadSessionIndex('p1')).toEqual(['s1']);
    expect(loadSession('s1')?.rounds).toHaveLength(1);
    expect(loadActiveSession()).toBeNull();
  });

  it('commits an abandoned session with a null completedAt', async () => {
    const { result } = await mountWithSession(5);
    await act(async () => { result.current.startRound(); });
    vi.setSystemTime(START + 30_000);
    await act(async () => { result.current.end(); });

    expect(loadSession('s1')?.completedAt).toBeNull();
    expect(loadSession('s1')?.rounds).toEqual([]);
  });

  it('does nothing when there is no active session', async () => {
    const { result } = renderHook(() => useSessionMachine());
    await act(async () => {});
    expect(result.current.state).toBeNull();
    await act(async () => { result.current.startRound(); });
    expect(result.current.state).toBeNull();
  });
});
