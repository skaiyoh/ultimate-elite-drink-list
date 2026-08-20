import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageWarning } from '@/components/play/StorageWarning';

describe('StorageWarning', () => {
  it('renders nothing when there is no warning', () => {
    const { container } = render(<StorageWarning warning={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the device is full for a quota failure', () => {
    render(<StorageWarning warning="quota" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full/i);
  });

  it('says the session will not be saved when storage is blocked', () => {
    render(<StorageWarning warning="unavailable" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/won't be saved/i);
  });

  it('never blames storage for a non-serializable value', () => {
    // 'invalid' is a data-shape bug, not a storage problem. Telling the user
    // their storage is full or blocked would send them to fix the wrong thing.
    render(<StorageWarning warning="invalid" />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toMatch(/full|blocked|storage/i);
    expect(text).toMatch(/earlier rounds are safe/i);
  });
});
