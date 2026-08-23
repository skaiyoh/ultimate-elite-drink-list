// src/components/drinks/DrinkRow.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DrinkRow } from '@/components/drinks/DrinkRow';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { Drink } from '@/lib/drinks/types';

const drink: Drink = { id: 'seed:margarita', name: 'Margarita', categoryId: 'cocktail', enabled: true };

function renderRow(overrides: Partial<Drink> = {}) {
  const handlers = {
    onRename: vi.fn(), onRecategorize: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn(),
  };
  render(
    <table><tbody>
      <DrinkRow drink={{ ...drink, ...overrides }} categories={SEED_CATEGORIES} {...handlers} />
    </tbody></table>,
  );
  return handlers;
}

describe('DrinkRow', () => {
  it('shows the drink under its own name', () => {
    renderRow();
    expect(screen.getByLabelText('Rename Margarita')).toHaveValue('Margarita');
  });

  it('commits a rename when the field is left', async () => {
    const { onRename } = renderRow();
    const field = screen.getByLabelText('Rename Margarita');
    await userEvent.clear(field);
    await userEvent.type(field, 'Tommys Margarita');
    await userEvent.tab();

    expect(onRename).toHaveBeenCalledWith('seed:margarita', 'Tommys Margarita');
  });

  it('does not commit on every keystroke, which would write storage per letter', async () => {
    const { onRename } = renderRow();
    await userEvent.type(screen.getByLabelText('Rename Margarita'), '!');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('commits a rename on Enter, without needing to click away', async () => {
    const { onRename } = renderRow();
    await userEvent.type(screen.getByLabelText('Rename Margarita'), '!{Enter}');
    expect(onRename).toHaveBeenCalledWith('seed:margarita', 'Margarita!');
  });

  it('moves the drink to another category', async () => {
    const { onRecategorize } = renderRow();
    await userEvent.selectOptions(screen.getByLabelText('Category for Margarita'), 'martini');
    expect(onRecategorize).toHaveBeenCalledWith('seed:margarita', 'martini');
  });

  it('excludes an available drink from drills', async () => {
    const { onToggle } = renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Exclude Margarita' }));
    expect(onToggle).toHaveBeenCalledWith('seed:margarita', false);
  });

  it('puts an excluded drink back in', async () => {
    const { onToggle } = renderRow({ enabled: false });
    await userEvent.click(screen.getByRole('button', { name: 'Include Margarita' }));
    expect(onToggle).toHaveBeenCalledWith('seed:margarita', true);
  });

  it('marks an excluded drink so it reads as unavailable, not just faded', () => {
    renderRow({ enabled: false });
    expect(screen.getByRole('row')).toHaveAttribute('data-enabled', 'false');
  });

  it('deletes on confirmation', async () => {
    const { onDelete } = renderRow();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Margarita' }));
    expect(onDelete).toHaveBeenCalledWith('seed:margarita');
  });

  it('keeps the drink when the confirmation is declined', async () => {
    const { onDelete } = renderRow();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Margarita' }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
