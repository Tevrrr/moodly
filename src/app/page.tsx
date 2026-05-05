"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type MoodEntry = {
  id: string;
  userEmail: string;
  score: number;
  note: string;
  hourKey: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

type ApiEntryResponse = {
  entry: MoodEntry;
};

type ApiEntriesResponse = {
  entries: MoodEntry[];
};

const emailStorageKey = "mood-tracker.email";
const notificationStorageKey = "mood-tracker.notifications";
const noteLimit = 280;

const scores = [
  { value: 1, label: "1", tone: "Тяжело", bg: "bg-gray-800", text: "text-white" },
  { value: 2, label: "2", tone: "Низко", bg: "bg-gray-700", text: "text-white" },
  { value: 3, label: "3", tone: "Пасмурно", bg: "bg-gray-600", text: "text-white" },
  { value: 4, label: "4", tone: "Усталость", bg: "bg-gray-500", text: "text-white" },
  { value: 5, label: "5", tone: "Ровно", bg: "bg-gray-400", text: "text-gray-950" },
  { value: 6, label: "6", tone: "Спокойно", bg: "bg-sky-300", text: "text-sky-950" },
  { value: 7, label: "7", tone: "Нормально", bg: "bg-sky-400", text: "text-sky-950" },
  { value: 8, label: "8", tone: "Хорошо", bg: "bg-sky-500", text: "text-white" },
  { value: 9, label: "9", tone: "Отлично", bg: "bg-blue-600", text: "text-white" },
  { value: 10, label: "10", tone: "Сильно", bg: "bg-blue-700", text: "text-white" },
];

function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getCurrentHourKey() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCurrentHour() {
  return new Intl.DateTimeFormat("ru", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(getCurrentHourKey()));
}

function getScoreMeta(score: number) {
  return scores.find((item) => item.value === score) ?? scores[4];
}

function isActiveReminderHour(date: Date) {
  const hour = date.getHours();
  return hour >= 10 && hour < 24;
}

function getNextReminderDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);

  if (next.getHours() < 10) {
    next.setHours(10, 0, 0, 0);
  }

  return Math.max(next.getTime() - now.getTime(), 1000);
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Ошибка запроса";
  } catch {
    return "Ошибка запроса";
  }
}

