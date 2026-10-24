import { test } from "node:test";
import assert from "node:assert/strict";
import { matchingFixture as seed } from "./fixtures";
import {
  calculateMatchScore,
  findMatches,
  distanceKm,
} from "./matchingService";
test("automatically ranks the same AirPods above unrelated finds", () => {
  const s = seed(),
    m = findMatches(s.items);
  const a = m.find(
    (m) => m.lostId === "airpods-lost" && m.foundId === "airpods-found",
  );
  assert.ok(a && a.score >= 90);
  assert.ok(
    !m.some((m) => m.lostId === "airpods-lost" && m.foundId === "wallet"),
  );
});
test("distinguishes similar black backpacks using brand and details", () => {
  const s = seed(),
    l = s.items.find((i) => i.id === "bag-lost")!;
  const right = calculateMatchScore(
    l,
    s.items.find((i) => i.id === "bag-found")!,
  );
  const wrong = calculateMatchScore(
    l,
    s.items.find((i) => i.id === "bag-other")!,
  );
  assert.ok(right.score > wrong.score);
});
test("returned items cannot generate new matches and distance is symmetric", () => {
  const s = seed();
  s.items[0].status = "Returned";
  assert.ok(!findMatches(s.items).some((m) => m.lostId === s.items[0].id));
  assert.equal(
    distanceKm(s.items[0], s.items[2]),
    distanceKm(s.items[2], s.items[0]),
  );
});
