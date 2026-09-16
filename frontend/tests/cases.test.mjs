import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Compile the actual dependency-free adapters; no extra test framework/runtime.
function load(path, mocks = {}) {
  const url = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const require = createRequire(url);
  new Function("exports", "require", compiled)(exports, name => mocks[name] ?? require(name));
  return exports;
}
const api = load("../src/lib/api/cases.ts");
const session = load("../src/features/case/writerSession.ts", { "@/lib/api/cases": api });
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  else delete globalThis.sessionStorage;
});
const publicToken = "p".repeat(43);
const writerToken = "w".repeat(43);
const expires = () => new Date(Date.now() + 86400000).toISOString();
const draft = () => ({ status: "DRAFT", viewer_role: "A", expires_at: expires(), available_actions: ["converse", "submit_statement"], content: null });
const created = () => ({ public_token: publicToken, writer_token: writerToken, expires_at: expires(), status: "DRAFT" });
function storage() {
  const values = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k),
  } });
  return values;
}
test("URL contains only the public token", () => {
  assert.equal(api.casePath(publicToken), "/case/" + publicToken);
  for (const invalid of ["../private", "", publicToken + "?writer=secret"]) assert.throws(() => api.casePath(invalid));
});
test("create uses one POST without retries or caching", async () => {
  let count = 0;
  globalThis.fetch = async (url, init) => {
    count++;
    assert.equal(url, "/api/cases"); assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    return Response.json(created(), { status: 201 });
  };
  assert.equal((await api.createCase()).writer_token, writerToken);
  assert.equal(count, 1);
});
test("writer is sent only in the header, never the URL", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/cases/" + publicToken);
    assert.equal(init.headers["X-Writer-Token"], writerToken);
    assert.equal(init.referrerPolicy, "no-referrer");
    return Response.json(draft());
  };
  assert.equal((await api.readCase(publicToken, writerToken)).viewer_role, "A");
});
test("B read omits writer header", async () => {
  globalThis.fetch = async (url, init) => {
    assert.deepEqual(init.headers, {});
    return Response.json({ ...draft(), viewer_role: "B", available_actions: [] });
  };
  assert.equal((await api.readCase(publicToken, null)).viewer_role, "B");
});
for (const status of [404, 410, 503, 500]) test("HTTP " + status + " becomes a safe typed error", async () => {
  globalThis.fetch = async () => new Response("secret database credentials", { status });
  await assert.rejects(api.readCase(publicToken, null), e => e.status === status && !e.message.includes("secret"));
});
test("network failure does not retry POST", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; throw new Error("sensitive"); };
  await assert.rejects(api.createCase(), e => e.status === 0 && !e.message.includes("sensitive"));
  assert.equal(count, 1);
});
test("abort is preserved", async () => {
  const controller = new AbortController(); controller.abort();
  globalThis.fetch = async (url, init) => { init.signal.throwIfAborted(); };
  await assert.rejects(api.readCase(publicToken, null, controller.signal), e => e.name === "AbortError");
});
test("malformed responses are rejected", () => {
  for (const v of [null, {}, { ...draft(), status: "UNKNOWN" }, { ...draft(), content: {} }, { ...draft(), available_actions: ["delete"] }])
    assert.throws(() => api.parseCaseView(v), e => e.status === 502);
});
test("expired responses never return content even on HTTP 200", () => {
  assert.throws(() => api.parseCaseView({ ...draft(), expires_at: "2000-01-01T00:00:00Z" }), e => e.status === 410);
  assert.throws(() => api.parseCaseView({ ...draft(), status: "EXPIRED" }), e => e.status === 410);
});
test("saved cards and reports are validated", () => {
  const card = { incident_description: "사건", emotions: [], emotion_reason: "", desired_outcome: "바람" };
  const v = { ...draft(), status: "AWAITING_RESPONSE", content: { cards: { A: card }, report: null, apology: null } };
  assert.deepEqual(api.parseCaseView(v), v);
  assert.throws(() => api.parseCaseView({ ...v, content: { ...v.content, cards: { A: { ...card, emotions: 1 } } } }));
});
test("tokens persist across reads; no conversation or entire response is stored", () => {
  const values = storage();
  session.checkWriterStorage();
  session.rememberWriter({ ...created(), privateConversation: "do not save" });
  assert.equal(session.getWriter(publicToken), writerToken);
  assert.equal(values.size, 1);
  assert.deepEqual(JSON.parse([...values.values()][0]), { token: writerToken, expires: JSON.parse([...values.values()][0]).expires });
  session.forgetWriter(publicToken);
  assert.equal(session.getWriter(publicToken), null);
});
test("expired and corrupt credentials are not used", () => {
  const values = storage();
  session.rememberWriter({ ...created(), expires_at: "2000-01-01" });
  assert.equal(session.getWriter(publicToken), null); assert.equal(values.size, 0);
  values.set("bamtol:writer:" + publicToken, "bad json");
  assert.equal(session.getWriter(publicToken), null);
});
test("disabled storage fails preflight but viewing as B remains possible", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  assert.throws(() => session.checkWriterStorage());
  assert.equal(session.getWriter(publicToken), null);
});
