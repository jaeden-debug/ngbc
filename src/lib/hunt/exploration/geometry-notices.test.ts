import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mergeSimplified } from "./geometry-notices.ts";

const QC = "layer:ca-qc-zone-chasse";
const ON = "layer:ca-on-wmu";

test("an outage raises the notice, and the next good answer for that layer clears it", () => {
  const raised = mergeSimplified([], [{ id: QC, status: "PROVIDER_ERROR" }, { id: ON, status: "OK" }]);
  assert.deepEqual(raised, [QC]);
  assert.deepEqual(mergeSimplified(raised, [{ id: QC, status: "OK" }]), []);
});

test("another jurisdiction's answer never clears an outage it did not ask about", () => {
  // A view over Ontario says nothing about Québec's service.
  assert.deepEqual(mergeSimplified([QC], [{ id: ON, status: "OK" }]), [QC]);
});

test("a layer that is still failing keeps its notice, once", () => {
  const once = mergeSimplified([], [{ id: QC, status: "PROVIDER_ERROR" }]);
  assert.deepEqual(mergeSimplified(once, [{ id: QC, status: "PROVIDER_ERROR" }]), [QC]);
});

test("an answer with no layers changes nothing", () => {
  assert.deepEqual(mergeSimplified([QC], undefined), [QC]);
  assert.deepEqual(mergeSimplified([QC], []), [QC]);
});

test("a settled view retries a failed detail request by itself", () => {
  /* Without this, one transient failure was permanent: the failure record
     blocked the next request for a minute, and a map nobody moves never asks
     again, so the notice stayed while the authority was healthy. */
  const source = readFileSync(new URL("../../../components/hunt/map/useZoneGeometry.ts", import.meta.url), "utf8");
  assert.match(source, /scheduleDetailRetry|retryDetail/, "a failed detail request must schedule its own retry");
  assert.match(source, /mergeSimplified\(/, "the notice must be merged per layer, not replaced wholesale");
});
