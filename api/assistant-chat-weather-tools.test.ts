import test from "node:test";
import assert from "node:assert/strict";

import {
  createAssistantChatWeatherTools,
  shouldRegisterAssistantChatWeatherTools,
} from "./assistant-chat-weather-tools.ts";

const GUANGZHOU = "\u5e7f\u5dde";
const GUANGZHOU_BAIYUN = "\u5e7f\u5dde\u5e02\u767d\u4e91\u533a";
const WEATHER_TEXT = "\u4eca\u5929\u7684\u5929\u6c14\u600e\u4e48\u6837\uff1f";
const DESIGN_TEXT = "\u5e2e\u6211\u8bbe\u8ba1\u4e00\u4e2a\u7535\u5546\u6d77\u62a5";

const toResponse = (payload: unknown) =>
  ({
    ok: true,
    json: async () => payload,
  }) as Response;

const createWeatherFetchFn = (options: {
  onGeocode?: (query: string) => unknown;
  onForecast?: (url: URL) => unknown;
}) => {
  return async (input: string | URL | Request) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl);

    if (url.hostname === "photon.komoot.io") {
      return toResponse(
        options.onGeocode?.(url.searchParams.get("q") || "") ?? { features: [] },
      );
    }

    if (url.hostname === "api.open-meteo.com") {
      return toResponse(options.onForecast?.(url) ?? {});
    }

    throw new Error(`Unexpected weather test URL: ${url.toString()}`);
  };
};

test("assistant chat weather tools only auto-register for weather messages", () => {
  assert.equal(
    shouldRegisterAssistantChatWeatherTools([
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: WEATHER_TEXT }],
      } as any,
    ]),
    true,
  );

  assert.equal(
    shouldRegisterAssistantChatWeatherTools([
      {
        id: "msg-2",
        role: "user",
        parts: [{ type: "text", text: DESIGN_TEXT }],
      } as any,
    ]),
    false,
  );
});

test("assistant chat weather registers an AI SDK getWeather tool", () => {
  const result = createAssistantChatWeatherTools({ enabled: true });

  assert.equal(result.reason, "registered");
  assert.deepEqual(Object.keys(result.tools), ["getWeather"]);
  assert.equal(
    (result.tools.getWeather as any).description.includes("weather"),
    true,
  );
  assert.equal(
    (result.tools.getWeather as any).description.includes("present"),
    false,
  );
});

test("assistant chat weather tool maps geocoded Open-Meteo data to widget-friendly output", async () => {
  const fetchFn = createWeatherFetchFn({
    onGeocode: (query) => {
      assert.equal(query, GUANGZHOU);
      return {
        features: [
          {
            properties: {
              type: "city",
              name: "广州市",
              country: "中国",
              state: "广东省",
              city: "广州市",
            },
            geometry: {
              coordinates: [113.2644, 23.1291],
            },
          },
        ],
      };
    },
    onForecast: (url) => {
      assert.equal(url.searchParams.get("temperature_unit"), "celsius");
      return {
        latitude: 23.1291,
        longitude: 113.2644,
        timezone: "Asia/Shanghai",
        current_units: {
          temperature_2m: "°C",
          relative_humidity_2m: "%",
          precipitation: "mm",
          wind_speed_10m: "km/h",
          wind_direction_10m: "°",
          visibility: "m",
        },
        current: {
          time: "2026-07-02T13:15",
          temperature_2m: 32.1,
          relative_humidity_2m: 74,
          apparent_temperature: 37.0,
          is_day: 1,
          precipitation: 0.4,
          weather_code: 2,
          wind_speed_10m: 15.2,
          wind_direction_10m: 120,
          visibility: 10000,
        },
        daily: {
          time: ["2026-07-02", "2026-07-03"],
          weather_code: [3, 61],
          temperature_2m_max: [35.0, 34.0],
          temperature_2m_min: [28.0, 27.0],
          precipitation_probability_max: [15, 65],
        },
      };
    },
  });

  const result = createAssistantChatWeatherTools(
    { enabled: true, forecastDays: 2 },
    { fetchFn: fetchFn as any },
  );
  const output = await (result.tools.getWeather as any).execute({
    location: GUANGZHOU,
    unit: "celsius",
  });

  assert.equal(output.location.name, GUANGZHOU);
  assert.equal(output.location.resolvedName, "广州市, 广东省, 中国");
  assert.equal(output.location.timezone, "Asia/Shanghai");
  assert.equal(output.temperature, 32.1);
  assert.equal(output.temperatureUnit, "°C");
  assert.equal(output.condition, "Partly cloudy");
  assert.equal(output.windSpeedUnit, "km/h");
  assert.equal(output.visibilityUnit, "km");
  assert.equal(output.visibility, 10);
  assert.equal(output.forecast.length, 2);
  assert.equal(output.forecast[0].condition, "Overcast");
  assert.equal(output.forecast[1].condition, "Rain");
  assert.equal(output.id, output.widget.id);
  assert.equal(output.widget.location.name, GUANGZHOU);
  assert.equal(output.widget.units.temperature, "celsius");
  assert.equal(output.widget.current.conditionCode, "partly-cloudy");
  assert.equal(output.widget.forecast[0]?.label, "今天");
  assert.match(output.widget.forecast[1]?.label || "", /^星期/);
  assert.equal(output.widget.forecast[0]?.conditionCode, "overcast");
  assert.equal(output.widget.forecast[1]?.conditionCode, "rain");
});

