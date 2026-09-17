import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Compile the actual dependency-free adapter; no extra test framework/runtime.
function load(path) {
  const url = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, createRequire(url));
  return exports;
}
const api = load("../src/lib/api/cardSummary.ts");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const card = () => ({
  incident_description: "연락 없이 늦었다", emotions: ["서운함"], emotion_reason: "",
  desired_outcome: "먼저 연락해주기", sourceMode: "openai",
});
const ok = { mode: "openai", cute_charge: "연락두절죄", incident_summary: "연락 없이 늦었다" };
const safe = e => e instanceof api.CardSummaryError && e.message === api.CARD_SUMMARY_FAILED;

test("sends only the shared card, without display-only fields or caching", async () => {
  const input = card();
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/complaint/card-summary");
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers["Content-Type"], "application/json");
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body), ["card"]);
    assert.equal(body.card.sourceMode, undefined);
    assert.equal(body.card.incident_description, "연락 없이 늦었다");
    return Response.json(ok);
  };
  assert.deepEqual(await api.requestCardSummary(input, new AbortController().signal), ok);
  assert.equal(input.sourceMode, "openai");
});
test("extra response fields are dropped", () => {
  assert.deepEqual(api.parseCardSummary({ ...ok, secret: "x" }), ok);
});
test("malformed responses are rejected", () => {
  for (const v of [null, {}, "text", { ...ok, mode: "remote" }, { ...ok, cute_charge: 1 }, { mode: "local", cute_charge: "" }])
    assert.throws(() => api.parseCardSummary(v), safe);
});
for (const status of [422, 500, 502]) test("HTTP " + status + " becomes a safe error", async () => {
  globalThis.fetch = async () => new Response("secret provider detail", { status });
  await assert.rejects(api.requestCardSummary(card(), new AbortController().signal), safe);
});
test("non-JSON success body becomes a safe error", async () => {
  globalThis.fetch = async () => new Response("not json", { status: 200 });
  await assert.rejects(api.requestCardSummary(card(), new AbortController().signal), safe);
});
test("network failure becomes a safe error", async () => {
  globalThis.fetch = async () => { throw new Error("sensitive"); };
  await assert.rejects(api.requestCardSummary(card(), new AbortController().signal), safe);
});
test("abort is preserved", async () => {
  const controller = new AbortController(); controller.abort();
  globalThis.fetch = async (url, init) => { init.signal.throwIfAborted(); };
  await assert.rejects(api.requestCardSummary(card(), controller.signal), e => e.name === "AbortError");
});
