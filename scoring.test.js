import test from "node:test";
import assert from "node:assert/strict";
import { scoreJob } from "./scoring.js";

test("senior in-house VAT role at a SaaS company scores high", () => {
  const r = scoreJob({ title: "Senior VAT Manager", company: "Acme Cloud", description: "Join our SaaS platform. Own VAT, OSS and e-invoicing. Legal background preferred." });
  assert.ok(r.score >= 80, `got ${r.score}`);
  assert.equal(r.category, "In-house");
});

test("law firm tax roles are a good fit, ranked just under in-house", () => {
  const inHouse = scoreJob({ title: "Indirect Tax Manager", company: "Stripe", description: "software" });
  const law = scoreJob({ title: "Tax Associate", company: "Latham & Watkins", description: "Our law firm seeks a JD with 4+ years in transactional tax." });
  const advisory = scoreJob({ title: "Indirect Tax Manager", company: "KPMG LLP", description: "advisory" });
  assert.equal(law.category, "Law firm");
  assert.ok(law.score >= 50, `got ${law.score}`);
  assert.ok(law.score > advisory.score);
  assert.ok(inHouse.score > law.score);
});

test("accounting / advisory roles are still included but ranked lower", () => {
  const r = scoreJob({ title: "Senior Manager, Tax Technology Consulting", company: "Ryan", description: "software" });
  assert.equal(r.category, "Accounting / advisory");
  assert.ok(r.score > 20);
});

test("unrelated roles that only mention tax are dropped", () => {
  assert.equal(scoreJob({ title: "Customer Success Manager", company: "X", description: "tax invoices" }).score, 0);
  assert.ok(scoreJob({ title: "AI Engineer, Manager - Tax Transformation", company: "Deloitte", description: "" }).score < 20);
});

test("junior roles are penalised", () => {
  assert.ok(scoreJob({ title: "Tax Intern", company: "A", description: "" }).score < scoreJob({ title: "Tax Manager", company: "A", description: "" }).score);
});
