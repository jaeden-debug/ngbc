import assert from "node:assert/strict";
import test from "node:test";
import { getGoogleWeather, getOpenMeteoWeather } from "./weather.ts";

function stub(payload: unknown, ok = true) {
  return (async () => ({ ok, status: ok ? 200 : 503, json: async () => payload })) as unknown as typeof fetch;
}

/** The evaluated day, pinned so the forecast horizon is deterministic. */
const NOW = new Date("2026-09-20T12:00:00Z");

const GOOGLE_DAY = {
  forecastDays: [{
    displayDate: { year: 2026, month: 9, day: 20 },
    maxTemperature: { degrees: 19 },
    minTemperature: { degrees: 4.2 },
    daytimeForecast: { precipitation: { qpf: { quantity: 0.02 } } },
    nighttimeForecast: { precipitation: { qpf: { quantity: 0 } } },
    // Google reports sun events as UTC instants.
    sunEvents: { sunriseTime: "2026-09-20T10:56:00Z", sunsetTime: "2026-09-20T23:12:00Z" },
  }],
  timeZone: { id: "America/Toronto" },
};

test("Google sun times are reported on the hunt location's clock, not in UTC", async () => {
  const result = await getGoogleWeather(45.23, -77.94, "2026-09-20", {
    googleApiKey: "test-key", now: NOW,
    fetcher: stub(GOOGLE_DAY),
  });
  assert.equal(result.status, "AVAILABLE");
  // 10:56Z is 06:56 in Ontario. Showing 10:56 to a hunter is a defect, not a nuance.
  assert.equal(result.sunrise, "2026-09-20T06:56");
  assert.equal(result.sunset, "2026-09-20T19:12");
  assert.equal(result.timezone, "America/Toronto");
});

test("Open-Meteo already reports local wall-clock times and is left alone", async () => {
  const result = await getOpenMeteoWeather(45.23, -77.94, "2026-09-20", {
    fetcher: stub({
      timezone: "America/Toronto",
      daily: {
        time: ["2026-09-20"], temperature_2m_max: [19], temperature_2m_min: [4.2],
        precipitation_sum: [0], sunrise: ["2026-09-20T06:56"], sunset: ["2026-09-20T19:12"],
      },
    }),
  });
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.sunrise, "2026-09-20T06:56");
  assert.equal(result.sunset, "2026-09-20T19:12");
});

test("both providers agree on the shape the interface renders", async () => {
  const google = await getGoogleWeather(45.23, -77.94, "2026-09-20", { googleApiKey: "k", now: NOW, fetcher: stub(GOOGLE_DAY) });
  const shape = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  assert.match(google.sunrise!, shape);
  assert.match(google.sunset!, shape);
});

test("an unusable sun time is omitted rather than shown wrong", async () => {
  const result = await getGoogleWeather(45.23, -77.94, "2026-09-20", {
    googleApiKey: "k", now: NOW,
    fetcher: stub({
      ...GOOGLE_DAY,
      forecastDays: [{ ...GOOGLE_DAY.forecastDays[0], sunEvents: { sunriseTime: "not-a-time" } }],
    }),
  });
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.sunrise, undefined);
});

test("a provider outage never becomes fabricated weather", async () => {
  const result = await getGoogleWeather(45.23, -77.94, "2026-09-20", { googleApiKey: "k", now: NOW, fetcher: stub({}, false) });
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.equal(result.temperatureMaxC, undefined);
  assert.match(result.summary, /will not fabricate/);
});
