import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { products } from "../src/data.js";
import { validateProduct, filterProducts, cartTotals } from "../src/catalog.js";
import {
  validSignature,
  validateCheckout,
  paymentMatches,
} from "../server/security.js";
test("category and search combine; search is case insensitive", () => {
  assert.equal(
    filterProducts(products, "Snacks", "RED APPLES", "featured").length,
    1,
  );
  assert.equal(
    filterProducts(products, "Mixers", "red apples", "featured").length,
    0,
  );
  assert.equal(
    filterProducts(products, "All essentials", "NO MATCH", "featured").length,
    0,
  );
});
test("sorting does not mutate the catalog and hidden products stay hidden", () => {
  const before = products.map((p) => p.id);
  const sorted = filterProducts(
    [...products, { ...products[0], id: "hidden", active: false }],
    "All essentials",
    "",
    "low",
  );
  assert.equal(sorted[0].id, "soda");
  assert.deepEqual(
    products.map((p) => p.id),
    before,
  );
  assert.equal(sorted.length, products.length);
});
test("cart ignores unknown and hidden products; totals use integer currency units", () => {
  assert.deepEqual(
    cartTotals([...products, { id: "hidden", active: false, price: 5 }], {
      orange: 2,
      tonic: 1,
      hidden: 3,
      unknown: 9,
    }),
    { count: 3, subtotal: 255 },
  );
  assert.equal(
    cartTotals(
      [
        { id: "a", price: 0.1 },
        { id: "b", price: 0.2 },
      ],
      { a: 1, b: 1 },
    ).subtotal,
    0.3,
  );
});
test("invalid prices, stock, discounts and unsafe photo protocols are rejected", () => {
  for (const fields of [
    { price: 0 },
    { price: NaN },
    { price: -1 },
    { price: 100001 },
    { stock: -1 },
    { stock: 1.5 },
    { oldPrice: 2 },
    { image: "javascript:alert(1)" },
    { image: "http://example.com/x.jpg" },
  ])
    assert.ok(validateProduct({ ...products[0], ...fields }));
  assert.equal(validateProduct(products[0]), "");
});
test("payment signatures reject tampering and invalid lengths", () => {
  const secret = "unit-test-secret";
  const payload = "order_example|pay_example";
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(validSignature(payload, sig, secret), true);
  assert.equal(validSignature(payload + "x", sig, secret), false);
  assert.equal(validSignature(payload, "a", secret), false);
  assert.equal(validSignature(payload, sig, ""), false);
});
test("checkout rejects invalid quantities, duplicate IDs and outside-area addresses", () => {
  const input = {
    requestKey: "9e96a724-7ccd-4a58-9f33-68485723e49b",
    items: [{ id: "orange", quantity: 2 }],
    address: {
      name: "Test Buyer",
      line: "Test street 123",
      phone: "9999999999",
      pincode: "713409",
    },
  };
  assert.equal(validateCheckout(input, ["713409"]), "");
  for (const items of [
    [],
    [{ id: "orange", quantity: -1 }],
    [{ id: "orange", quantity: 21 }],
    [{ id: "orange", quantity: 1.5 }],
    [...input.items, ...input.items],
  ])
    assert.ok(validateCheckout({ ...input, items }, ["713409"]));
  assert.ok(validateCheckout(input, ["100001"]));
});
test("payment capture must match order, amount and currency", () => {
  const order = {
    razorpay_order_id: "order_123",
    amount: 19000,
    currency: "INR",
  };
  const payment = {
    order_id: "order_123",
    amount: 19000,
    currency: "INR",
    status: "captured",
  };
  assert.equal(paymentMatches(payment, order), true);
  for (const override of [
    { status: "authorized" },
    { amount: 1 },
    { currency: "USD" },
    { order_id: "order_else" },
  ])
    assert.equal(paymentMatches({ ...payment, ...override }, order), false);
});

test('IST operating hours support overnight schedules and manual closure',async()=>{const {openNow}=await import('../server/hours.js');const settings={is_open:true,opens_at:'08:00:00',closes_at:'22:00:00'};assert.equal(openNow(settings,new Date('2026-09-17T02:30:00Z')),true);assert.equal(openNow(settings,new Date('2026-09-17T16:30:00Z')),false);assert.equal(openNow({...settings,is_open:false},new Date('2026-09-17T08:00:00Z')),false);assert.equal(openNow({...settings,opens_at:'22:00',closes_at:'04:00'},new Date('2026-09-17T20:00:00Z')),true);});
