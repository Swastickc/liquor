import {
  jest,
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
} from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
const mail = jest.fn(async () => {});
jest.unstable_mockModule("../utils/sendEmail.js", () => ({ default: mail }));
const { default: router } = await import("../grocery/routes.js");
const { Account, LoginCode, Settings, Product, Order, Driver, DeliveryCode } =
  await import("../grocery/models.js");
const { default: User } = await import("../models/userModel.js");
const {
  reserveOrder,
  expireOrders,
  confirmPayment,
  assignDriver,
  completeDelivery,
} = await import("../grocery/service.js");
let repl, app;
const body = () => ({
  requestKey: randomUUID(),
  items: [{ id: "rice", quantity: 2 }],
  address: {
    name: "Test User",
    phone: "9000000000",
    line: "Test street 12",
    pincode: "713409",
  },
});
beforeAll(async () => {
  process.env.JWT_SECRET = "only-for-isolated-automated-tests-32chars";
  process.env.NODE_ENV = "test";
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all(
    [
      Account,
      LoginCode,
      Settings,
      Product,
      Order,
      Driver,
      DeliveryCode,
      User,
    ].map((m) => m.init()),
  );
  app = express();
  app.use("/api/grocery/webhook", express.raw({ type: "application/json" }));
  app.use(express.json(), cookieParser());
  app.use("/api/grocery", router);
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
beforeEach(async () => {
  await Promise.all(
    [
      Account,
      LoginCode,
      Settings,
      Product,
      Order,
      Driver,
      DeliveryCode,
      User,
    ].map((m) => m.deleteMany({})),
  );
  mail.mockClear();
  await Settings.create({
    _id: "store",
    is_open: true,
    opens_at: "00:00",
    closes_at: "00:00",
    delivery_pincodes: ["713409"],
    delivery_fee: 25,
  });
  await Product.create({
    _id: "rice",
    name: "Rice",
    brand: "Test",
    size: "1kg",
    category: "Pantry",
    price: 95,
    stock: 10,
    active: true,
    image: "",
  });
});
async function login(email = "customer@example.test") {
  const agent = request.agent(app);
  await agent.post("/api/grocery/auth/send").send({ email }).expect(200);
  const msg = mail.mock.calls.at(-1)[0].message;
  const token = msg.match(/\b\d{6}\b/)[0];
  await agent
    .post("/api/grocery/auth/verify")
    .send({ email, token })
    .expect(200);
  return agent;
}
test("real Mongo transactions preserve stock and idempotence under simultaneous reservations", async () => {
  const b = body();
  const [a, c] = await Promise.all([
    reserveOrder("customer", b),
    reserveOrder("customer", b),
  ]);
  expect(a.id).toBe(c.id);
  expect(a.amount).toBe(21500);
  expect((await Product.findById("rice")).stock).toBe(8);
  await expect(
    reserveOrder("customer", {
      ...body(),
      items: [{ id: "rice", quantity: 20 }],
    }),
  ).rejects.toThrow();
  expect((await Product.findById("rice")).stock).toBe(8);
});
test("expired stock restores once and late payment is reviewed", async () => {
  const order = await reserveOrder("customer", body());
  await Order.updateOne(
    { _id: order.id },
    { $set: { expires_at: new Date(0) } },
  );
  await expireOrders();
  await expireOrders();
  expect((await Product.findById("rice")).stock).toBe(10);
  expect(await confirmPayment(order.id, "pay_late")).toBe("payment_review");
  expect(await confirmPayment(order.id, "pay_late")).toBe("payment_review");
  await expect(confirmPayment(order.id, "pay_other")).rejects.toThrow(
    "Payment conflict",
  );
});
test("delivery requires approved assignment and rate-limited customer code", async () => {
  const order = await reserveOrder("customer", body());
  await Order.updateOne({ _id: order.id }, { $set: { status: "packing" } });
  await Driver.create({
    _id: "driver",
    name: "Driver",
    phone: "9000000000",
    active: false,
  });
  await expect(assignDriver(order.id, "driver", "123456")).rejects.toThrow(
    "Driver not active",
  );
  await Driver.updateOne({ _id: "driver" }, { $set: { active: true } });
  await assignDriver(order.id, "driver", "123456");
  expect(await completeDelivery(order.id, "stranger", "123456")).toBe(
    "forbidden",
  );
  for (let i = 0; i < 5; i++)
    expect(await completeDelivery(order.id, "driver", "999999")).toBe(
      "invalid_code",
    );
  expect(await completeDelivery(order.id, "driver", "123456")).toBe("locked");
  await DeliveryCode.updateOne(
    { _id: order.id },
    { $set: { locked_until: new Date(0) } },
  );
  expect(await completeDelivery(order.id, "driver", "123456")).toBe(
    "delivered",
  );
  expect(await completeDelivery(order.id, "driver", "123456")).toBe(
    "delivered",
  );
});
test("OTP session cannot read another customer order or edit catalog; logout revokes browser session", async () => {
  const agent = await login();
  const session = await agent.get("/api/grocery/auth/session").expect(200);
  await reserveOrder("another", body());
  expect((await agent.get("/api/grocery/orders").expect(200)).body).toEqual([]);
  await agent.post("/api/grocery/settings").send({}).expect(403);
  await agent.get("/api/grocery/orders?admin=true").expect(403);
  await agent.get("/api/grocery/drivers").expect(200);
  await agent.post("/api/grocery/auth/logout").expect(200);
  await agent.get("/api/grocery/auth/session").expect(401);
  expect(session.body.user.email).toBe("customer@example.test");
});
test("existing owner admin role is reused and only that role can manage products", async () => {
  await User.create({
    name: "Owner",
    email: "owner@example.test",
    password: "testingpassword",
    role: "admin",
    isVerified: true,
  });
  const agent = await login("owner@example.test");
  const p = {
    id: "new-item",
    name: "New rice",
    brand: "Test",
    size: "1kg",
    category: "Pantry",
    price: 70,
    oldPrice: null,
    stock: 3,
    active: true,
    image: "",
  };
  await agent.post("/api/grocery/catalog").send(p).expect(200);
  await agent
    .post("/api/grocery/catalog")
    .send({ ...p, stock: 8, _originalStock: 2 })
    .expect(409);
  await agent
    .post("/api/grocery/catalog")
    .send({ ...p, stock: 8, _originalStock: 3 })
    .expect(200);
  expect((await Product.findById("new-item")).stock).toBe(8);
});

test('checkout verifies the provider order, captured status, signature and webhook before fulfillment',async()=>{
 const originalFetch=global.fetch;process.env.GROCERY_CHECKOUT_ENABLED='true';process.env.RAZORPAY_KEY_ID='rzp_test_fixture';process.env.RAZORPAY_KEY_SECRET='fixture-only';process.env.GROCERY_RAZORPAY_WEBHOOK_SECRET='webhook-fixture';
 const {createHmac}=await import('node:crypto');let providerOrder;let paymentStatus='authorized';
 global.fetch=jest.fn(async(url,options)=>{if(url.endsWith('/orders')){providerOrder=JSON.parse(options.body);return {ok:true,json:async()=>({id:'order_fixture',...providerOrder})};}if(url.endsWith('/payments/pay_fixture'))return {ok:true,json:async()=>({id:'pay_fixture',order_id:'order_fixture',amount:21500,currency:'INR',status:paymentStatus})};throw new Error('Unexpected provider URL');});
 try{
 const customer=await login('checkout@example.test');const b=body();const response=await customer.post('/api/grocery/create-order').send({...b,amount:1}).expect(200);expect(response.body.amount).toBe(21500);expect(providerOrder.amount).toBe(21500);const orderId=response.body.orderId;
 await customer.post('/api/grocery/verify-payment').send({orderId,paymentId:'pay_fixture'}).expect(400);
 const signature=createHmac('sha256','fixture-only').update('order_fixture|pay_fixture').digest('hex');
 await customer.post('/api/grocery/verify-payment').send({orderId,paymentId:'pay_fixture',signature}).expect(409);
 expect((await Order.findById(orderId)).status).toBe('pending');paymentStatus='captured';
 await customer.post('/api/grocery/verify-payment').send({orderId,paymentId:'pay_fixture',signature}).expect(200);
 const event=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_fixture'}}}});
 await request(app).post('/api/grocery/webhook').set('Content-Type','application/json').set('x-razorpay-signature','invalid').send(event).expect(401);
 await request(app).post('/api/grocery/webhook').set('Content-Type','application/json').set('x-razorpay-signature',createHmac('sha256','webhook-fixture').update(event).digest('hex')).send(event).expect(200);
 expect((await Order.findById(orderId)).status).toBe('paid');expect((await Product.findById('rice')).stock).toBe(8);
 }finally{global.fetch=originalFetch;delete process.env.GROCERY_CHECKOUT_ENABLED;delete process.env.RAZORPAY_KEY_ID;delete process.env.RAZORPAY_KEY_SECRET;delete process.env.GROCERY_RAZORPAY_WEBHOOK_SECRET;}
});
