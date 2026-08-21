'use client';
import type { Category, CategoryId, Drink, DrinkId } from '@/lib/drinks/types';
import './drinks.css';

interface DrinkRowProps {
  readonly drink: Drink;
  readonly categories: readonly Category[];
  onRename(id: DrinkId, name: string): void;
  onRecategorize(id: DrinkId, categoryId: CategoryId): void;
  onToggle(id: DrinkId, enabled: boolean): void;
  onDelete(id: DrinkId): void;
}

export function DrinkRow({ drink, categories, onRename, onRecategorize, onToggle, onDelete }: DrinkRowProps) {
  // Committed on blur and on Enter rather than on change: every commit is a
  // localStorage write, and one per keystroke would rewrite the whole list
  // ninety-odd times while someone types a name.
  const commit = (field: HTMLInputElement) => {
    const next = field.value.trim();
    if (next !== '' && next !== drink.name) onRename(drink.id, next);
    else field.value = drink.name;
  };

  return (
    <tr className="drink" data-enabled={drink.enabled}>
      <th scope="row" className="drink__name">
        <input
          // Uncontrolled, keyed by the committed name. The key only changes
          // when a rename lands, so the field remounts with the new value
          // then — and stays untouched while someone is typing into it. A
          // controlled field would need the name mirrored into state and
          // synced back whenever an import rewrites the list underneath.
          key={drink.name}
          className="drink__field"
          aria-label={`Rename ${drink.name}`}
          defaultValue={drink.name}
          onBlur={(event) => commit(event.target)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          }}
        />
      </th>

      <td>
        <select
          className="drink__field"
          aria-label={`Category for ${drink.name}`}
          value={drink.categoryId}
          onChange={(event) => onRecategorize(drink.id, event.target.value as CategoryId)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </td>

      <td className="drink__actions">
        <button type="button" onClick={() => onToggle(drink.id, !drink.enabled)}>
          {drink.enabled ? `86 ${drink.name}` : `Restore ${drink.name}`}
        </button>
        <button
          type="button"
          className="drink__delete"
          onClick={() => {
            // Deleting a seed drink is remembered forever, so it is worth one
            // question rather than an undo that does not exist.
            if (window.confirm(`Delete ${drink.name}?`)) onDelete(drink.id);
          }}
        >
          Delete {drink.name}
        </button>
      </td>
    </tr>
  );
}
