import { DateTime } from "luxon";

const TIMEZONE = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

function dateKey(date: DateTime): string {
  return date.toISODate() ?? "";
}

function isWeekend(date: DateTime): boolean {
  return date.weekday === 6 || date.weekday === 7;
}

function isBusinessDay(
  date: DateTime,
  holidays: Set<string>,
): boolean {
  return !isWeekend(date) && !holidays.has(dateKey(date));
}

function moveToBusinessStart(
  date: DateTime,
  holidays: Set<string>,
): DateTime {
  let current = date;

  while (!isBusinessDay(current, holidays)) {
    current = current.plus({ days: 1 }).startOf("day");
  }

  if (current.hour < BUSINESS_START_HOUR) {
    return current.set({
      hour: BUSINESS_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  if (current.hour >= BUSINESS_END_HOUR) {
    current = current.plus({ days: 1 }).startOf("day");

    while (!isBusinessDay(current, holidays)) {
      current = current.plus({ days: 1 }).startOf("day");
    }

    return current.set({
      hour: BUSINESS_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  return current;
}

export function calculateSlaDueAt(
  startDate: Date,
  businessHours: number,
  holidayDates: Date[] = [],
): Date {
  const holidaySet: Set<string> = new Set(
    holidayDates
      .map((date) =>
        DateTime.fromJSDate(date)
          .setZone(TIMEZONE)
          .toISODate(),
      )
      .filter((value): value is string => value !== null),
  );

  let current: DateTime<true> = DateTime.fromJSDate(startDate, {
    zone: TIMEZONE,
  }) as DateTime<true>;

  current = moveToBusinessStart(current, holidaySet) as DateTime<true>;

  let remainingMinutes = businessHours * 60;

  while (remainingMinutes > 0) {
    current = moveToBusinessStart(
      current,
      holidaySet,
    ) as DateTime<true>;

    const endOfBusiness = current.set({
      hour: BUSINESS_END_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    const availableMinutes = Math.max(
      0,
      Math.floor(
        endOfBusiness.diff(current, "minutes").minutes,
      ),
    );

    if (availableMinutes >= remainingMinutes) {
      return current
        .plus({ minutes: remainingMinutes })
        .toJSDate();
    }

    remainingMinutes -= availableMinutes;

    current = current
      .plus({ days: 1 })
      .startOf("day") as DateTime<true>;
  }

  return current.toJSDate();
}
