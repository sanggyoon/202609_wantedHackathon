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
const cardA = () => ({ incident_description: "사건", emotions: [], emotion_reason: "", desired_outcome: "바람" });
const report = () => ({ common_ground: [], different_views: [], hurt_points_a: [], hurt_points_b: [], possible_misunderstanding: null, conversation_starter: "대화" });
const view = (status, extra = {}) => ({
  status, viewer_role: "B", expires_at: expires(), available_actions: [],
  content: { cards: { A: cardA() }, report: null, apology: null }, ...extra,
});
const draftCard = () => ({ ...cardA(), emotions: ["서운함"], sourceMode: "local" });
// POST 경로별로 응답을 정하고 호출 순서를 기록한다.
function route(handlers) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const key = (init.method ?? "GET") + " " + url.replace("/api/cases/" + publicToken, "");
    calls.push(key);
    const handler = handlers[key];
    if (!handler) throw new Error("unexpected " + key);
    return handler(init);
  };
  return calls;
}

test("A statement sends the writer only in the header and strips display fields", async () => {
  route({ "POST /statement": init => {
    assert.equal(init.cache, "no-store");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["X-Writer-Token"], writerToken);
    assert.ok(!init.body.includes(writerToken));
    const body = JSON.parse(init.body);
    assert.equal(body.side, "A");
    assert.equal(body.card.sourceMode, undefined);
    assert.deepEqual(body.card.emotions, ["서운함"]);
    return Response.json(view("AWAITING_RESPONSE", { viewer_role: "A" }));
  } });
  assert.equal((await api.submitStatement(publicToken, "A", draftCard(), writerToken)).status, "AWAITING_RESPONSE");
});
test("B statement never sends a writer header", async () => {
  route({ "POST /statement": init => {
    assert.equal(init.headers["X-Writer-Token"], undefined);
    assert.equal(JSON.parse(init.body).side, "B");
    return Response.json(view("COUNTER_COMPLETED", { content: { cards: { A: cardA(), B: cardA() }, report: report(), apology: null } }));
  } });
  assert.equal((await api.submitStatement(publicToken, "B", draftCard(), writerToken)).status, "COUNTER_COMPLETED");
});
test("B statement waits longer than other writes", async () => {
  const original = AbortSignal.timeout;
  const seen = [];
  AbortSignal.timeout = ms => { seen.push(ms); return original.call(AbortSignal, ms); };
  try {
    route({
      "POST /statement": () => Response.json(view("AWAITING_RESPONSE")),
      "POST /response-type": () => Response.json(view("APOLOGY_DRAFT")),
      "POST /apology": () => Response.json(view("APOLOGY_COMPLETED")),
    });
    await api.submitStatement(publicToken, "B", draftCard(), null);
    await api.submitStatement(publicToken, "A", draftCard(), writerToken);
    await api.chooseResponseType(publicToken, "APOLOGY");
    await api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" });
  } finally { AbortSignal.timeout = original; }
  assert.deepEqual(seen, [60000, 15000, 15000, 15000]);
});
test("response type and apology bodies", async () => {
  route({
    "POST /response-type": init => { assert.deepEqual(JSON.parse(init.body), { response_type: "COUNTER" }); return Response.json(view("COUNTER_DRAFT")); },
    "POST /apology": init => {
      assert.deepEqual(JSON.parse(init.body), { body: "미안해", understood_point: null, admitted_point: "늦었어", future_commitment: null });
      return Response.json(view("APOLOGY_COMPLETED"));
    },
  });
  assert.equal((await api.chooseResponseType(publicToken, "COUNTER")).status, "COUNTER_DRAFT");
  await api.submitApology(publicToken, { body: "미안해", understood_point: "  ", admitted_point: "늦었어", future_commitment: "" });
});
for (const [status, message] of [[403, "작성 권한을 확인하지 못했어요."], [409, "이미 제출된 사건이에요."], [422, "입력을 확인해주세요."], [502, "밤톨이 정리하지 못했어요. 다시 시도해주세요."]])
  test("write HTTP " + status + " becomes a safe typed error", async () => {
    globalThis.fetch = async () => new Response("secret provider detail", { status });
    await assert.rejects(api.submitStatement(publicToken, "B", draftCard(), null), e => e.status === status && e.message === message);
  });
test("write network failure is not retried", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; throw new Error("sensitive"); };
  await assert.rejects(api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" }), e => e.status === 0);
  assert.equal(count, 1);
});
test("writes reject invalid tokens before any request", async () => {
  globalThis.fetch = async () => { throw new Error("must not be called"); };
  await assert.rejects(api.chooseResponseType("../x", "APOLOGY"), e => e.status === 404);
});
test("resume after conflict only for the same pending choice", () => {
  assert.equal(api.canResumeAfterConflict("APOLOGY_DRAFT", "APOLOGY"), true);
  assert.equal(api.canResumeAfterConflict("COUNTER_DRAFT", "COUNTER"), true);
  for (const status of ["COUNTER_DRAFT", "AWAITING_RESPONSE", "APOLOGY_COMPLETED", "COUNTER_COMPLETED", "DRAFT"])
    assert.equal(api.canResumeAfterConflict(status, "APOLOGY"), false);
  assert.equal(api.canResumeAfterConflict("APOLOGY_DRAFT", "COUNTER"), false);
});
test("respond chooses then submits", async () => {
  const calls = route({
    "POST /response-type": () => Response.json(view("APOLOGY_DRAFT")),
    "POST /apology": () => Response.json(view("APOLOGY_COMPLETED")),
  });
  const result = await api.respond(publicToken, "APOLOGY", () => api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" }));
  assert.equal(result.status, "APOLOGY_COMPLETED");
  assert.deepEqual(calls, ["POST /response-type", "POST /apology"]);
});
test("respond resumes when the same choice was already recorded", async () => {
  const calls = route({
    "POST /response-type": () => new Response("", { status: 409 }),
    "GET ": () => Response.json(view("COUNTER_DRAFT")),
    "POST /statement": () => Response.json(view("COUNTER_COMPLETED", { content: { cards: { A: cardA(), B: cardA() }, report: report(), apology: null } })),
  });
  const result = await api.respond(publicToken, "COUNTER", () => api.submitStatement(publicToken, "B", draftCard(), null));
  assert.equal(result.status, "COUNTER_COMPLETED");
  assert.deepEqual(calls, ["POST /response-type", "GET ", "POST /statement"]);
});
test("respond stops when the other choice was recorded", async () => {
  const calls = route({
    "POST /response-type": () => new Response("", { status: 409 }),
    "GET ": () => Response.json(view("COUNTER_DRAFT")),
  });
  await assert.rejects(api.respond(publicToken, "APOLOGY", async () => { throw new Error("must not submit"); }), e => e.status === 409);
  assert.deepEqual(calls, ["POST /response-type", "GET "]);
});
test("respond does not read or submit after other choice errors", async () => {
  const calls = route({ "POST /response-type": () => new Response("", { status: 503 }) });
  await assert.rejects(api.respond(publicToken, "APOLOGY", async () => { throw new Error("must not submit"); }), e => e.status === 503);
  assert.deepEqual(calls, ["POST /response-type"]);
});
