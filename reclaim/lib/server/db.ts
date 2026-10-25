import "server-only";
import { neon } from "@neondatabase/serverless";
import { ServiceFailure } from "./diagnostics";
export function database() {
  const value = process.env.DATABASE_URL;
  try {
    const url = new URL(value || "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.username ||
      !url.password ||
      !url.hostname.endsWith(".neon.tech") ||
      url.pathname.length < 2
    )
      throw new Error();
  } catch {
    throw new ServiceFailure(
      "database.connect",
      "configuration",
      "Database setup is incomplete. Ask the demo organizer to check the Neon connection.",
    );
  }
  return neon(value!);
}
export async function query<T = Record<string, any>>(
  text: string,
  values: any[] = [],
): Promise<T[]> {
  try {
    return (await database().query(text, values)) as T[];
  } catch (error) {
    if (error instanceof ServiceFailure || (error as any).code === "P0001")
      throw error;
    const code = (error as any).code;
    if (["42P01", "42883", "42703"].includes(code))
      throw new ServiceFailure(
        "database.query",
        "schema",
        "Database setup needs an update. Ask the demo organizer to run the database migrations.",
        code,
      );
    throw new ServiceFailure(
      "database.query",
      "connection",
      "The database is unavailable. Please try again shortly.",
      code,
    );
  }
}
