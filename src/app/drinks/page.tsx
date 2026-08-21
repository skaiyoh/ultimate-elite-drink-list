'use client';
import { useEffect, useState } from 'react';
import { DrinkTable } from '@/components/drinks/DrinkTable';
import { TransferPanel } from '@/components/drinks/TransferPanel';
import { StorageWarning } from '@/components/play/StorageWarning';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import { downloadJson } from '@/lib/browser/download';
import {
  addDrink, deleteDrink, recategorizeDrink, renameDrink, setDrinkEnabled,
} from '@/lib/drinks/edits';
import { loadDrinkList, saveDrinkList } from '@/lib/drinks/repository';
import {
  applyImport, buildExport, exportFilename, type DrinkListFile, type ImportMode,
} from '@/lib/drinks/transfer';
import type { CategoryId, DrinkListState } from '@/lib/drinks/types';
import type { WriteOutcome } from '@/lib/storage/localStore';
import '@/app/history/history.css';
import '@/components/drinks/drinks.css';

export default function DrinksPage() {
  const [state, setState] = useState<DrinkListState | null>(null);
  const [warning, setWarning] = useState<Exclude<WriteOutcome, 'ok'> | null>(null);
  const [exportNudge, setExportNudge] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>(SEED_CATEGORIES[0].id);

  useEffect(() => {
    // Same one-time-after-mount load as every other screen reading storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadDrinkList());
  }, []);

  if (state === null) return <main><p>Loading…</p></main>;

  /** Every edit goes through here, so nothing can change on screen without
   *  also being written — or reporting why it could not be. */
  const commit = (next: DrinkListState) => {
    if (next === state) return;
    setState(next);
    const outcome = saveDrinkList(next);
    setWarning(outcome === 'ok' ? null : outcome);
  };

  const add = () => {
    const next = addDrink(state, crypto.randomUUID(), name, categoryId);
    if (next === state) return;
    commit(next);
    setName('');
  };

  const exportList = () => {
    const now = Date.now();
    // A failed export must not look like a successful one: the whole point of
    // this button is the user believing they have a backup.
    setWarning(downloadJson(exportFilename(now), buildExport(state, now)) ? null : 'unavailable');
    setExportNudge(false);
  };

  const importList = (file: DrinkListFile, mode: ImportMode) => {
    commit(applyImport(state, file, mode));
    setExportNudge(true);
  };

  return (
    <main>
      <StorageWarning warning={warning} />
      <h1>Drinks</h1>
      <p className="lede">
        Edits apply to every profile on this device. Categories are fixed in code; drinks are yours.
      </p>

      <TransferPanel current={state} onExport={exportList} onImport={importList} />

      {exportNudge && (
        <p className="transfer__diff" role="status">
          Imported. Export now if you want a copy of the result.
        </p>
      )}

      <section className="transfer">
        <h2>Add a drink</h2>
        <form
          className="transfer__row"
          onSubmit={(event) => { event.preventDefault(); add(); }}
        >
          <label htmlFor="new-drink">Drink name</label>
          <input id="new-drink" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />

          <label htmlFor="new-drink-category">Category</label>
          <select
            id="new-drink-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value as CategoryId)}
          >
            {SEED_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>

          <button type="submit">Add drink</button>
        </form>
      </section>

      <DrinkTable
        drinks={state.drinks}
        categories={SEED_CATEGORIES}
        onRename={(id, next) => commit(renameDrink(state, id, next))}
        onRecategorize={(id, next) => commit(recategorizeDrink(state, id, next))}
        onToggle={(id, enabled) => commit(setDrinkEnabled(state, id, enabled))}
        onDelete={(id) => commit(deleteDrink(state, id))}
      />
    </main>
  );
}
