'use client';
import { useId, useState } from 'react';
import {
  diffImport, parseImportFile, type DrinkListFile, type ImportMode,
} from '@/lib/drinks/transfer';
import type { DrinkListState } from '@/lib/drinks/types';
import './drinks.css';

interface TransferPanelProps {
  readonly current: DrinkListState;
  onExport(): void;
  onImport(file: DrinkListFile, mode: ImportMode): void;
}

const MODES: readonly { readonly id: ImportMode; readonly label: string; readonly hint: string }[] = [
  { id: 'replace', label: 'Replace', hint: 'The file becomes the list. Use this to restore a backup.' },
  { id: 'merge', label: 'Merge', hint: 'Keeps what you have; the file wins where ids collide.' },
];

export function TransferPanel({ current, onExport, onImport }: TransferPanelProps) {
  const fileInputId = useId();
  const [pending, setPending] = useState<DrinkListFile | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (file === undefined) return;

    const result = parseImportFile(await file.text());
    if (!result.ok) {
      // Nothing is written and nothing is staged: a refused file leaves the
      // screen exactly as it was, with the reason on it.
      setPending(null);
      setError(result.reason);
      return;
    }

    setError(null);
    setMode('replace');
    setPending(result.file);
  };

  const diff = pending === null ? null : diffImport(current, pending, mode);

  return (
    <section className="transfer" aria-labelledby={`${fileInputId}-heading`}>
      <h2 id={`${fileInputId}-heading`}>Backup and transfer</h2>

      <div className="transfer__row">
        <button type="button" onClick={onExport}>Export drink list</button>
        <label htmlFor={fileInputId}>Import a drink list</label>
        <input
          id={fileInputId}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            // Cleared so choosing the same file twice still fires a change.
            event.target.value = '';
          }}
        />
      </div>

      {error !== null && <p className="transfer__error" role="alert">{error}</p>}

      {pending !== null && diff !== null && (
        <div className="transfer__confirm">
          <p className="transfer__diff">
            {diff.added} added · {diff.changed} changed · {diff.removed} removed
          </p>

          <fieldset className="transfer__modes">
            <legend className="visually-hidden">Import mode</legend>
            {MODES.map((option) => (
              <label key={option.id} title={option.hint}>
                <input
                  type="radio"
                  name="import-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => setMode(option.id)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <p className="transfer__diff">{MODES.find((option) => option.id === mode)?.hint}</p>

          <div className="transfer__row">
            <button type="button" onClick={() => { onImport(pending, mode); setPending(null); }}>
              Apply import
            </button>
            <button type="button" onClick={() => setPending(null)}>Cancel import</button>
          </div>
        </div>
      )}
    </section>
  );
}
