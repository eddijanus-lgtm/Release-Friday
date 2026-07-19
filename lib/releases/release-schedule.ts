const BERLIN_TIME_ZONE = "Europe/Berlin";

type BerlinDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type PublicReleaseSchedule = {
  releaseDate: string;
  revealDate: string;
  revealAt: number;
  isRevealOpen: boolean;
};

const berlinFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function berlinDateParts(date: Date): BerlinDateParts {
  const parts = Object.fromEntries(
    berlinFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function calendarDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatCalendarDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function berlinOffsetMilliseconds(timestamp: number) {
  const parts = berlinDateParts(new Date(timestamp));
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
}

function berlinMidnightTimestamp(date: Date) {
  const midnightAsUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const firstCandidate = midnightAsUtc - berlinOffsetMilliseconds(midnightAsUtc);
  return midnightAsUtc - berlinOffsetMilliseconds(firstCandidate);
}

export function getPublicReleaseSchedule(now = new Date()): PublicReleaseSchedule {
  const berlinNow = berlinDateParts(now);
  const today = calendarDate(berlinNow.year, berlinNow.month, berlinNow.day);
  const weekday = today.getUTCDay();
  const beforeSundayArchive = weekday === 0 && berlinNow.hour === 0 && berlinNow.minute < 1;

  const daysToReleaseFriday = weekday === 6
    ? -1
    : beforeSundayArchive
      ? -2
      : (5 - weekday + 7) % 7;

  const releaseDate = addCalendarDays(today, daysToReleaseFriday);
  const revealDate = addCalendarDays(releaseDate, -2);
  const revealAt = berlinMidnightTimestamp(revealDate);

  return {
    releaseDate: formatCalendarDate(releaseDate),
    revealDate: formatCalendarDate(revealDate),
    revealAt,
    isRevealOpen: now.getTime() >= revealAt,
  };
}
