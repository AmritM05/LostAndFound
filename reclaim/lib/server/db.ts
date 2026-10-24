import "server-only";
import { neon } from "@neondatabase/serverless";
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}
export async function query<T = Record<string, any>>(
  text: string,
  values: any[] = [],
): Promise<T[]> {
  return (await database().query(text, values)) as T[];
}
