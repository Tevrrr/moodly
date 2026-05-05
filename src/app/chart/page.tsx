"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type ApiEntriesResponse = {
  entries: MoodEntry[];
};

type ChartPoint = MoodEntry & {
  x: number;
  y: number;
};

const emailStorageKey = "mood-tracker.email";

const scoreColors: Record<number, string> = {
  1: "#1f2937",
  2: "#374151",
  3: "#4b5563",
  4: "#6b7280",
  5: "#9ca3af",
  6: "#7dd3fc",
  7: "#38bdf8",
  8: "#0ea5e9",
  9: "#2563eb",
  10: "#1d4ed8",
};

function formatHour(value: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
  }).format(new Date(value));
}

function getColor(score: number) {
  return scoreColors[score] ?? scoreColors[5];
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Ошибка запроса";
  } catch {
    return "Ошибка запроса";
  }
}

export default function ChartPage() {
  const [email, setEmail] = useState("");
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setEmail(window.localStorage.getItem(emailStorageKey) ?? "");
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
        }
      } catch (loadError) {
        if (!ignored) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить график",
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

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const ordered = [...entries]
      .sort(
        (a, b) =>
          new Date(a.hourKey).getTime() - new Date(b.hourKey).getTime(),
      )
      .slice(-48);

    if (ordered.length === 0) {
      return [];
    }

    const width = 720;
    const height = 280;
    const paddingX = 42;
    const paddingY = 28;
    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;
    const step = ordered.length > 1 ? plotWidth / (ordered.length - 1) : 0;

    return ordered.map((entry, index) => ({
      ...entry,
      x: paddingX + step * index,
      y: paddingY + ((10 - entry.score) / 9) * plotHeight,
    }));
  }, [entries]);

  const average = useMemo(() => {
    if (entries.length === 0) {
      return 0;
    }

    return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
  }, [entries]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mood Tracker
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              График настроения
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {email || "Email не выбран"}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Запись
              </Link>
              <Link
                href="/chart"
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                График
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <Metric label="Среднее" value={average.toFixed(1)} />
            <Metric label="Точек" value={String(entries.length)} />
          </div>
        </header>

        {!email ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
            Сначала укажите email на странице записи.
          </section>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Последние 48 записей</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Цвет каждой линии соответствует значению в конце сегмента.
                </p>
              </div>
              {isLoading ? (
                <span className="w-fit rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500">
                  Загрузка...
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {!isLoading && chartPoints.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                Записей для графика пока нет.
              </div>
            ) : null}

            {chartPoints.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <svg
                  viewBox="0 0 720 320"
                  role="img"
                  aria-label="График настроения"
                  className="h-[360px] min-w-[720px] rounded-lg bg-slate-50"
                >
                  {[1, 5, 10].map((score) => {
                    const y = 28 + ((10 - score) / 9) * 224;

                    return (
                      <g key={score}>
                        <line
                          x1="42"
                          x2="678"
                          y1={y}
                          y2={y}
                          stroke="#cbd5e1"
                          strokeDasharray="4 6"
                        />
                        <text
                          x="18"
                          y={y + 4}
                          className="fill-slate-400 text-xs font-medium"
                        >
                          {score}
                        </text>
                      </g>
                    );
                  })}

                  {chartPoints.slice(1).map((point, index) => {
                    const previous = chartPoints[index];

                    return (
                      <line
                        key={`${previous.id}-${point.id}`}
                        x1={previous.x}
                        y1={previous.y}
                        x2={point.x}
                        y2={point.y}
                        stroke={getColor(point.score)}
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {chartPoints.map((point) => (
                    <g key={point.id}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="8"
                        fill={getColor(point.score)}
                        stroke="white"
                        strokeWidth="3"
                      />
                      <text
                        x={point.x}
                        y={point.y - 14}
                        textAnchor="middle"
                        className="fill-slate-700 text-xs font-semibold"
                      >
                        {point.score}
                      </text>
                    </g>
                  ))}

                  {chartPoints.length === 1 ? (
                    <line
                      x1={chartPoints[0].x - 24}
                      y1={chartPoints[0].y}
                      x2={chartPoints[0].x + 24}
                      y2={chartPoints[0].y}
                      stroke={getColor(chartPoints[0].score)}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  ) : null}

                  {chartPoints.map((point, index) =>
                    index === 0 ||
                    index === chartPoints.length - 1 ||
                    index % 6 === 0 ? (
                      <text
                        key={`${point.id}-label`}
                        x={point.x}
                        y="294"
                        textAnchor="middle"
                        className="fill-slate-500 text-xs"
                      >
                        {formatHour(point.hourKey)}
                      </text>
                    ) : null,
                  )}
                </svg>
              </div>
            ) : null}
          </section>
        )}
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