export default function Home() {
  const reminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedScore, setSelectedScore] = useState(5);
  const [note, setNote] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const timezone = useMemo(() => getTimezone(), []);
  const currentHourKey = getCurrentHourKey();

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.hourKey === currentHourKey),
    [currentHourKey, entries],
  );

  const average24 = useMemo(() => {
    const recent = entries.slice(0, 24);
    if (recent.length === 0) {
      return 0;
    }

    return recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length;
  }, [entries]);

  const average7Days = useMemo(() => {
    if (entries.length === 0) {
      return 0;
    }

    return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
  }, [entries]);

  useEffect(() => {
    queueMicrotask(() => {
      const storedEmail = window.localStorage.getItem(emailStorageKey) ?? "";
      const storedNotifications =
        window.localStorage.getItem(notificationStorageKey) === "true";

      setEmail(storedEmail);
      setEmailInput(storedEmail);
      setNotificationsEnabled(storedNotifications);

      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
      } else {
        setNotificationPermission(Notification.permission);
      }
    });
  }, []);

  useEffect(() => {
    if (!email) {
      return;
    }

    let ignored = false;

    async function loadEntries() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/entries?email=${encodeURIComponent(email)}`,
        );

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data = (await response.json()) as ApiEntriesResponse;
        if (!ignored) {
          setEntries(data.entries);
          const entry = data.entries.find(
            (item) => item.hourKey === getCurrentHourKey(),
          );

          if (entry) {
            setSelectedScore(entry.score);
            setNote(entry.note);
          } else {
            setNote("");
          }
        }
      } catch (loadError) {
        if (!ignored) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить историю",
          );
        }
      } finally {
        if (!ignored) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      ignored = true;
    };
  }, [email]);

  useEffect(() => {
    if (reminderTimer.current) {
      clearTimeout(reminderTimer.current);
      reminderTimer.current = null;
    }

    if (
      !notificationsEnabled ||
      notificationPermission !== "granted" ||
      !("Notification" in window)
    ) {
      return;
    }

    function scheduleNextReminder() {
      reminderTimer.current = setTimeout(() => {
        if (isActiveReminderHour(new Date())) {
          new Notification("Mood Tracker", {
            body: "Поставьте оценку настроения за этот час.",
          });
        }

        scheduleNextReminder();
      }, getNextReminderDelay());
    }

    scheduleNextReminder();

    return () => {
      if (reminderTimer.current) {
        clearTimeout(reminderTimer.current);
        reminderTimer.current = null;
      }
    };
  }, [notificationPermission, notificationsEnabled]);

  async function syncUser(nextEmail: string, nextNotifications: boolean) {
    const response = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: nextEmail,
        timezone,
        notificationsEnabled: nextNotifications,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmail = emailInput.trim().toLowerCase();
    if (!nextEmail) {
      setError("Введите email.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await syncUser(nextEmail, notificationsEnabled);
      window.localStorage.setItem(emailStorageKey, nextEmail);
      setEmail(nextEmail);
      setStatus("Профиль сохранен.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить email",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEntry() {
    if (!email) {
      setError("Сначала укажите email.");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          score: selectedScore,
          note,
          hourKey: getCurrentHourKey(),
          timezone,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ApiEntryResponse;
      setEntries((current) => [
        data.entry,
        ...current.filter((entry) => entry.id !== data.entry.id),
      ].sort(
        (a, b) =>
          new Date(b.hourKey).getTime() - new Date(a.hourKey).getTime(),
      ));
      setStatus("Оценка сохранена.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить оценку",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeEntry(id: string) {
    setError("");
    setStatus("");

    try {
      const response = await fetch(
        `/api/entries/${encodeURIComponent(id)}?email=${encodeURIComponent(
          email,
        )}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
      setStatus("Запись удалена.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить запись",
      );
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setError("Этот браузер не поддерживает уведомления.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    const nextEnabled = permission === "granted";
    setNotificationsEnabled(nextEnabled);
    window.localStorage.setItem(notificationStorageKey, String(nextEnabled));

    if (email) {
      try {
        await syncUser(email, nextEnabled);
      } catch {
        setError("Уведомления включены локально, но профиль не обновился в БД.");
      }
    }

    setStatus(
      nextEnabled
        ? "Уведомления включены для открытой вкладки."
        : "Разрешение на уведомления не выдано.",
    );
  }

  function switchProfile() {
    window.localStorage.removeItem(emailStorageKey);
    setEmail("");
    setEmailInput("");
    setEntries([]);
    setNote("");
    setStatus("");
    setError("");
  }

  if (!email) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-950">
        <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Mood Tracker
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">
            Почасовой дневник настроения
          </h1>
          <form
            onSubmit={handleEmailSubmit}
            className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 text-base outline-none transition focus:border-blue-500"
                autoComplete="email"
              />
            </label>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Пароля нет. Email хранится локально в браузере и используется как
              ключ для ваших записей.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="mt-5 h-12 w-full rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Сохраняю..." : "Продолжить"}
            </button>
            {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mood Tracker
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Почасовой дневник настроения
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {email} · {timezone}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                Запись
              </Link>
              <Link
                href="/chart"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                График
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <Metric label="За 24 часа" value={average24.toFixed(1)} />
            <Metric label="За 7 дней" value={average7Days.toFixed(1)} />
            <Metric label="Записей" value={String(entries.length)} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Текущий час</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatCurrentHour()}
                </p>
              </div>
              <span className="w-fit rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500">
                {currentEntry ? "Запись сохранена" : "Новая запись"}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-3">
              {scores.map((score) => {
                const isActive = selectedScore === score.value;

                return (
                  <button
                    key={score.value}
                    type="button"
                    onClick={() => setSelectedScore(score.value)}
                    aria-pressed={isActive}
                    className={`flex aspect-square min-h-20 items-start justify-start rounded-lg border p-3 text-left transition hover:-translate-y-0.5 sm:aspect-[1.32] sm:min-h-24 ${
                      isActive
                        ? "border-blue-700 ring-2 ring-blue-200"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`grid h-11 min-w-11 place-items-center rounded-lg px-3 text-xl font-semibold leading-none ${score.bg} ${score.text}`}
                    >
                      {score.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-slate-700">
                Чем я занимаюсь
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Например: работаю, отдыхаю, еду, тренируюсь"
                className="mt-2 min-h-32 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-base outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
                maxLength={noteLimit}
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {note.length}/{noteLimit}
              </p>
              <button
                type="button"
                onClick={saveEntry}
                disabled={isSaving}
                className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Сохраняю..." : "Сохранить оценку"}
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Уведомления</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Напоминания работают в открытой вкладке каждый час с 10:00 до
                24:00.
              </p>
              <button
                type="button"
                onClick={enableNotifications}
                className="mt-5 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                {notificationPermission === "granted" && notificationsEnabled
                  ? "Уведомления включены"
                  : "Включить уведомления"}
              </button>
              <p className="mt-3 text-xs text-slate-400">
                Статус: {notificationPermission}
              </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Профиль</h2>
              <p className="mt-3 break-words text-sm text-slate-500">{email}</p>
              <button
                type="button"
                onClick={switchProfile}
                className="mt-5 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Сменить email
              </button>
            </section>
          </aside>
        </div>

        {(error || status) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {error || status}
          </div>
        )}

        <section className="pb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">История за 7 дней</h2>
            {isLoading ? (
              <span className="text-sm text-slate-500">Загрузка...</span>
            ) : null}
          </div>

          {entries.length > 0 ? (
            <div className="grid gap-3">
              {entries.map((entry) => {
                const meta = getScoreMeta(entry.score);

                return (
                  <article
                    key={entry.id}
                    className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">{formatHour(entry.hourKey)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {entry.timezone}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${meta.bg} ${meta.text}`}
                        >
                          {entry.score}
                        </span>
                      </div>
                      {entry.note ? (
                        <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeEntry(entry.id)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Удалить
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
              Записей пока нет.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
