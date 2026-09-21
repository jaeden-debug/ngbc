import type { IsoDate } from "../content-contract/types.ts";
import type { WeatherResult } from "./types.ts";

export type WeatherProviderName = "google" | "open-meteo";

export interface WeatherRequestOptions {
  fetcher?: typeof fetch;
  now?: Date;
  provider?: WeatherProviderName;
  googleApiKey?: string;
}

function utcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dayOffset(date: IsoDate, now: Date): number {
  const selected = utcDate(date);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return selected ? Math.round((selected.valueOf() - today.valueOf()) / 86_400_000) : Number.NaN;
}

function unavailable(date: IsoDate, horizon: number, sourceId: WeatherResult["sourceId"]): WeatherResult {
  return {
    status: "UNAVAILABLE",
    summary: `A forecast is unavailable for this date. North Ground only requests forecasts from today through ${horizon - 1} days ahead and does not substitute climatology.`,
    date,
    sourceId,
  };
}

export async function getOpenMeteoWeather(
  latitude: number,
  longitude: number,
  date: IsoDate,
  options: Pick<WeatherRequestOptions, "fetcher" | "now"> = {},
): Promise<WeatherResult> {
  const horizon = 16;
  const offset = dayOffset(date, options.now ?? new Date());
  if (!Number.isFinite(offset) || offset < 0 || offset >= horizon) return unavailable(date, horizon, "source:open-meteo");

  const parameters = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), start_date: date, end_date: date,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset", timezone: "auto",
  });
  try {
    const response = await (options.fetcher ?? fetch)(`https://api.open-meteo.com/v1/forecast?${parameters}`, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(6_000), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const payload = await response.json() as {
      timezone?: string;
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_sum?: number[]; sunrise?: string[]; sunset?: string[] };
    };
    if (payload.daily?.time?.[0] !== date) throw new Error("Weather response did not include selected date");
    const max = payload.daily.temperature_2m_max?.[0];
    const min = payload.daily.temperature_2m_min?.[0];
    const precipitation = payload.daily.precipitation_sum?.[0];
    return {
      status: "AVAILABLE", summary: `Forecast: ${min ?? "unknown"} to ${max ?? "unknown"} °C with ${precipitation ?? "unknown"} mm precipitation. Recheck before departure.`,
      date, temperatureMaxC: max, temperatureMinC: min, precipitationMm: precipitation,
      sunrise: payload.daily.sunrise?.[0], sunset: payload.daily.sunset?.[0], timezone: payload.timezone, sourceId: "source:open-meteo",
    };
  } catch {
    return { status: "PROVIDER_ERROR", summary: "The Open-Meteo forecast provider is temporarily unavailable. North Ground will not fabricate weather data.", date, sourceId: "source:open-meteo" };
  }
}

/**
 * Put a provider instant into the forecast location's own clock.
 *
 * Open-Meteo is asked for `timezone=auto` and answers with local wall-clock times
 * (`2026-09-20T06:56`). Google answers with a UTC instant
 * (`2026-09-20T10:56:00Z`). Rendering both by slicing the string showed Ontario
 * hunters a 10:56 sunrise, so Google's instants are converted here and both
 * providers hand back the same local wall-clock shape.
 *
 * Sunrise and sunset remain environmental context. They are never a certified
 * legal hunting time, whichever provider supplied them.
 */
function toLocalWallClock(instant: string | undefined, timeZone: string | undefined): string | undefined {
  if (!instant) return undefined;
  if (!timeZone) return instant;
  const stamp = new Date(instant);
  if (Number.isNaN(stamp.valueOf())) return undefined;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(stamp).reduce<Record<string, string>>((accumulated, part) => {
      accumulated[part.type] = part.value;
      return accumulated;
    }, {});
    if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) return undefined;
    const hour = parts.hour === "24" ? "00" : parts.hour;
    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
  } catch {
    // An unrecognised time-zone id is not a reason to show the wrong time.
    return undefined;
  }
}

