// src/components/drinks/TransferPanel.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransferPanel } from '@/components/drinks/TransferPanel';
import { DRINKS_SCHEMA_VERSION } from '@/lib/drinks/schema';
import { buildExport } from '@/lib/drinks/transfer';
import type { DrinkListState } from '@/lib/drinks/types';

const current: DrinkListState = {
  schemaVersion: DRINKS_SCHEMA_VERSION,
  seedVersion: 1,
  drinks: [
    { id: 'seed:margarita', name: 'Margarita', categoryId: 'cocktail', enabled: true },
    { id: 'custom-1', name: 'House Punch', categoryId: 'well', enabled: true },
  ],
  removedSeedIds: [],
};

/** A file that renames one drink, adds one, and omits one. */
const incoming = buildExport({
  ...current,
  drinks: [
    { id: 'seed:margarita', name: 'Tommys Margarita', categoryId: 'cocktail', enabled: true },
    { id: 'custom-9', name: 'Paloma', categoryId: 'cocktail', enabled: true },
  ],
}, 0);

function upload(text: string) {
  return userEvent.upload(
    screen.getByLabelText('Import a drink list'),
    new File([text], 'drinks.json', { type: 'application/json' }),
  );
}

function renderPanel() {
  const onExport = vi.fn();
  const onImport = vi.fn();
  render(<TransferPanel current={current} onExport={onExport} onImport={onImport} />);
  return { onExport, onImport };
}

describe('TransferPanel', () => {
  it('exports on request', async () => {
    const { onExport } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Export drink list' }));
    expect(onExport).toHaveBeenCalled();
  });

  it('previews what a chosen file would change before anything is written', async () => {
    renderPanel();
    await upload(JSON.stringify(incoming));
    expect(await screen.findByText(/1 added/)).toHaveTextContent('1 added · 1 changed · 1 removed');
  });

  it('writes nothing until the import is confirmed', async () => {
    const { onImport } = renderPanel();
    await upload(JSON.stringify(incoming));
    await screen.findByText(/1 added/);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('defaults to replace, the backup-restore case', async () => {
    renderPanel();
    await upload(JSON.stringify(incoming));
    expect(await screen.findByRole('radio', { name: 'Replace' })).toBeChecked();
  });

  it('recounts when switching to merge, which never removes', async () => {
    renderPanel();
    await upload(JSON.stringify(incoming));
    await userEvent.click(await screen.findByRole('radio', { name: 'Merge' }));
    expect(screen.getByText(/1 added/)).toHaveTextContent('1 added · 1 changed · 0 removed');
  });

  it('applies the file in the chosen mode', async () => {
    const { onImport } = renderPanel();
    await upload(JSON.stringify(incoming));
    await userEvent.click(await screen.findByRole('radio', { name: 'Merge' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply import' }));

    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ueddl.drink-list' }), 'merge');
  });

  it('names what is wrong with a bad file instead of failing vaguely', async () => {
    renderPanel();
    await upload('not json at all {');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
  });

  it('offers no confirmation for a file it refused', async () => {
    renderPanel();
    await upload('not json at all {');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Apply import' })).not.toBeInTheDocument();
  });

  it('names the offending category when a file carries an unknown one', async () => {
    renderPanel();
    await upload(JSON.stringify({ ...incoming, drinks: [{ id: 'x', name: 'X', categoryId: 'tiki', enabled: true }] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('tiki');
  });

  it('drops the pending import on cancel', async () => {
    renderPanel();
    await upload(JSON.stringify(incoming));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel import' }));
    expect(screen.queryByRole('button', { name: 'Apply import' })).not.toBeInTheDocument();
  });

  it('clears a previous error once a good file is chosen', async () => {
    renderPanel();
    await upload('not json at all {');
    await screen.findByRole('alert');
    await upload(JSON.stringify(incoming));

    await screen.findByText(/1 added/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