test("assistant chat weather tool supports district-level Chinese queries", async () => {
  const geocodeQueries: string[] = [];

  const fetchFn = createWeatherFetchFn({
    onGeocode: (query) => {
      geocodeQueries.push(query);
      return {
        features: [
          {
            properties: {
              type: "district",
              name: "白云区",
              country: "中国",
              state: "广东省",
              city: "广州市",
              district: "白云区",
            },
            geometry: {
              coordinates: [113.2679, 23.1606],
            },
          },
        ],
      };
    },
    onForecast: () => ({
      latitude: 23.1606,
      longitude: 113.2679,
      timezone: "Asia/Shanghai",
      current_units: {
        temperature_2m: "°C",
        relative_humidity_2m: "%",
        precipitation: "mm",
        wind_speed_10m: "km/h",
      },
      current: {
        time: "2026-07-02T13:15",
        temperature_2m: 30,
        relative_humidity_2m: 79,
        apparent_temperature: 36,
        is_day: 1,
        precipitation: 0,
        weather_code: 2,
        wind_speed_10m: 9,
        wind_direction_10m: 116,
        visibility: 9000,
      },
      daily: {
        time: ["2026-07-02"],
        weather_code: [61],
        temperature_2m_max: [36],
        temperature_2m_min: [28],
        precipitation_probability_max: [55],
      },
    }),
  });

  const result = createAssistantChatWeatherTools(
    { enabled: true, forecastDays: 1 },
    { fetchFn: fetchFn as any },
  );
  const output = await (result.tools.getWeather as any).execute({
    location: GUANGZHOU_BAIYUN,
    unit: "celsius",
  });

  assert.equal(geocodeQueries[0], "白云区 广州");
  assert.equal(output.id, output.widget.id);
  assert.equal(output.location.name, GUANGZHOU_BAIYUN);
  assert.equal(output.location.resolvedName, "白云区, 广州市, 广东省, 中国");
  assert.equal(output.temperature, 30);
  assert.equal(output.condition, "Partly cloudy");
  assert.equal(output.widget.location.name, GUANGZHOU_BAIYUN);
});

