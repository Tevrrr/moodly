import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  create table if not exists mood_users (
    email text primary key,
    timezone text not null,
    notifications_enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`;

await sql`
  create table if not exists mood_entries (
    id text primary key,
    user_email text not null references mood_users(email) on delete cascade,
    score smallint not null check (score >= 1 and score <= 10),
    note text not null default '',
    hour_key timestamptz not null,
    timezone text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`;

await sql`
  create unique index if not exists mood_entries_user_hour_idx
    on mood_entries (user_email, hour_key)
`;

await sql`
  create index if not exists mood_entries_user_hour_desc_idx
    on mood_entries (user_email, hour_key desc)
`;

console.log("Mood tracker database is ready.");
