import { getSql } from "@/lib/db";
import {
  isValidEmail,
  isValidScore,
  isValidTimezone,
  normalizeEmail,
  toHourDate,
} from "@/lib/validation";

type EntryPayload = {
  email?: unknown;
  score?: unknown;
  note?: unknown;
  hourKey?: unknown;
  timezone?: unknown;
};

type EntryRow = {
  id: string;
  userEmail: string;
  score: number;
  note: string;
  hourKey: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

function readPositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const emailValue = url.searchParams.get("email");

  if (!isValidEmail(emailValue)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = normalizeEmail(emailValue);
  const shouldPaginate =
    url.searchParams.has("page") || url.searchParams.has("limit");
  const sql = getSql();

  if (!shouldPaginate) {
    const entries = (await sql`
      select
        id,
        user_email as "userEmail",
        score,
        note,
        hour_key as "hourKey",
        timezone,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from mood_entries
      where user_email = ${email}
        and hour_key >= now() - interval '7 days'
      order by hour_key desc
      limit 168
    `) as unknown as EntryRow[];

    return Response.json({ entries });
  }

  const page = Math.max(readPositiveInteger(url.searchParams.get("page"), 1), 1);
  const pageSize = Math.min(
    readPositiveInteger(url.searchParams.get("limit"), 168),
    168,
  );
  const offset = (page - 1) * pageSize;

  const totals = (await sql`
    select count(*)::int as total
    from mood_entries
    where user_email = ${email}
  `) as unknown as Array<{ total: number }>;

  const entries = (await sql`
    select
      id,
      user_email as "userEmail",
      score,
      note,
      hour_key as "hourKey",
      timezone,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from mood_entries
    where user_email = ${email}
    order by hour_key desc
    limit ${pageSize}
    offset ${offset}
  `) as unknown as EntryRow[];

  const total = totals[0]?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return Response.json({
    entries,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  });
}

export async function POST(request: Request) {
  let payload: EntryPayload;

  try {
    payload = (await request.json()) as EntryPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidEmail(payload.email)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!isValidScore(payload.score)) {
    return Response.json({ error: "Invalid score" }, { status: 400 });
  }

  if (!isValidTimezone(payload.timezone)) {
    return Response.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const hourDate = toHourDate(payload.hourKey);
  if (!hourDate) {
    return Response.json({ error: "Invalid hourKey" }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const sql = getSql();

  await sql`
    insert into mood_users (
      email,
      timezone,
      notifications_enabled,
      created_at,
      updated_at
    )
    values (
      ${email},
      ${payload.timezone},
      false,
      now(),
      now()
    )
    on conflict (email) do update set
      timezone = excluded.timezone,
      updated_at = now()
  `;

  const entries = (await sql`
    insert into mood_entries (
      id,
      user_email,
      score,
      note,
      hour_key,
      timezone,
      created_at,
      updated_at
    )
    values (
      ${crypto.randomUUID()},
      ${email},
      ${payload.score},
      ${note.slice(0, 280)},
      ${hourDate.toISOString()},
      ${payload.timezone},
      now(),
      now()
    )
    on conflict (user_email, hour_key) do update set
      score = excluded.score,
      note = excluded.note,
      timezone = excluded.timezone,
      updated_at = now()
    returning
      id,
      user_email as "userEmail",
      score,
      note,
      hour_key as "hourKey",
      timezone,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `) as unknown as EntryRow[];

  return Response.json({ entry: entries[0] });
}
