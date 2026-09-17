import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path) {
  const url = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, () => ({}));
  return exports;
}
const { caseStage, failureAction } = load("../src/features/case/caseStage.ts");
const v = (status, viewer_role, available_actions = []) => ({ status, viewer_role, available_actions });

test("stages follow status, role and server actions", () => {
  const cases = [
    [v("DRAFT", "A", ["converse", "submit_statement"]), "a-draft"],
    [v("DRAFT", "A", []), "read-only"],
    [v("DRAFT", "B"), "not-ready"],
    [v("AWAITING_RESPONSE", "A"), "a-sent"],
    [v("AWAITING_RESPONSE", "B", ["choose_response_type"]), "b-respond"],
    [v("AWAITING_RESPONSE", "B", []), "read-only"],
    [v("APOLOGY_DRAFT", "A"), "a-waiting"],
    [v("APOLOGY_DRAFT", "B", ["submit_apology"]), "b-apology"],
    [v("APOLOGY_DRAFT", "B", []), "read-only"],
    [v("COUNTER_DRAFT", "A"), "a-waiting"],
    [v("COUNTER_DRAFT", "B", ["converse", "submit_statement"]), "b-counter"],
    [v("COUNTER_DRAFT", "B", ["converse"]), "read-only"],
    [v("APOLOGY_COMPLETED", "A"), "result-apology"],
    [v("APOLOGY_COMPLETED", "B"), "result-apology"],
    [v("COUNTER_COMPLETED", "A"), "result-counter"],
    [v("COUNTER_COMPLETED", "B"), "result-counter"],
    [v("EXPIRED", "B"), "read-only"],
  ];
  for (const [view, stage] of cases) assert.equal(caseStage(view), stage, JSON.stringify(view));
});
test("B never gets a writing stage from actions meant for another status", () => {
  assert.equal(caseStage(v("AWAITING_RESPONSE", "B", ["submit_apology", "submit_statement"])), "read-only");
  assert.equal(caseStage(v("APOLOGY_DRAFT", "B", ["submit_statement"])), "read-only");
});
test("submit failures: gone, keep draft, or ask the server", () => {
  assert.equal(failureAction(404), "gone");
  assert.equal(failureAction(410), "gone");
  assert.equal(failureAction(403), "keep");
  assert.equal(failureAction(422), "keep");
  for (const status of [0, 409, 500, 502, 503, 504]) assert.equal(failureAction(status), "reconcile");
});
