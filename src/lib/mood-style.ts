export const scoreScale = [
  {
    value: 1,
    label: "1",
    hex: "#1f2937",
    bg: "bg-gray-800",
    text: "text-white",
  },
  {
    value: 2,
    label: "2",
    hex: "#374151",
    bg: "bg-gray-700",
    text: "text-white",
  },
  {
    value: 3,
    label: "3",
    hex: "#4b5563",
    bg: "bg-gray-600",
    text: "text-white",
  },
  {
    value: 4,
    label: "4",
    hex: "#6b7280",
    bg: "bg-gray-500",
    text: "text-white",
  },
  {
    value: 5,
    label: "5",
    hex: "#9ca3af",
    bg: "bg-gray-400",
    text: "text-slate-950",
  },
  {
    value: 6,
    label: "6",
    hex: "#7dd3fc",
    bg: "bg-sky-300",
    text: "text-sky-950",
  },
  {
    value: 7,
    label: "7",
    hex: "#38bdf8",
    bg: "bg-sky-400",
    text: "text-sky-950",
  },
  {
    value: 8,
    label: "8",
    hex: "#0ea5e9",
    bg: "bg-sky-500",
    text: "text-white",
  },
  {
    value: 9,
    label: "9",
    hex: "#2563eb",
    bg: "bg-blue-600",
    text: "text-white",
  },
  {
    value: 10,
    label: "10",
    hex: "#1d4ed8",
    bg: "bg-blue-700",
    text: "text-white",
  },
] as const;

export function getScoreMeta(score: number) {
  return scoreScale.find((item) => item.value === score) ?? scoreScale[4];
}

export function getScoreColor(score: number) {
  return getScoreMeta(score).hex;
}

export function getScoreTableText(score: number) {
  return score <= 5 || score >= 8 ? "text-white" : "text-slate-950";
}
