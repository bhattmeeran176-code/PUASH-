const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateProductImageFiles(files) {
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'type';
    if (!Number.isFinite(file.size) || file.size < 0 || file.size >= MAX_IMAGE_BYTES) return 'size';
  }
  return null;
}
