# Mood Tracker

Next.js приложение для почасовой оценки настроения от 1 до 10.

## Что умеет

- локальный вход по email без пароля;
- почасовая оценка настроения по шкале `1-10`;
- хранение записей в Neon Postgres через `DATABASE_URL`;
- история за последние 7 дней и средние значения за 24 часа/7 дней;
- browser notifications в открытой вкладке с 10:00 до 24:00.

## Настройка БД

Создайте Neon Postgres в Vercel Marketplace и подтяните переменные окружения:

```bash
vercel env pull .env.local
npm run db:init
```

Скрипт `db:init` читает `DATABASE_URL` или `MOOD_DATABASE_URL` из окружения или из `.env.local`.

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

## Проверка

```bash
npm run lint
npm run build
```
