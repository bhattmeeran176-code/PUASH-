export function validateProductNumbers(price, comparePrice, stock) {
  const sellingPrice = Number(price);
  if (!String(price).trim() || !Number.isFinite(sellingPrice) || sellingPrice <= 0) return 'price';

  if (String(comparePrice).trim()) {
    const mrp = Number(comparePrice);
    if (!Number.isFinite(mrp) || mrp < sellingPrice || mrp < 0) return 'compare';
  }

  const quantity = Number(stock);
  if (!String(stock).trim() || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) return 'stock';
  return null;
}
