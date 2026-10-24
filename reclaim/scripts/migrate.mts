import { readFile } from "node:fs/promises";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { campus } from "../lib/campus";
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL in .env.local before running npm run db:migrate.",
  );
  process.exit(1);
}
try {
  const url = new URL(process.env.DATABASE_URL);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.hostname ||
    url.pathname.length < 2
  )
    throw new Error();
} catch {
  console.error(
    "DATABASE_URL must be the full PostgreSQL connection string, including user, password, host and database. Copy it from Neon Connect.",
  );
  process.exit(1);
}
neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(
    await readFile(
      new URL("../db/migrations/001_student_backend.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(
    `insert into buildings(id,campus_id,name,aliases,latitude,longitude,active)
 select b.id,$2,b.name,coalesce(b.aliases,'{}'),b.lat,b.lng,coalesce(b.active,true)
 from jsonb_to_recordset($1::jsonb) as b(id text,name text,aliases text[],lat float,lng float,active boolean)
 on conflict(id) do update set name=excluded.name,aliases=excluded.aliases,latitude=excluded.latitude,longitude=excluded.longitude,active=excluded.active`,
    [JSON.stringify(campus.locations), campus.id],
  );
  console.log("Neon schema and campus buildings are ready.");
} catch (error) {
  console.error("Migration failed. Check the Neon connection and SQL setup.", {
    code: (error as { code?: string }).code,
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