export async function getGoogleWeather(
  latitude: number,
  longitude: number,
  date: IsoDate,
  options: WeatherRequestOptions = {},
): Promise<WeatherResult> {
  const horizon = 10;
  const offset = dayOffset(date, options.now ?? new Date());
  if (!Number.isFinite(offset) || offset < 0 || offset >= horizon) return unavailable(date, horizon, "source:google-weather");
  const key = options.googleApiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) return { status: "PROVIDER_ERROR", summary: "The Google Weather provider is not configured.", date, sourceId: "source:google-weather" };

  const parameters = new URLSearchParams({
    key, "location.latitude": String(latitude), "location.longitude": String(longitude),
    days: String(offset + 1), pageSize: String(offset + 1), unitsSystem: "METRIC", languageCode: "en-CA",
  });
  try {
    const response = await (options.fetcher ?? fetch)(`https://weather.googleapis.com/v1/forecast/days:lookup?${parameters}`, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(6_000), cache: "no-store",
    });
    if (!response.ok) {
      /* Google explains a refusal in its own words ("API key expired"), which
         never echo the key or the location, so the reason is kept for the log. */
      const reason = await response.json().then(
        (body: { error?: { status?: string; message?: string } }) => [body.error?.status, body.error?.message].filter(Boolean).join(": "),
        () => "",
      );
      throw new Error(`Google Weather returned ${response.status}${reason ? ` (${reason.slice(0, 160)})` : ""}`);
    }
    const payload = await response.json() as {
      forecastDays?: Array<{
        displayDate?: { year?: number; month?: number; day?: number };
        maxTemperature?: { degrees?: number }; minTemperature?: { degrees?: number };
        daytimeForecast?: { precipitation?: { qpf?: { quantity?: number } } };
        nighttimeForecast?: { precipitation?: { qpf?: { quantity?: number } } };
        sunEvents?: { sunriseTime?: string; sunsetTime?: string };
      }>;
      timeZone?: { id?: string };
    };
    const forecast = payload.forecastDays?.find(({ displayDate }) => displayDate
      && `${displayDate.year}-${String(displayDate.month).padStart(2, "0")}-${String(displayDate.day).padStart(2, "0")}` === date);
    if (!forecast) throw new Error("Google Weather response did not include selected date");
    const max = forecast.maxTemperature?.degrees;
    const min = forecast.minTemperature?.degrees;
    const precipitation = (forecast.daytimeForecast?.precipitation?.qpf?.quantity ?? 0) + (forecast.nighttimeForecast?.precipitation?.qpf?.quantity ?? 0);
    return {
      status: "AVAILABLE", summary: `Google forecast: ${min ?? "unknown"} to ${max ?? "unknown"} °C with ${precipitation} mm precipitation. Recheck before departure.`,
      date, temperatureMaxC: max, temperatureMinC: min, precipitationMm: precipitation,
      sunrise: toLocalWallClock(forecast.sunEvents?.sunriseTime, payload.timeZone?.id),
      sunset: toLocalWallClock(forecast.sunEvents?.sunsetTime, payload.timeZone?.id),
      timezone: payload.timeZone?.id, sourceId: "source:google-weather",
    };
  } catch (error) {
    /* A provider failing silently for months is the failure §58 forbids: the
       Open-Meteo fallback answered correctly, so nothing looked wrong while every
       Google request was being refused. Logged with the reason only — never the
       coordinates, the date or the key. */
    const reason = error instanceof Error && error.message.startsWith("Google Weather")
      ? error.message
      : error instanceof Error ? error.name : "unknown error";
    console.warn(`[hunt-weather] Google Weather failed: ${reason}`);
    return { status: "PROVIDER_ERROR", summary: "The Google Weather provider is temporarily unavailable. North Ground will not fabricate weather data.", date, sourceId: "source:google-weather" };
  }
}

export async function getWeatherContext(
  latitude: number,
  longitude: number,
  date: IsoDate,
  options: WeatherRequestOptions = {},
): Promise<WeatherResult> {
  const provider = options.provider ?? (process.env.WEATHER_PROVIDER?.trim() || "open-meteo");
  if (provider === "google") {
    const result = await getGoogleWeather(latitude, longitude, date, options);
    if (result.status !== "PROVIDER_ERROR" || process.env.WEATHER_FALLBACK_PROVIDER !== "open-meteo") return result;
  }
  return getOpenMeteoWeather(latitude, longitude, date, options);
}
