export function validateProduct(p) {
  if (!p.name?.trim() || p.name.trim().length > 100)
    return "Enter a product name (up to 100 characters).";
  if (!p.brand?.trim() || !p.size?.trim())
    return "Brand and pack size are required.";
  if (
    !Number.isFinite(Number(p.price)) ||
    Number(p.price) <= 0 ||
    Number(p.price) > 100000
  )
    return "Enter a price between ₹0.01 and ₹100,000.";
  if (
    p.stock !== undefined &&
    (!Number.isInteger(Number(p.stock)) || Number(p.stock) < 0)
  )
    return "Stock must be a non-negative whole number.";
  if (
    p.oldPrice &&
    (!Number.isFinite(Number(p.oldPrice)) ||
      Number(p.oldPrice) < Number(p.price))
  )
    return "The original price must be at least the selling price.";
  if (
    p.image &&
    !/^https:\/\//i.test(p.image) &&
    !/^\/products\/[a-z0-9-]+\.webp$/i.test(p.image) &&
    !/^data:image\/(png|jpeg|webp);base64,/.test(p.image)
  )
    return "Use an HTTPS image URL or upload a PNG, JPEG, or WebP image.";
  return "";
}
export function filterProducts(products, category, query, sort) {
  const result = products.filter(
    (p) =>
      p.active !== false &&
      (category === "All essentials" || category === p.category) &&
      `${p.name} ${p.brand} ${p.category}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  if (sort === "low") result.sort((a, b) => a.price - b.price);
  if (sort === "high") result.sort((a, b) => b.price - a.price);
  return result;
}
export function cartTotals(products, cart) {
  const totals = products
    .filter((p) => p.active !== false)
    .reduce(
      (sum, p) => ({
        count: sum.count + (cart[p.id] || 0),
        cents: sum.cents + Math.round(p.price * 100) * (cart[p.id] || 0),
      }),
      { count: 0, cents: 0 },
    );
  return { count: totals.count, subtotal: totals.cents / 100 };
}
