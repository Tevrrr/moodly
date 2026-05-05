import { getSql } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const emailValue = url.searchParams.get("email");
  const { id } = await context.params;

  if (!isValidEmail(emailValue)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!id) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const email = normalizeEmail(emailValue);
  const entries = (await sql`
    delete from mood_entries
    where id = ${id}
      and user_email = ${email}
    returning id
  `) as unknown as { id: string }[];

  if (!entries[0]) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
