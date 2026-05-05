"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AppShell,
  cn,
  fieldClass,
  panelClass,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/mood-ui";
import { getScoreMeta, scoreScale } from "@/lib/mood-style";

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
      setEntries((current) =>
        [
          data.entry,
          ...current.filter((entry) => entry.id !== data.entry.id),
        ].sort(
          (a, b) =>
            new Date(b.hourKey).getTime() - new Date(a.hourKey).getTime(),
        ),
      );
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
        setError(
          "Уведомления включены локально, но профиль не обновился в БД.",
        );
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
      <AppShell className="max-w-xl justify-center py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Mood Tracker
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            Почасовой дневник настроения
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Один email нужен только как локальный ключ для ваших записей.
          </p>
        </div>

        <form
          onSubmit={handleEmailSubmit}
          className={cn(panelClass, "p-5 sm:p-6")}
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="you@example.com"
              className={cn(fieldClass, "mt-2 h-12")}
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
            className={cn(primaryButtonClass, "mt-5 h-12 w-full")}
          >
            {isSaving ? "Сохраняю..." : "Продолжить"}
          </button>
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </form>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Почасовой дневник настроения"
        subtitle={`${email} · ${timezone}`}
        activePage="entry"
        metrics={[
          { label: "За 24 часа", value: average24.toFixed(1) },
          { label: "За 7 дней", value: average7Days.toFixed(1) },
          { label: "Записей", value: String(entries.length) },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={cn(panelClass, "p-5 sm:p-6")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Текущий час
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatCurrentHour()}
              </p>
            </div>
            <span
              className={cn(
                "w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                currentEntry
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-slate-50 text-slate-500",
              )}
            >
              {currentEntry ? "Запись сохранена" : "Новая запись"}
            </span>
          </div>

          <ScoreScale value={selectedScore} onChange={setSelectedScore} />

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">
              Чем я занимаюсь
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: работаю, отдыхаю, ем, тренируюсь"
              className={cn(
                fieldClass,
                "mt-2 min-h-28 resize-none bg-slate-50 p-4 focus:bg-white",
              )}
              maxLength={noteLimit}
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {note.length}/{noteLimit}
            </p>
            <button
              type="button"
              onClick={saveEntry}
              disabled={isSaving}
              className={primaryButtonClass}
            >
              {isSaving ? "Сохраняю..." : "Сохранить оценку"}
            </button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className={cn(panelClass, "p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Уведомления
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Напоминания работают в открытой вкладке каждый час с 10:00 до
                  24:00.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                {notificationPermission}
              </span>
            </div>
            <button
              type="button"
              onClick={enableNotifications}
              className={cn(secondaryButtonClass, "mt-4 w-full")}
            >
              {notificationPermission === "granted" && notificationsEnabled
                ? "Уведомления включены"
                : "Включить уведомления"}
            </button>
          </section>

          <section className={cn(panelClass, "p-5")}>
            <h2 className="text-lg font-semibold text-slate-950">Профиль</h2>
            <p className="mt-2 break-words text-sm leading-6 text-slate-500">
              {email}
            </p>
            <button
              type="button"
              onClick={switchProfile}
              className={cn(secondaryButtonClass, "mt-4 w-full")}
            >
              Сменить email
            </button>
          </section>
        </aside>
      </div>

      {(error || status) && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {error || status}
        </div>
      )}

      <section className="pb-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">
            История за 7 дней
          </h2>
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
                  className={cn(
                    panelClass,
                    "grid gap-4 p-4 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-center",
                  )}
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {formatHour(entry.hourKey)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold",
                        meta.bg,
                        meta.text,
                      )}
                    >
                      {entry.score}
                    </span>
                    {entry.note ? (
                      <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:border-rose-300 hover:text-rose-700"
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
    </AppShell>
  );
}

function ScoreScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-sm font-medium text-slate-700">
        Оценка настроения
      </p>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {scoreScale.map((score) => {
          const isActive = value === score.value;

          return (
            <button
              key={score.value}
              type="button"
              onClick={() => onChange(score.value)}
              aria-pressed={isActive}
              className={cn(
                "relative h-10 rounded-md border text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
                isActive
                  ? cn(score.bg, score.text, "border-transparent shadow-sm")
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100",
              )}
            >
              {score.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
