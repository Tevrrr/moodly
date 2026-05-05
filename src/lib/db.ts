import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.MOOD_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or MOOD_DATABASE_URL is not configured");
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}
