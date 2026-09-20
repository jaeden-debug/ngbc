import type { IsoDate } from "../content-contract/types.ts";
import type { WeatherResult } from "./types.ts";

const FORECAST_DAYS = 16;

function utcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export async function getWeatherContext(
  latitude: number,
  longitude: number,
  date: IsoDate,
  options: { fetcher?: typeof fetch; now?: Date } = {},
): Promise<WeatherResult> {
  const selected = utcDate(date);
  const now = options.now ?? new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOffset = selected ? Math.round((selected.valueOf() - today.valueOf()) / 86_400_000) : Number.NaN;
  if (!selected || dayOffset < 0 || dayOffset >= FORECAST_DAYS) {
    return {
      status: "UNAVAILABLE",
      summary: `A forecast is unavailable for this date. North Ground only requests forecasts from today through ${FORECAST_DAYS - 1} days ahead and does not substitute climatology.`,
      date,
      sourceId: "source:open-meteo",
    };
  }

  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: date,
    end_date: date,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset",
    timezone: "auto",
  });
  try {
    const response = await (options.fetcher ?? fetch)(`https://api.open-meteo.com/v1/forecast?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const payload = await response.json() as {
      timezone?: string;
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        sunrise?: string[];
        sunset?: string[];
      };
    };
    if (payload.daily?.time?.[0] !== date) throw new Error("Weather response did not include selected date");
    const max = payload.daily.temperature_2m_max?.[0];
    const min = payload.daily.temperature_2m_min?.[0];
    const precipitation = payload.daily.precipitation_sum?.[0];
    return {
      status: "AVAILABLE",
      summary: `Forecast: ${min ?? "unknown"} to ${max ?? "unknown"} °C with ${precipitation ?? "unknown"} mm precipitation. Recheck before departure.`,
      date,
      temperatureMaxC: max,
      temperatureMinC: min,
      precipitationMm: precipitation,
      sunrise: payload.daily.sunrise?.[0],
      sunset: payload.daily.sunset?.[0],
      timezone: payload.timezone,
      sourceId: "source:open-meteo",
    };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      summary: "The forecast provider is temporarily unavailable. North Ground will not fabricate weather data.",
      date,
      sourceId: "source:open-meteo",
    };
  }
}
