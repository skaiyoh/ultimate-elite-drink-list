/**
 * History is read at a desk, days or weeks later, so dates carry the year and
 * a spelled month rather than a numeric form that reads differently by region.
 *
 * `timeZone` exists for tests: left off, both formatters use the reader's own
 * zone, which is the only correct answer for a device-local app.
 */
const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: 'numeric', minute: '2-digit' };

export function formatDate(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { ...DATE, timeZone }).format(ms);
}

export function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { ...TIME, timeZone }).format(ms);
}
