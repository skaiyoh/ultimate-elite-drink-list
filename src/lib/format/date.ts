/**
 * A finished run is read minutes or days later, so it carries the day as well
 * as the time, with a spelled month rather than a numeric form that reads
 * differently by region.
 *
 * `timeZone` exists for tests: left off, this uses the reader's own zone,
 * which is the only correct answer for a device-local app.
 */
const TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
};

export function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { ...TIME, timeZone }).format(ms);
}
