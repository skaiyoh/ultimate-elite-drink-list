import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProfileProvider, useProfiles } from '@/components/profile/ProfileProvider';
import { loadActiveProfileId, loadProfiles } from '@/lib/profiles/repository';

function Harness() {
  const { hydrated, profiles, activeProfile, create, select, remove } = useProfiles();
  if (!hydrated) return <p>loading</p>;
  return (
    <div>
      <p data-testid="active">{activeProfile?.name ?? 'none'}</p>
      <ul>{profiles.map((p) => (
        <li key={p.id}>
          <button onClick={() => select(p.id)}>select {p.name}</button>
          <button onClick={() => remove(p.id)}>remove {p.name}</button>
        </li>
      ))}</ul>
      <button onClick={() => create('Nathan')}>add</button>
      <button onClick={() => create('   ')}>add blank</button>
    </div>
  );
}

const renderHarness = () => render(<ProfileProvider><Harness /></ProfileProvider>);

describe('ProfileProvider', () => {
  it('creates a profile, persists it, and makes it active', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    expect(screen.getByTestId('active')).toHaveTextContent('Nathan');
    expect(loadProfiles()).toHaveLength(1);
    expect(loadActiveProfileId()).toBe(loadProfiles()[0].id);
  });

  it('refuses to create a blank profile', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add blank'));
    expect(loadProfiles()).toEqual([]);
  });

  it('clears the active profile when it is removed', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    await userEvent.click(screen.getByText('remove Nathan'));
    expect(screen.getByTestId('active')).toHaveTextContent('none');
    expect(loadActiveProfileId()).toBeNull();
  });

  it('restores profiles written by a previous visit', async () => {
    renderHarness();
    await userEvent.click(await screen.findByText('add'));
    const first = renderHarness();
    first.unmount();
    renderHarness();
    expect(await screen.findAllByText('select Nathan')).toHaveLength(2);
  });
});
