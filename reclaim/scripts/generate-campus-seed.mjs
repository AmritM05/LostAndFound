import { readFile, writeFile } from "node:fs/promises";
const data = JSON.parse(
  await readFile(
    new URL("../lib/campuses/osu-columbus.json", import.meta.url),
    "utf8",
  ),
);
const locations = JSON.stringify(data.locations).replaceAll("'", "''");
const sql = `-- Generated from lib/campuses/osu-columbus.json. No building is approved for intake by this seed.\n-- Does not replace an already configured campus.\nupdate public.campus_settings set name='Ohio State · Columbus',locations='${locations}'::jsonb where id=true and jsonb_array_length(locations)=0;\n`;
await writeFile(
  new URL("../supabase/seed_osu_columbus.sql", import.meta.url),
  sql,
);
