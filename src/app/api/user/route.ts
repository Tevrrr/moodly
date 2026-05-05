import { getSql } from "@/lib/db";
import { isValidEmail, isValidTimezone, normalizeEmail } from "@/lib/validation";

type UserPayload = {
  email?: unknown;
  timezone?: unknown;
  notificationsEnabled?: unknown;
};

type UserRow = {
  email: string;
  timezone: string;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function POST(request: Request) {
  let payload: UserPayload;

  try {
    payload = (await request.json()) as UserPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidEmail(payload.email)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!isValidTimezone(payload.timezone)) {
    return Response.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  const notificationsEnabled = payload.notificationsEnabled === true;
  const sql = getSql();

  const users = (await sql`
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
      ${notificationsEnabled},
      now(),
      now()
    )
    on conflict (email) do update set
      timezone = excluded.timezone,
      notifications_enabled = excluded.notifications_enabled,
      updated_at = now()
    returning
      email,
      timezone,
      notifications_enabled as "notificationsEnabled",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `) as unknown as UserRow[];

  return Response.json({ user: users[0] });
}
