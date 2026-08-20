// src/components/ui/StorageBanner.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageBanner } from '@/components/ui/StorageBanner';
import { isPersistent } from '@/lib/storage/localStore';

// vi.mock rather than vi.spyOn: spying on a live ES module export is not
// reliably redefinable, and this test must fail for real reasons only.
vi.mock('@/lib/storage/localStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/localStore')>()),
  isPersistent: vi.fn(() => true),
}));

describe('StorageBanner', () => {
  beforeEach(() => { vi.mocked(isPersistent).mockReturnValue(true); });

  it('says nothing while storage is working', () => {
    render(<StorageBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns that nothing will be saved when storage is unavailable', async () => {
    vi.mocked(isPersistent).mockReturnValue(false);
    render(<StorageBanner />);
    expect(await screen.findByRole('status')).toHaveTextContent(/won't be saved/i);
  });
});
