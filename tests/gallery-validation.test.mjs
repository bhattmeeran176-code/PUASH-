import test from 'node:test';
import assert from 'node:assert/strict';
import { isGalleryWithinLimit } from '../src/utils/gallery-validation.js';

test('allows gallery totals up to eight', () => {
  assert.equal(isGalleryWithinLimit(0, 8), true);
  assert.equal(isGalleryWithinLimit(5, 3), true);
  assert.equal(isGalleryWithinLimit(8, 0), true);
});

test('rejects gallery totals above eight before product save', () => {
  assert.equal(isGalleryWithinLimit(8, 1), false);
  assert.equal(isGalleryWithinLimit(7, 2), false);
});

test('rejects invalid counts', () => {
  assert.equal(isGalleryWithinLimit(-1, 1), false);
  assert.equal(isGalleryWithinLimit(1, 1.5), false);
});
