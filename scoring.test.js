import test from "node:test";
import assert from "node:assert/strict";
import { scoreJob } from "./scoring.js";

test("senior in-house VAT role at a SaaS company scores high", () => {
  const r = scoreJob({ title: "Senior VAT Manager", company: "Acme Cloud", description: "Join our SaaS platform. Own VAT, OSS and e-invoicing. Legal background preferred." });
  assert.ok(r.score >= 80, `got ${r.score}`);
  assert.ok(r.inHouse && r.tech);
});

test("Big 4 / advisory roles are ranked below in-house equivalents", () => {
  const inHouse = scoreJob({ title: "VAT Manager", company: "Acme Software", description: "software VAT" });
  const firm = scoreJob({ title: "VAT Manager", company: "KPMG", description: "advisory firm VAT" });
  assert.ok(firm.score < inHouse.score);
  assert.equal(firm.inHouse, false);
});

test("unrelated roles that only mention tax are dropped", () => {
  const r = scoreJob({ title: "Customer Success Manager", company: "X", description: "You will help customers with tax invoices." });
  assert.equal(r.score, 0);
});

test("junior roles are penalised", () => {
  const senior = scoreJob({ title: "VAT Manager", company: "A", description: "" });
  const junior = scoreJob({ title: "VAT Intern", company: "A", description: "" });
  assert.ok(junior.score < senior.score);
});
