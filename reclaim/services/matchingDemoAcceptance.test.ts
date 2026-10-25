// Actual matcher + SQL/save triggers in local PGlite; no network or service fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { assessMatch } from "./matchingService";
import type { Item } from "../lib/types";
const id = (n: number) => `66666666-6666-4666-8666-${String(n).padStart(12, "0")}`;
const base = (type: "lost" | "found", extra = {}): Item => ({
  id: id(type === "lost" ? 10 : 11), reporterId: id(1), type,
  name: "Wireless earbuds", category: "Electronics", brand: "Apple", model: "AirPods Pro 2", color: "White",
  description: "White earbud case in a blue silicone sleeve with a small clip", features: "",
  location: "Unknown", lat: null, lng: null, image: "",
  date: type === "lost" ? "2026-10-24T12:00:00Z" : "2026-10-24T12:15:00Z",
  status: type === "lost" ? "Matching" : "Secured", ...extra,
});
const bag = { name: "Black backpack", category: "Backpack", brand: "", model: "", color: "Black", description: "Black backpack with two zippers and a red fabric loop" };
test("documented A/B/C demo cases agree in TS, SQL and real save-trigger persistence", async t => {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) => (await db.query(sql, values)).rows as any[];
  try {
    const folder = new URL("../db/migrations/", import.meta.url);
    for (const file of (await readdir(folder)).filter(f => f.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, folder), "utf8"));
    for (const [label, lost, found, eligible] of [
      ["A strong candidate", base("lost"), base("found"), true],
      ["B hard brand/model contradiction", base("lost", { name: "AirPods Pro", model: "AirPods Pro" }), base("found", { name: "Galaxy Buds", brand: "Samsung", model: "Galaxy Buds 2" }), false],
      ["C unknown brand remains eligible", base("lost", bag), base("found", { ...bag, brand: "Nike" }), true],
    ] as const) await t.test(label, async () => {
      await db.exec("begin");
      try {
        for (const [n, role] of [[1,"student"],[2,"admin"]]) await q("insert into users(id,email,display_name,role) values($1,$2,'Synthetic',$3)", [id(Number(n)), `demo-${n}@example.test`,role]);
        await q("insert into dropoff_zones(id,name,instructions,active) values($1,'Synthetic desk','Staff instruction',true)",[id(5)]);
        const ts = assessMatch(lost, found);
        const sql = (await q("select evaluate_report_match($1::jsonb,$2::jsonb) a", [JSON.stringify(lost),JSON.stringify(found)]))[0].a;
        assert.equal(ts.eligible, eligible); assert.equal(sql.eligible, eligible);
        assert.equal(sql.classification, ts.classification);
        if (!eligible) { assert.match(sql.contradictions.join(" "), /Brand mismatch/); assert.match(sql.contradictions.join(" "), /Model mismatch/); }
        else assert.equal(sql.classification, "very_strong_match");
        await q("select save_student_report($1,$2::jsonb,'Private synthetic evidence','{}'::uuid[],false)",[id(1),JSON.stringify({...lost,locationKnown:false})]);
        await q("select save_found_report($1,$2::jsonb,'Private synthetic evidence','{}'::uuid[])",[id(2),JSON.stringify({...found,locationKnown:false,receivedAt:"2026-10-24T13:00:00Z",dropoffZoneId:id(5),custodyStatus:"Stored"})]);
        assert.equal((await q("select count(*)::int n from potential_matches where lost_report_id=$1 and found_report_id=$2 and not dismissed",[lost.id,found.id]))[0].n,eligible?1:0);
      } finally { await db.exec("rollback"); }
    });
  } finally { await db.close(); }
});
