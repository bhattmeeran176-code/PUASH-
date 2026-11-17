export function parsePostalCodes(value) {
  const entries = value.split(/[\s,;]+/).map(pin => pin.trim()).filter(Boolean);
  const postalCodes = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;

  for (const pin of entries) {
    if (!/^\d{6}$/.test(pin)) {
      invalid.push(pin);
      continue;
    }
    if (seen.has(pin)) {
      duplicates += 1;
      continue;
    }
    seen.add(pin);
    postalCodes.push(pin);
  }

  return { postalCodes, invalid, duplicates, total: entries.length };
}
