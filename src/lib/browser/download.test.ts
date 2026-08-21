import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '@/lib/browser/download';

/** jsdom implements neither of these, so each test installs its own. */
function stubObjectUrl() {
  const createObjectURL = vi.fn(() => 'blob:fake');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));
  return { createObjectURL, revokeObjectURL };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('downloadJson', () => {
  it('offers the file under the name it was given', () => {
    stubObjectUrl();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

    downloadJson('drinks.json', { hello: 'world' });

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('drinks.json');
    expect(clicked[0].href).toBe('blob:fake');
  });

  it('releases the object URL rather than leaking it for the life of the tab', () => {
    const { revokeObjectURL } = stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson('drinks.json', { hello: 'world' });

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('reports a browser that will not make an object URL instead of doing nothing', () => {
    vi.stubGlobal('URL', Object.assign(Object.create(URL), {
      createObjectURL: () => { throw new Error('blocked'); },
      revokeObjectURL: vi.fn(),
    }));

    expect(downloadJson('drinks.json', { hello: 'world' })).toBe(false);
  });

  it('reports success when the download was handed off', () => {
    stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(downloadJson('drinks.json', { hello: 'world' })).toBe(true);
  });

  it('leaves no anchor behind in the document', () => {
    stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson('drinks.json', { hello: 'world' });

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});
