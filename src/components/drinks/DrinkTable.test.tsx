// src/components/drinks/DrinkTable.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrinkTable } from '@/components/drinks/DrinkTable';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { Drink } from '@/lib/drinks/types';

const drinks: Drink[] = [
  { id: 'a', name: 'Margarita', categoryId: 'cocktail', enabled: true },
  { id: 'b', name: 'Negroni', categoryId: 'cocktail', enabled: false },
  { id: 'c', name: 'Cape Cod', categoryId: 'well', enabled: true },
];

const handlers = { onRename: vi.fn(), onRecategorize: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn() };

function renderTable(list: Drink[] = drinks) {
  render(<DrinkTable drinks={list} categories={SEED_CATEGORIES} {...handlers} />);
}

describe('DrinkTable', () => {
  it('files each drink under its own category', () => {
    renderTable();
    // Asserted on each row's rename field rather than on text content: the
    // drink's name is an input value now, not a text node.
    const cocktails = screen.getByRole('table', { name: /Cocktails/ });
    expect(within(cocktails).getByLabelText('Rename Margarita')).toBeInTheDocument();
    expect(within(cocktails).queryByLabelText('Rename Cape Cod')).not.toBeInTheDocument();
  });

  it('counts what a round can actually be dealt from, not the raw total', () => {
    renderTable();
    // Two cocktails exist but one is excluded, so only one is available.
    expect(screen.getByRole('heading', { name: /Cocktails/ })).toHaveTextContent('1 of 2 available');
  });

  it('still lists a category with nothing in it, so it is clear it is empty', () => {
    renderTable();
    expect(screen.getByRole('heading', { name: /Martinis/ })).toBeInTheDocument();
    expect(screen.getByText('Nothing in Martinis yet.')).toBeInTheDocument();
  });

  it('keeps every category from the compiled union, not just the ones in use', () => {
    renderTable([]);
    for (const category of SEED_CATEGORIES) {
      expect(screen.getByRole('heading', { name: new RegExp(category.label) })).toBeInTheDocument();
    }
  });
});
