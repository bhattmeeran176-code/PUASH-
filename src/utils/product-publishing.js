export function validateProductPublishing({ active, categoryId, description, imageSelected }) {
  if (!active) return null;
  if (!String(categoryId || '').trim()) return 'category';
  if (!String(description || '').trim()) return 'description';
  if (!imageSelected) return 'image';
  return null;
}
