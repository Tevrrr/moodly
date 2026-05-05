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

type DayColumn = {
  key: string;
  label: string;
  shortLabel: string;
};

const emailStorageKey = "mood-tracker.email";
const chartWidth = 960;
const chartHeight = 320;
const chartPaddingX = 42;
const chartPaddingY = 28;
const chartPlotHeight = 224;
const tooltipWidth = 220;

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

function formatHourRange(hour: number) {
  const nextHour = (hour + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00-${String(nextHour).padStart(
    2,
    "0",
  )}:00`;
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getHourKey(date: Date) {
  return `${getDayKey(date)}-${date.getHours()}`;
}

function formatDayLabel(dayKey: string) {
  return new Intl.DateTimeFormat("ru", {
    weekday: "long",
  }).format(new Date(`${dayKey}T12:00:00`));
}

function formatShortDayLabel(dayKey: string) {
  return new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dayKey}T12:00:00`));
}

function getColor(score: number) {
  return scoreColors[score] ?? scoreColors[5];
}

function getTextColor(score: number) {
  return score <= 5 || score >= 8 ? "text-white" : "text-slate-950";
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

    const plotWidth = chartWidth - chartPaddingX * 2;
    const step = ordered.length > 1 ? plotWidth / (ordered.length - 1) : 0;

    return ordered.map((entry, index) => ({
      ...entry,
      x: chartPaddingX + step * index,
      y: chartPaddingY + ((10 - entry.score) / 9) * chartPlotHeight,
    }));
  }, [entries]);

  const average = useMemo(() => {
    if (entries.length === 0) {
      return 0;
    }

    return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
  }, [entries]);

  const tableDays = useMemo<DayColumn[]>(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = getDayKey(date);

      return {
        key,
        label: formatDayLabel(key),
        shortLabel: formatShortDayLabel(key),
      };
    });
  }, []);

  const tableHours = useMemo(() => {
    const hours = new Set<number>();

    for (const entry of entries) {
      hours.add(new Date(entry.hourKey).getHours());
    }

    return [...hours].sort((a, b) => a - b);
  }, [entries]);

  const entryByDayHour = useMemo(() => {
    const map = new Map<string, MoodEntry>();

    for (const entry of entries) {
      map.set(getHourKey(new Date(entry.hourKey)), entry);
    }

    return map;
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
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Последние 48 записей</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Наведите на точку, чтобы увидеть занятие и оценку.
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
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-label="График настроения"
                    className="h-auto w-full min-w-[720px] rounded-lg bg-slate-50"
                  >
                    {[1, 5, 10].map((score) => {
                      const y =
                        chartPaddingY + ((10 - score) / 9) * chartPlotHeight;

                      return (
                        <g key={score}>
                          <line
                            x1={chartPaddingX}
                            x2={chartWidth - chartPaddingX}
                            y1={y}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeDasharray="4 6"
                          />
                          <text
                            x={chartPaddingX - 24}
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
                      <g
                        key={point.id}
                        className="group outline-none"
                        tabIndex={0}
                      >
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
                        <g
                          className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                          transform={`translate(${Math.min(
                            Math.max(point.x - tooltipWidth / 2, 8),
                            chartWidth - tooltipWidth - 8,
                          )}, ${point.y > 124 ? point.y - 118 : point.y + 18})`}
                        >
                          <foreignObject width={tooltipWidth} height="104">
                            <div className="rounded-lg border border-slate-300 bg-white p-2 text-xs shadow-sm">
                              <p className="font-medium text-slate-500">
                                {formatHour(point.hourKey)}
                              </p>
                              <p className="mt-1 max-h-10 overflow-hidden break-words text-sm font-semibold leading-5 text-slate-900">
                                {point.note || "Без занятия"}
                              </p>
                              <p className="mt-1 font-semibold text-slate-700">
                                H = {point.score}
                              </p>
                            </div>
                          </foreignObject>
                        </g>
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
                          y={chartHeight - 26}
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

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-2xl font-semibold">Таблица занятий</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Формат: чем я занимаюсь и H = оценка настроения.
                </p>
              </div>

              {tableHours.length > 0 ? (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        <th className="w-28 border border-slate-300 bg-slate-50 p-3 font-semibold text-slate-600">
                          Время
                        </th>
                        {tableDays.map((day) => (
                          <th
                            key={day.key}
                            className="w-40 border border-slate-300 bg-slate-50 p-3 align-top font-semibold capitalize text-slate-900"
                          >
                            <span className="block">{day.label}</span>
                            <span className="mt-1 block text-xs font-medium normal-case text-slate-500">
                              {day.shortLabel}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableHours.map((hour) => (
                        <tr key={hour}>
                          <th className="border border-slate-300 bg-slate-50 p-3 align-top font-medium text-slate-700">
                            {formatHourRange(hour)}
                          </th>
                          {tableDays.map((day) => {
                            const entry = entryByDayHour.get(`${day.key}-${hour}`);

                            return (
                              <td
                                key={`${day.key}-${hour}`}
                                className={`h-24 border border-slate-300 p-3 align-top ${
                                  entry ? getTextColor(entry.score) : ""
                                }`}
                                style={
                                  entry
                                    ? { backgroundColor: getColor(entry.score) }
                                    : undefined
                                }
                              >
                                {entry ? (
                                  <div className="space-y-2">
                                    <p className="break-words font-medium leading-5">
                                      {entry.note || "Без занятия"}
                                    </p>
                                    <span
                                      className="inline-flex rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900"
                                    >
                                      H = {entry.score}
                                    </span>
                                  </div>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                  Записей для таблицы пока нет.
                </div>
              )}
            </section>
          </>
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
