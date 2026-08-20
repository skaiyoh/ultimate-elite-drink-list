import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// Every test starts from an empty device.
beforeEach(() => {
  window.localStorage.clear();
});
