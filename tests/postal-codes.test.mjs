import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostalCodes } from '../src/utils/postal-codes.js';

test('parses comma, whitespace, semicolon and newline separated PINs', () => {
  const result = parsePostalCodes('190001, 190002;190003\n190004');
  assert.deepEqual(result.postalCodes, ['190001', '190002', '190003', '190004']);
  assert.deepEqual(result.invalid, []);
  assert.equal(result.total, 4);
});

test('removes duplicate valid PINs and reports their count', () => {
  const result = parsePostalCodes('190001 190001,190002;190001');
  assert.deepEqual(result.postalCodes, ['190001', '190002']);
  assert.equal(result.duplicates, 2);
});

test('reports malformed entries without silently saving them', () => {
  const result = parsePostalCodes('190001,12345,ABCDEF,1900020');
  assert.deepEqual(result.postalCodes, ['190001']);
  assert.deepEqual(result.invalid, ['12345', 'ABCDEF', '1900020']);
});

test('empty input produces no PIN restrictions', () => {
  assert.deepEqual(parsePostalCodes('  , ;\n '), {
    postalCodes: [], invalid: [], duplicates: 0, total: 0
  });
});
