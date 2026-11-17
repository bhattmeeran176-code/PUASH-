import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductNumbers } from '../src/utils/product-validation.js';

test('accepts valid prices, optional MRP and whole-number stock', () => {
  assert.equal(validateProductNumbers('499.50', '', '0'), null);
  assert.equal(validateProductNumbers('499.50', '599', '1000000'), null);
});

test('rejects missing, non-numeric, zero and negative selling prices', () => {
  for (const price of ['', 'abc', '0', '-1', 'Infinity']) {
    assert.equal(validateProductNumbers(price, '', '5'), 'price');
  }
});

test('rejects MRP below selling price or invalid MRP', () => {
  for (const mrp of ['499', 'abc', '-5']) {
    assert.equal(validateProductNumbers('500', mrp, '5'), 'compare');
  }
});

test('rejects fractional, negative and over-limit stock', () => {
  for (const stock of ['-1', '1.5', '1000001', 'abc', '']) {
    assert.equal(validateProductNumbers('500', '', stock), 'stock');
  }
});

test('accepts the exact stock boundaries', () => {
  assert.equal(validateProductNumbers('1', '', '0'), null);
  assert.equal(validateProductNumbers('1', '', '1000000'), null);
});
