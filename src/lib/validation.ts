export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidTimezone(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 80
  );
}

export function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

export function toHourDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setMinutes(0, 0, 0);
  return date;
}
