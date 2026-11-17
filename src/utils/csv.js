export function quoteCsvCell(value) {
  const raw = String(value ?? '');
  // Spreadsheet apps may execute cells beginning with formula characters.
  // Prefix untrusted text with an apostrophe before CSV quoting.
  const safe = typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(raw)
    ? "'" + raw
    : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
