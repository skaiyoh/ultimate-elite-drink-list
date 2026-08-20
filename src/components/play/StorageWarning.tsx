import type { WriteOutcome } from '@/lib/storage/localStore';

export function StorageWarning({ warning }: { warning: Exclude<WriteOutcome, 'ok'> | null }) {
  if (warning === null) return null;

  return (
    <p role="alert">
      {warning === 'quota'
        ? "This device's storage is full — recent rounds may not have been saved."
        : warning === 'invalid'
          ? 'Something went wrong saving this round. Your earlier rounds are safe.'
          : "Local storage is blocked, so this session won't be saved."}
    </p>
  );
}
