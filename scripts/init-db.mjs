import { neon } from "@neondatabase/serverless";
import { existsSync } from "node:fs";
import process from "node:process";

if (
  !process.env.DATABASE_URL &&
  !process.env.MOOD_DATABASE_URL &&
  existsSync(".env.local")
) {
  process.loadEnvFile(".env.local");
}

const databaseUrl = process.env.MOOD_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL or MOOD_DATABASE_URL is not configured");
  process.exit(1);
}

const sql = neon(databaseUrl);

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
