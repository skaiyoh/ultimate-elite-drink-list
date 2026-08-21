/**
 * Hands a JSON file to the browser's download flow (spec §5).
 *
 * Returns whether the hand-off happened. An export that quietly does nothing
 * is the worst outcome here: the user believes they have a backup and finds
 * out otherwise only after clearing their browser data.
 */
export function downloadJson(filename: string, data: unknown): boolean {
  let url: string | null = null;

  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    // Never attached to the document: a click on a detached anchor still
    // triggers the download in every browser that supports `download`, and
    // nothing has to be cleaned up out of the DOM afterwards.
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    if (url !== null) URL.revokeObjectURL(url);
  }
}
