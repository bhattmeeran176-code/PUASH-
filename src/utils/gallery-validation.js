export function isGalleryWithinLimit(existingCount, newCount, maxCount = 8) {
  return Number.isInteger(existingCount) && Number.isInteger(newCount) && existingCount >= 0 && newCount >= 0 && existingCount + newCount <= maxCount;
}
