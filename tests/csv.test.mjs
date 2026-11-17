import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteCsvCell } from '../src/utils/csv.js';

test('quotes ordinary text and escapes embedded quotes', () => {
  assert.equal(quoteCsvCell('Kashmir, "Valley"'), '"Kashmir, ""Valley"""');
});

test('neutralises spreadsheet formula prefixes in untrusted text', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@SUM(A1)', ' \t=cmd']) {
    assert.equal(quoteCsvCell(value), '"' + "'" + value.replace(/"/g, '""') + '"');
  }
});

test('preserves ordinary strings and numeric values', () => {
  assert.equal(quoteCsvCell('COD'), '"COD"');
  assert.equal(quoteCsvCell(125), '"125"');
  assert.equal(quoteCsvCell(null), '""');
});
