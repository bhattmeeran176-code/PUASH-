import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductImageFiles } from '../src/utils/product-image-validation.js';

const image = (type = 'image/jpeg', size = 1024) => ({ type, size });

test('accepts supported image formats below five megabytes', () => {
  assert.equal(validateProductImageFiles([image(), image('image/png'), image('image/webp')]), null);
});

test('rejects unsupported image formats', () => {
  assert.equal(validateProductImageFiles([image('image/svg+xml')]), 'type');
});

test('rejects files at or above the five megabyte limit', () => {
  assert.equal(validateProductImageFiles([image('image/jpeg', 5 * 1024 * 1024)]), 'size');
  assert.equal(validateProductImageFiles([image('image/jpeg', 5 * 1024 * 1024 + 1)]), 'size');
});

test('accepts an empty optional image selection', () => {
  assert.equal(validateProductImageFiles([]), null);
});