test("assistant chat weather tool falls back when a district query resolves to the wrong city", async () => {
  const geocodeQueries: string[] = [];

  const fetchFn = createWeatherFetchFn({
    onGeocode: (query) => {
      geocodeQueries.push(query);

      if (query.includes("白云")) {
        return {
          features: [
            {
              properties: {
                type: "district",
                name: "白云区",
                country: "中国",
                state: "重庆市",
                district: "白云区",
              },
              geometry: {
                coordinates: [107.4184, 29.3131],
              },
            },
          ],
        };
      }

      if (query === "广州") {
        return {
          features: [
            {
              properties: {
                type: "city",
                name: "广州市",
                country: "中国",
                state: "广东省",
                city: "广州市",
              },
              geometry: {
                coordinates: [113.2644, 23.1291],
              },
            },
          ],
        };
      }

      return { features: [] };
    },
    onForecast: (url) => {
      assert.equal(url.searchParams.get("latitude"), "23.1291");
      assert.equal(url.searchParams.get("longitude"), "113.2644");
      return {
        latitude: 23.1291,
        longitude: 113.2644,
        timezone: "Asia/Shanghai",
        current_units: {
          temperature_2m: "°C",
          relative_humidity_2m: "%",
          precipitation: "mm",
          wind_speed_10m: "km/h",
        },
        current: {
          time: "2026-07-02T13:15",
          temperature_2m: 31,
          relative_humidity_2m: 77,
          apparent_temperature: 36,
          is_day: 1,
          precipitation: 0,
          weather_code: 2,
          wind_speed_10m: 10,
          wind_direction_10m: 113,
          visibility: 10000,
        },
        daily: {
          time: ["2026-07-02"],
          weather_code: [2],
          temperature_2m_max: [35],
          temperature_2m_min: [27],
          precipitation_probability_max: [15],
        },
      };
    },
  });

  const result = createAssistantChatWeatherTools(
    { enabled: true, forecastDays: 1 },
    { fetchFn: fetchFn as any },
  );

  const output = await (result.tools.getWeather as any).execute({
    location: GUANGZHOU_BAIYUN,
    unit: "celsius",
  });

  assert.equal(geocodeQueries[0], "白云区 广州");
  assert.equal(geocodeQueries.includes("广州"), true);
  assert.equal(output.id, output.widget.id);
  assert.equal(output.location.name, GUANGZHOU_BAIYUN);
  assert.equal(output.location.resolvedName, "广州市, 广东省, 中国");
  assert.equal(output.widget.location.name, GUANGZHOU_BAIYUN);
});

test("assistant chat weather tool recovers a fuller location from the latest user message", async () => {
  const geocodeQueries: string[] = [];

  const fetchFn = createWeatherFetchFn({
    onGeocode: (query) => {
      geocodeQueries.push(query);
      return {
        features: [
          {
            properties: {
              type: "district",
              name: "白云区",
              country: "中国",
              state: "广东省",
              city: "广州市",
              district: "白云区",
            },
            geometry: {
              coordinates: [113.2679, 23.1606],
            },
          },
        ],
      };
    },
    onForecast: () => ({
      latitude: 23.1606,
      longitude: 113.2679,
      timezone: "Asia/Shanghai",
      current_units: {
        temperature_2m: "°C",
        relative_humidity_2m: "%",
        precipitation: "mm",
        wind_speed_10m: "km/h",
      },
      current: {
        time: "2026-07-02T13:15",
        temperature_2m: 29,
        relative_humidity_2m: 81,
        apparent_temperature: 33,
        is_day: 1,
        precipitation: 0,
        weather_code: 2,
        wind_speed_10m: 12,
        wind_direction_10m: 102,
        visibility: 9500,
      },
      daily: {
        time: ["2026-07-02"],
        weather_code: [2],
        temperature_2m_max: [34],
        temperature_2m_min: [27],
        precipitation_probability_max: [20],
      },
    }),
  });

  const result = createAssistantChatWeatherTools(
    { enabled: true, forecastDays: 1 },
    {
      fetchFn: fetchFn as any,
      messages: [
        {
          id: "msg-user-weather",
          role: "user",
          parts: [{ type: "text", text: "广州市白云区今天天气怎么样" }],
        } as any,
      ],
    },
  );
  const output = await (result.tools.getWeather as any).execute({
    location: "白云区",
    unit: "celsius",
  });

  assert.equal(geocodeQueries[0], "白云区 广州");
  assert.equal(output.id, output.widget.id);
  assert.equal(output.location.name, GUANGZHOU_BAIYUN);
  assert.equal(output.widget.location.name, GUANGZHOU_BAIYUN);
});
