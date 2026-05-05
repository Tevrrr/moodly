"use client";

import { useEffect, useMemo, useState } from "react";

type Mood = {
  id: string;
  label: string;
  tone: string;
  score: number;
  accent: string;
};

type MoodEntry = {
  id: string;
  date: string;
  moodId: string;
  note: string;
};

const moods: Mood[] = [
  {
    id: "great",
    label: "Отлично",
    tone: "Энергия",
    score: 5,
    accent: "bg-emerald-500",
  },
  {
    id: "good",
    label: "Хорошо",
    tone: "Спокойно",
    score: 4,
    accent: "bg-sky-500",
  },
  {
    id: "neutral",
    label: "Нормально",
    tone: "Ровно",
    score: 3,
    accent: "bg-amber-500",
  },
  {
    id: "tired",
    label: "Усталость",
    tone: "Низкий заряд",
    score: 2,
    accent: "bg-orange-500",
  },
  {
    id: "hard",
    label: "Сложно",
    tone: "Нужна пауза",
    score: 1,
    accent: "bg-rose-500",
  },
];

const storageKey = "mood-tracker.entries";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function getMood(id: string) {
  return moods.find((mood) => mood.id === id) ?? moods[2];
}

export default function Home() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState(moods[2].id);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem(storageKey);

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as MoodEntry[];
          setEntries(parsed);

          const todayEntry = parsed.find((entry) => entry.date === todayKey());
          if (todayEntry) {
            setSelectedMood(todayEntry.moodId);
            setNote(todayEntry.note);
          }
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }

      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(entries));
    }
  }, [entries, loaded]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [entries],
  );

  const weekEntries = useMemo(() => sortedEntries.slice(0, 7), [sortedEntries]);

  const averageScore = useMemo(() => {
    if (weekEntries.length === 0) {
      return 0;
    }

    const total = weekEntries.reduce(
      (sum, entry) => sum + getMood(entry.moodId).score,
      0,
    );
    return total / weekEntries.length;
  }, [weekEntries]);

  const streak = useMemo(() => {
    const dates = new Set(entries.map((entry) => entry.date));
    let count = 0;
    const cursor = new Date(`${todayKey()}T12:00:00`);

    while (dates.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }, [entries]);

  const todayEntry = entries.find((entry) => entry.date === todayKey());

  function saveEntry() {
    const entry: MoodEntry = {
      id: todayEntry?.id ?? crypto.randomUUID(),
      date: todayKey(),
      moodId: selectedMood,
      note: note.trim(),
    };

    setEntries((current) => [
      entry,
      ...current.filter((item) => item.date !== entry.date),
    ]);
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#161615]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#5d6657]">
              Mood Tracker
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Дневник настроения
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <Metric label="Среднее за 7 дней" value={averageScore.toFixed(1)} />
            <Metric label="Серия дней" value={String(streak)} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Сегодня</h2>
                <p className="mt-1 text-sm text-black/60">
                  {formatDate(todayKey())}
                </p>
              </div>
              <span className="w-fit rounded-full border border-black/10 px-3 py-1 text-sm text-black/60">
                {todayEntry ? "Запись сохранена" : "Новая запись"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {moods.map((mood) => {
                const isActive = selectedMood === mood.id;

                return (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => setSelectedMood(mood.id)}
                    className={`rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:border-black/25 ${
                      isActive
                        ? "border-black bg-[#f2efe6] shadow-sm"
                        : "border-black/10 bg-white"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span
                      className={`block h-2 w-10 rounded-full ${mood.accent}`}
                    />
                    <span className="mt-4 block font-semibold">
                      {mood.label}
                    </span>
                    <span className="mt-1 block text-sm text-black/55">
                      {mood.tone}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-black/70">
                Короткая заметка
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Что сегодня повлияло на настроение?"
                className="mt-2 min-h-36 w-full resize-none rounded-lg border border-black/10 bg-[#fbfaf6] p-4 text-base outline-none transition placeholder:text-black/35 focus:border-black/35 focus:bg-white"
                maxLength={280}
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-black/50">{note.length}/280</p>
              <button
                type="button"
                onClick={saveEntry}
                className="rounded-lg bg-[#161615] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#35332e]"
              >
                Сохранить день
              </button>
            </div>
          </section>

          <aside className="rounded-lg border border-black/10 bg-[#22312d] p-5 text-white shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Последняя неделя</h2>
            <div className="mt-6 flex h-56 items-end gap-3">
              {Array.from({ length: 7 }).map((_, index) => {
                const entry = weekEntries[6 - index];
                const mood = entry ? getMood(entry.moodId) : null;
                const height = mood ? `${Math.max(mood.score * 18, 18)}%` : "8%";

                return (
                  <div
                    key={`${entry?.id ?? "empty"}-${index}`}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-44 w-full items-end rounded-lg bg-white/10 p-1">
                      <div
                        className={`w-full rounded-md ${
                          mood?.accent ?? "bg-white/25"
                        }`}
                        style={{ height }}
                      />
                    </div>
                    <span className="h-4 text-xs text-white/60">
                      {entry ? formatDate(entry.date).split(" ")[0] : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-sm leading-6 text-white/70">
              График показывает последние сохраненные дни. Чем выше столбец,
              тем лучше оценка настроения.
            </p>
          </aside>
        </div>

        <section className="pb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">История</h2>
            {entries.length > 0 ? (
              <button
                type="button"
                onClick={() => setEntries([])}
                className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/65 transition hover:border-black/25 hover:text-black"
              >
                Очистить
              </button>
            ) : null}
          </div>

          {sortedEntries.length > 0 ? (
            <div className="grid gap-3">
              {sortedEntries.map((entry) => {
                const mood = getMood(entry.moodId);

                return (
                  <article
                    key={entry.id}
                    className="grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">{formatDate(entry.date)}</p>
                      <p className="mt-1 text-sm text-black/50">{mood.tone}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-3 w-3 rounded-full ${mood.accent}`}
                        />
                        <p className="font-medium">{mood.label}</p>
                      </div>
                      {entry.note ? (
                        <p className="mt-2 break-words text-sm leading-6 text-black/65">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="rounded-lg border border-black/10 px-3 py-2 text-sm text-black/55 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      Удалить
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-black/20 bg-white/70 p-8 text-center text-black/55">
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
    <div className="rounded-lg border border-black/10 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
