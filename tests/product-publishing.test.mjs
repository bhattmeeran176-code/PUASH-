import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductPublishing } from '../src/utils/product-publishing.js';

const complete = { active: true, categoryId: 'cat-1', description: 'Comfortable everyday shoes', imageSelected: true };

test('allows publishing a complete product', () => {
  assert.equal(validateProductPublishing(complete), null);
});

test('allows incomplete products to remain drafts', () => {
  assert.equal(validateProductPublishing({ active: false, categoryId: '', description: '', imageSelected: false }), null);
});

test('requires a category before publishing', () => {
  assert.equal(validateProductPublishing({ ...complete, categoryId: '  ' }), 'category');
});

test('requires a description before publishing', () => {
  assert.equal(validateProductPublishing({ ...complete, description: '  ' }), 'description');
});

test('requires a main image before publishing', () => {
  assert.equal(validateProductPublishing({ ...complete, imageSelected: false }), 'image');
});
