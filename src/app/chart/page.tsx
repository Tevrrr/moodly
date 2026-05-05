"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, cn, panelClass, PageHeader } from "@/components/mood-ui";
import {
  getScoreColor,
  getScoreTableText,
  scoreScale,
} from "@/lib/mood-style";

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
const chartHeight = 350;
const chartPaddingX = 42;
const chartPaddingY = 28;
const chartPlotHeight = 224;
const tooltipWidth = 220;
const chartLabelY = chartHeight - 48;

function formatHour(value: string) {
  const date = new Date(value);
  const dayMonth = new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "short",
  }).format(date);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${dayMonth}, ${hour}.${minute}`;
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
    <AppShell>
      <PageHeader
        title="График настроения"
        subtitle={email || "Email не выбран"}
        activePage="chart"
        metrics={[
          { label: "Среднее", value: average.toFixed(1) },
          { label: "Точек", value: String(entries.length) },
        ]}
      />

      {!email ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500">
          Сначала укажите email на странице записи.
        </section>
      ) : (
        <>
          <section className={cn(panelClass, "p-5 sm:p-6")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Последние 48 записей
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Наведите на точку, чтобы увидеть занятие и оценку.
                </p>
              </div>
              {isLoading ? (
                <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  Загрузка...
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {!isLoading && chartPoints.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                Записей для графика пока нет.
              </div>
            ) : null}

            {chartPoints.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
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
                        stroke={getScoreColor(point.score)}
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
                        fill={getScoreColor(point.score)}
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
                      stroke={getScoreColor(chartPoints[0].score)}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  ) : null}

                  {chartPoints.map((point, index) => {
                    const anchor =
                      index === 0
                        ? "start"
                        : index === chartPoints.length - 1
                          ? "end"
                          : "middle";

                    return (
                      <text
                        key={`${point.id}-label`}
                        x={point.x}
                        y={chartLabelY}
                        textAnchor={anchor}
                        transform={`rotate(-25 ${point.x} ${chartLabelY})`}
                        className="fill-slate-500 text-[10px]"
                      >
                        {formatHour(point.hourKey)}
                      </text>
                    );
                  })}
                </svg>
              </div>
            ) : null}
          </section>

          <section className={cn(panelClass, "p-5 sm:p-6")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Таблица занятий
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Формат: чем я занимаюсь и H = оценка настроения.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scoreScale.map((score) => (
                  <span
                    key={score.value}
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
                      score.bg,
                      score.text,
                    )}
                  >
                    {score.value}
                  </span>
                ))}
              </div>
            </div>

            {tableHours.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      <th className="w-28 border-b border-r border-slate-200 bg-slate-50 p-3 font-semibold text-slate-600">
                        Время
                      </th>
                      {tableDays.map((day) => (
                        <th
                          key={day.key}
                          className="w-40 border-b border-r border-slate-200 bg-slate-50 p-3 align-top font-semibold capitalize text-slate-900 last:border-r-0"
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
                        <th className="border-b border-r border-slate-200 bg-slate-50 p-3 align-top font-medium text-slate-700">
                          {formatHourRange(hour)}
                        </th>
                        {tableDays.map((day) => {
                          const entry = entryByDayHour.get(`${day.key}-${hour}`);

                          return (
                            <td
                              key={`${day.key}-${hour}`}
                              className={cn(
                                "h-24 border-b border-r border-slate-200 p-3 align-top last:border-r-0",
                                entry ? getScoreTableText(entry.score) : "",
                              )}
                              style={
                                entry
                                  ? { backgroundColor: getScoreColor(entry.score) }
                                  : undefined
                              }
                            >
                              {entry ? (
                                <div className="space-y-2">
                                  <p className="break-words font-medium leading-5">
                                    {entry.note || "Без занятия"}
                                  </p>
                                  <span className="inline-flex rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900">
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
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                Записей для таблицы пока нет.
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
