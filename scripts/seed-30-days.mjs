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
const email = process.argv[2]?.trim().toLowerCase();
const timezone =
  process.argv[3]?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;

if (!databaseUrl) {
  console.error("DATABASE_URL or MOOD_DATABASE_URL is not configured");
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run db:seed:30 -- user@example.com [Timezone]");
  process.exit(1);
}

const sql = neon(databaseUrl);

const activitiesByHour = {
  10: ["Проснулась, кофе и план дня", "Завтрак и сообщения", "Легкая зарядка"],
  11: ["Рабочие задачи", "Разбор почты", "Созвон по проекту"],
  12: ["Работа за компьютером", "Домашние дела", "Учеба"],
  13: ["Обед", "Прогулка до магазина", "Перерыв и чтение"],
  14: ["Фокусная работа", "Встреча", "Планирование задач"],
  15: ["Рабочая сессия", "Разбор документов", "Небольшой отдых"],
  16: ["Прогулка", "Звонок близким", "Домашние дела"],
  17: ["Спорт", "Дорога и музыка", "Завершение рабочих задач"],
  18: ["Ужин", "Покупки", "Готовка"],
  19: ["Отдых", "Сериал", "Встреча с друзьями"],
  20: ["Хобби", "Чтение", "Спокойный вечер"],
  21: ["Планирование завтра", "Душ и отдых", "Разговор по телефону"],
  22: ["Подготовка ко сну", "Книга", "Тихий вечер"],
  23: ["Легла отдыхать", "Без телефона перед сном", "Поздний отдых"],
};

function scoreFor(dayIndex, hour, activityIndex, date) {
  const wave = Math.sin((dayIndex / 29) * Math.PI * 2) * 1.4;
  const hourBoost = hour >= 17 && hour <= 20 ? 1 : hour <= 12 ? -0.4 : 0.2;
  const weekendBoost = [0, 6].includes(date.getDay()) ? 0.4 : 0;
  const variation = ((dayIndex * 7 + hour * 3 + activityIndex) % 5) - 2;
  const raw = 5.2 + wave + hourBoost + weekendBoost + variation * 0.55;

  return Math.min(10, Math.max(1, Math.round(raw)));
}

function localHourDate(baseDate, daysAgo, hour) {
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date;
}

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
    ${timezone},
    false,
    now(),
    now()
  )
  on conflict (email) do update set
    timezone = excluded.timezone,
    updated_at = now()
`;

const now = new Date();
let createdOrUpdated = 0;

for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
  const dayIndex = 29 - daysAgo;

  for (let hour = 10; hour < 24; hour += 1) {
    const hourKey = localHourDate(now, daysAgo, hour);

    if (hourKey.getTime() > now.getTime()) {
      continue;
    }

    const activityOptions = activitiesByHour[hour];
    const activityIndex = (dayIndex + hour) % activityOptions.length;
    const note = activityOptions[activityIndex];
    const score = scoreFor(dayIndex, hour, activityIndex, hourKey);

    await sql`
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
        ${score},
        ${note},
        ${hourKey.toISOString()},
        ${timezone},
        now(),
        now()
      )
      on conflict (user_email, hour_key) do update set
        score = excluded.score,
        note = excluded.note,
        timezone = excluded.timezone,
        updated_at = now()
    `;

    createdOrUpdated += 1;
  }
}

console.log(
  `Seeded ${createdOrUpdated} hourly mood entries for ${email} (${timezone}).`,
);
