'use client';
import { DrinkRow } from '@/components/drinks/DrinkRow';
import type { Category, CategoryId, Drink, DrinkId } from '@/lib/drinks/types';
import './drinks.css';

interface DrinkTableProps {
  readonly drinks: readonly Drink[];
  readonly categories: readonly Category[];
  onRename(id: DrinkId, name: string): void;
  onRecategorize(id: DrinkId, categoryId: CategoryId): void;
  onToggle(id: DrinkId, enabled: boolean): void;
  onDelete(id: DrinkId): void;
}

export function DrinkTable({ drinks, categories, ...handlers }: DrinkTableProps) {
  return (
    <>
      {categories.map((category) => {
        const inCategory = drinks.filter((drink) => drink.categoryId === category.id);
        const available = inCategory.filter((drink) => drink.enabled).length;

        return (
          <section className="drinks-group" key={category.id}>
            {/* The available count, not the raw total: an excluded drink is still
                in the list but can never be dealt, and the setup guard counts
                the same way. */}
            <h2>{category.label} · {available} of {inCategory.length} available</h2>

            {inCategory.length === 0 ? (
              <p className="empty">Nothing in {category.label} yet.</p>
            ) : (
              <div className="drinks-scroll">
              <table className="drinks-table" aria-label={category.label}>
                <thead>
                  <tr>
                    <th scope="col">Drink</th>
                    <th scope="col">Category</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {inCategory.map((drink) => (
                    <DrinkRow key={drink.id} drink={drink} categories={categories} {...handlers} />
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
