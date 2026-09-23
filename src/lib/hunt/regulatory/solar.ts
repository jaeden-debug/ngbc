/**
 * Sunrise and sunset, computed rather than fetched.
 *
 * A legal hunting time is a regulatory value, so the number behind it must be
 * deterministic, offline, versioned and testable. A weather provider's sunrise
 * is none of those and can change without notice, which is why this exists
 * separately and why `weather.ts` never feeds it.
 *
 * NOAA's solar position algorithm (the one behind the NOAA Solar Calculator),
 * which is accurate to well under a minute for the latitudes North Ground
 * serves. It is verified against an AUTHORITY'S PUBLISHED TABLE in
 * `solar.test.ts` — an implementation verified only against another
 * implementation is verified against nothing.
 *
 * Returns UTC instants. Turning those into a wall clock is the caller's job,
 * because it needs a POINT timezone that this has no way to know.
 */

/** Bumped when the calculation changes, so two results are never silently compared. */
export const SOLAR_ALGORITHM_VERSION = "noaa-1";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Days from the J2000.0 epoch for an ISO calendar date at 00:00 UTC. */
function julianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4)
    - Math.floor(y / 100) + Math.floor(y / 400) - 32045 - 0.5;
}

/**
 * Sunrise and sunset as UTC instants, or null where the sun does not cross the
 * horizon that day.
 *
 * Null is a real answer north of the Arctic Circle, which North Ground serves:
 * Northern Yukon has days with no sunrise. A caller must not read null as an
 * error or substitute a nearby day.
 */
export function sunriseSunset(
  latitude: number,
  longitude: number,
  date: { year: number; month: number; day: number },
): { sunrise: Date; sunset: Date } | { polar: "SUN_UP_ALL_DAY" | "SUN_DOWN_ALL_DAY" } {
  /*
   * `n` is a whole number of days since 2000-01-01 12:00 TT, not a fractional
   * Julian date: the algorithm's later terms re-add the time of day from solar
   * noon, so feeding it a JD at 00:00 UTC puts every result half a day out.
   * That produced a Charlottetown "sunrise" of 18:59 — which is what a
   * half-day error looks like when it is not obviously a half-day error.
   */
  const jd = julianDay(date.year, date.month, date.day);
  const n = Math.round(jd - 2451545.0 + 0.0008);
  /* Mean solar noon at this longitude, west negative as ISO 6709 writes it. */
  const meanSolarNoon = n - longitude / 360;
  const meanAnomaly = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const centre = 1.9148 * Math.sin(meanAnomaly * RAD)
    + 0.02 * Math.sin(2 * meanAnomaly * RAD)
    + 0.0003 * Math.sin(3 * meanAnomaly * RAD);
  const eclipticLongitude = (meanAnomaly + centre + 180 + 102.9372) % 360;
  const solarTransit = 2451545.0 + meanSolarNoon
    + 0.0053 * Math.sin(meanAnomaly * RAD)
    - 0.0069 * Math.sin(2 * eclipticLongitude * RAD);
  const declination = Math.asin(Math.sin(eclipticLongitude * RAD) * Math.sin(23.4397 * RAD));

  /*
   * -0.833° accounts for the sun's apparent radius and mean atmospheric
   * refraction at the horizon: the standard definition of sunrise, and the one
   * an authority's table uses.
   */
  const cosHourAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(latitude * RAD) * Math.sin(declination))
    / (Math.cos(latitude * RAD) * Math.cos(declination));
  if (cosHourAngle > 1) return { polar: "SUN_DOWN_ALL_DAY" };
  if (cosHourAngle < -1) return { polar: "SUN_UP_ALL_DAY" };

  const hourAngle = Math.acos(cosHourAngle) * DEG;
  const sunset = solarTransit + hourAngle / 360;
  const sunrise = solarTransit - hourAngle / 360;
  const toDate = (julian: number) => new Date((julian - 2440587.5) * 86_400_000);
  return { sunrise: toDate(sunrise), sunset: toDate(sunset) };
}

/** The wall clock in an IANA zone for a UTC instant, as "HH:MM". */
export function wallClock(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")!.value;
  const minute = parts.find((part) => part.type === "minute")!.value;
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

/** The calendar date an instant falls on in an IANA zone, as "YYYY-MM-DD". */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant);
}
