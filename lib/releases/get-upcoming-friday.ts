const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getUpcomingFriday(from = new Date()): Date {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);

  const daysUntilFriday = (5 - date.getDay() + 7) % 7;
  const offset = daysUntilFriday === 0 ? 7 : daysUntilFriday;

  return new Date(date.getTime() + offset * DAY_IN_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
