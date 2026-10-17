/**
 * Date helpers pinned to the app's operating timezone.
 *
 * `transactions.occurred_on` is a plain DATE and the users of this app are in
 * Indonesia, so "today" must mean today in Jakarta — not on whatever timezone
 * the server happens to run in (containers are usually UTC).
 */
const APP_TIME_ZONE = 'Asia/Jakarta';

// en-CA formats as YYYY-MM-DD.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Normalizes a DATE column value to a 'YYYY-MM-DD' string. */
export function toDateOnly(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : dateFormatter.format(value);
}

/** Today in the app timezone, as 'YYYY-MM-DD'. */
export function todayDateOnly(): string {
  return dateFormatter.format(new Date());
}

/** Current month in the app timezone, as 'YYYY-MM'. */
export function currentMonth(): string {
  return todayDateOnly().slice(0, 7);
}

/** A date `days` before today in the app timezone, as 'YYYY-MM-DD'. */
export function dateOnlyDaysAgo(days: number): string {
  return dateFormatter.format(new Date(Date.now() - days * 86_400_000));
}
