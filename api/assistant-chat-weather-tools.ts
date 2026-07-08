import { tool, type ToolSet, type UIMessage } from "ai";
import type {
  ForecastDay,
  PrecipitationLevel,
  WeatherConditionCode,
  WeatherWidgetPayload,
} from "../components/assistant-ui/tool-ui/weather-widget/runtime.ts";

import {
  assistantSidebarGetWeatherParameters,
  type AssistantSidebarGetWeatherArgs,
} from "../services/assistant-ui/assistant-sidebar-tool-schemas.ts";

export type AssistantChatWeatherToolsConfig = {
  enabled?: boolean;
  forecastDays?: number | null;
};

export type AssistantChatWeatherToolsResult = {
  tools: ToolSet;
  reason: "disabled" | "registered";
};

type WeatherToolDependencies = {
  fetchFn?: typeof fetch;
  messages?: UIMessage[];
};

type NominatimAddress = {
  country?: string;
  state?: string;
  province?: string;
  region?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  district?: string;
  city_district?: string;
  suburb?: string;
  borough?: string;
  neighbourhood?: string;
};

type NominatimSearchResult = {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  importance?: number;
  place_rank?: number;
  type?: string;
  address?: NominatimAddress;
};

type PhotonFeature = {
  properties?: {
    type?: string;
    name?: string;
    country?: string;
    state?: string;
    city?: string;
    district?: string;
    county?: string;
    suburb?: string;
    borough?: string;
    locality?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type PhotonSearchResponse = {
  features?: PhotonFeature[];
};

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  is_day?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  visibility?: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
};

type OpenMeteoForecastResponse = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current_units?: {
    temperature_2m?: string;
    relative_humidity_2m?: string;
    precipitation?: string;
    wind_speed_10m?: string;
    wind_direction_10m?: string;
    visibility?: string;
  };
  current?: OpenMeteoCurrent;
  daily?: OpenMeteoDaily;
};

type ResolvedWeatherLocation = {
  query: string;
  latitude: number;
  longitude: number;
  displayName: string;
  country: string;
  admin1: string;
  admin2: string;
};

type AssistantChatWeatherToolOutput = {
  id: string;
  widget: WeatherWidgetPayload;
  location: {
    name: string;
    resolvedName: string;
    latitude?: number;
    longitude?: number;
    timezone: string;
    country: string;
    admin1: string;
    admin2: string;
  };
  unit: "celsius" | "fahrenheit";
  temperature: number;
  temperatureUnit: string;
  apparentTemperature?: number;
  humidity?: number;
  humidityUnit: string;
  windSpeed?: number;
  windSpeedUnit: string;
  windDirection?: number;
  precipitation?: number;
  precipitationUnit: string;
  visibility?: number;
  visibilityUnit: string;
  conditionCode?: number;
  condition: string;
  isDay: boolean;
  localTimeOfDay: number;
  forecast: Array<{
    date: string;
    tempMax?: number;
    tempMin?: number;
    conditionCode?: number;
    condition: string;
    precipitationProbability?: number;
    isDay: boolean;
  }>;
  updatedAt: string;
  source: {
    name: string;
    url: string;
  };
};

const WEATHER_TRIGGER_PATTERN =
  /(?:天气|气温|温度|几度|冷不冷|热不热|下雨|下雪|降水|刮风|风速|湿度|weather|forecast|temperature|rain|snow|wind|humidity)/i;

const WEATHER_KEYWORD_PATTERN =
  /(?:天气|气温|温度|湿度|风速|降水|下雨|下雪|forecast|weather|temperature|humidity|wind|rain|snow)/i;

const HELPER_PREFIX_PATTERN =
  /^(?:帮我|麻烦|请问|请|可以|能不能|我想知道|告诉我|查一下|查查|看一下|看看|查询一下|搜一下)\s*/u;

const TEMPORAL_NOISE_PATTERN =
  /(?:今天|明天|后天|现在|当前|此刻|今日|这周|本周|最近|未来\d+[天日]?|未来几天|这一周|today|tomorrow|now|current|this week|next \d+ days?)/giu;

const ADMIN_SUFFIX_PATTERN =
  /(特别行政区|自治区|自治州|街道|地区|省|市|区|县|旗|镇|乡|盟)$/u;

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const clampForecastDays = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(7, Math.floor(numeric)));
};

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const pickNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
};

const compactLocationText = (value: unknown): string =>
  normalizeString(value)
    .replace(/[()]/g, " ")
    .replace(/[,\u3001\uff0c/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();

const trimLocationPhrase = (value: unknown): string =>
  normalizeString(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[,，。.!！？：:；;\s]+|[,，。.!！？：:；;\s]+$/gu, "")
    .replace(/^(?:在|于)\s*/u, "")
    .replace(/\s*(?:怎么样|如何|咋样|呢|吗)\s*$/u, "")
    .trim();

const getMessageText = (message: UIMessage | undefined): string => {
  if (!message) return "";
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .map((part) =>
      part && typeof part === "object" && "type" in part && part.type === "text"
        ? normalizeString((part as { text?: unknown }).text)
        : "",
    )
    .filter(Boolean)
    .join("\n");
};

const extractWeatherLocationFromMessage = (messageText: string): string => {
  const normalized = normalizeString(messageText)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
  if (!normalized) return "";

  const englishMatch = normalized.match(
    /(?:weather|forecast|temperature|humidity|wind|rain|snow)\s+(?:in|for)\s+(.+)$/i,
  );
  if (englishMatch?.[1]) {
    return trimLocationPhrase(englishMatch[1]);
  }

  const withoutPrefix = normalized.replace(HELPER_PREFIX_PATTERN, "");
  const withoutTemporalNoise = withoutPrefix.replace(TEMPORAL_NOISE_PATTERN, " ");

  const keywordIndex = withoutTemporalNoise.search(WEATHER_KEYWORD_PATTERN);
  if (keywordIndex >= 0) {
    return trimLocationPhrase(withoutTemporalNoise.slice(0, keywordIndex));
  }

  return trimLocationPhrase(withoutTemporalNoise);
};

const resolveRequestedWeatherLocation = (options: {
  inputLocation: string;
  messages: UIMessage[] | undefined;
}): string => {
  const inputLocation = normalizeString(options.inputLocation);
  const latestUserMessage = options.messages
    ? [...options.messages].reverse().find((message) => message.role === "user")
    : undefined;
  const messageLocation = extractWeatherLocationFromMessage(
    getMessageText(latestUserMessage),
  );
  if (!messageLocation) return inputLocation;
  if (!inputLocation) return messageLocation;

  const compactInputLocation = compactLocationText(inputLocation);
  const compactMessageLocation = compactLocationText(messageLocation);
  const shouldPreferMessageLocation =
    compactMessageLocation.length > compactInputLocation.length &&
    compactMessageLocation.includes(compactInputLocation);

  return shouldPreferMessageLocation ? messageLocation : inputLocation;
};

export const shouldRegisterAssistantChatWeatherTools = (
  messages: UIMessage[],
): boolean => {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return WEATHER_TRIGGER_PATTERN.test(getMessageText(lastUserMessage));
};

const fetchJson = async <T>(
  fetchFn: typeof fetch,
  url: string,
): Promise<T> => {
  const response = await fetchFn(url, {
    headers: {
      "User-Agent": "XC-Studio-Assistant-Weather/1.0",
      Accept: "application/json",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`weather_fetch_failed_${response.status}`);
  }
  return response.json() as Promise<T>;
};

const toNumber = (value: unknown): number | undefined => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const mapOpenMeteoCodeToCondition = (
  code: unknown,
  windSpeed?: number,
): WeatherConditionCode => {
  const numericCode = Number(code);
  if (windSpeed !== undefined && windSpeed >= 45 && numericCode <= 3) {
    return "windy";
  }

  switch (numericCode) {
    case 0:
      return "clear";
    case 1:
    case 2:
      return "partly-cloudy";
    case 3:
      return "overcast";
    case 45:
    case 48:
      return "fog";
    case 51:
    case 53:
    case 55:
      return "drizzle";
    case 56:
    case 57:
    case 66:
    case 67:
      return "sleet";
    case 61:
    case 63:
    case 80:
    case 81:
      return "rain";
    case 65:
    case 82:
      return "heavy-rain";
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return "snow";
    case 95:
      return "thunderstorm";
    case 96:
    case 99:
      return "hail";
    default:
      return "cloudy";
  }
};

const describeOpenMeteoCondition = (
  code: unknown,
  windSpeed?: number,
): string => {
  switch (mapOpenMeteoCodeToCondition(code, windSpeed)) {
    case "clear":
      return "Clear";
    case "partly-cloudy":
      return "Partly cloudy";
    case "cloudy":
      return "Cloudy";
    case "overcast":
      return "Overcast";
    case "fog":
      return "Fog";
    case "drizzle":
      return "Drizzle";
    case "rain":
      return "Rain";
    case "heavy-rain":
      return "Heavy rain";
    case "thunderstorm":
      return "Thunderstorm";
    case "snow":
      return "Snow";
    case "sleet":
      return "Sleet";
    case "hail":
      return "Hail";
    case "windy":
      return "Windy";
    default:
      return "Weather";
  }
};

const mapPrecipitationLevel = (
  precipitation: number | undefined,
): PrecipitationLevel | undefined => {
  if (precipitation === undefined) return undefined;
  if (precipitation <= 0) return "none";
  if (precipitation < 1) return "light";
  if (precipitation < 4) return "moderate";
  return "heavy";
};

const formatForecastLabel = (date: string, index: number): string => {
  if (index === 0) return "今天";
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return `第 ${index + 1} 天`;
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parsedDate);
};

const buildWeatherWidgetPayload = (input: {
  id: string;
  locationName: string;
  unit: "celsius" | "fahrenheit";
  currentTemperature: number;
  tempMin: number;
  tempMax: number;
  windSpeed?: number;
  precipitation?: number;
  visibility?: number;
  conditionCode?: number;
  forecast: AssistantChatWeatherToolOutput["forecast"];
  localTimeOfDay: number;
  updatedAt: string;
  isDay: boolean;
}): WeatherWidgetPayload => {
  const widgetForecast: ForecastDay[] = input.forecast
    .map((day, index) => {
      if (day.tempMin === undefined || day.tempMax === undefined) return null;
      return {
        label: formatForecastLabel(day.date, index),
        conditionCode: mapOpenMeteoCodeToCondition(day.conditionCode, undefined),
        tempMin: day.tempMin,
        tempMax: day.tempMax,
      } satisfies ForecastDay;
    })
    .filter((day): day is ForecastDay => Boolean(day));

  return {
    version: "3.1",
    id: input.id,
    location: {
      name: input.locationName,
    },
    units: {
      temperature: input.unit,
    },
    current: {
      conditionCode: mapOpenMeteoCodeToCondition(
        input.conditionCode,
        input.windSpeed,
      ),
      temperature: input.currentTemperature,
      tempMin: input.tempMin,
      tempMax: input.tempMax,
      ...(input.windSpeed !== undefined ? { windSpeed: input.windSpeed } : {}),
      ...(mapPrecipitationLevel(input.precipitation) !== undefined
        ? { precipitationLevel: mapPrecipitationLevel(input.precipitation) }
        : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
    forecast: widgetForecast,
    time: {
      localTimeOfDay: input.localTimeOfDay,
    },
    updatedAt: input.updatedAt,
  };
};

const buildWeatherLookupCandidates = (location: string): string[] => {
  const normalized = normalizeString(location);
  if (!normalized) return [];

  const compact = normalized
    .replace(/[()]/g, " ")
    .replace(/[,\u3001\uff0c/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const collapsed = compact.replace(/\s+/g, "");
  const seeds: string[] = [];

  const pushSeed = (...values: Array<string | undefined>) => {
    for (const value of values) {
      const nextValue = normalizeString(value);
      if (nextValue) seeds.push(nextValue);
    }
  };

  pushSeed(normalized, compact, collapsed);

  const provinceMatch = collapsed.match(/^(.+?(?:省|自治区|特别行政区))/u);
  const province = provinceMatch?.[1] ?? "";
  const afterProvince = province ? collapsed.slice(province.length) : collapsed;
  const cityMatch = afterProvince.match(/^(.+?(?:市|自治州|地区|盟))/u);
  const city = cityMatch?.[1] ?? "";
  const afterCity = city ? afterProvince.slice(city.length) : afterProvince;
  const districtMatch = afterCity.match(/^(.+?(?:区|县|旗|镇|乡|街道))/u);
  const district = districtMatch?.[1] ?? "";

  pushSeed(province && city ? `${province}${city}` : undefined);
  pushSeed(city);
  pushSeed(city && district ? `${city}${district}` : undefined);
  pushSeed(district);
  pushSeed(
    district ? district.replace(/(?:区|县|旗|镇|乡|街道)$/u, "") : undefined,
  );

  if (!city && !district) {
    pushSeed(collapsed.replace(ADMIN_SUFFIX_PATTERN, ""));
  }

  return uniqueStrings(seeds);
};

const parseChineseLocationParts = (
  location: string,
): {
  province: string;
  city: string;
  district: string;
} => {
  const collapsed = normalizeString(location).replace(/\s+/g, "");
  const provinceMatch = collapsed.match(/^(.+?(?:省|自治区|特别行政区))/u);
  const province = provinceMatch?.[1] ?? "";
  const afterProvince = province ? collapsed.slice(province.length) : collapsed;
  const cityMatch = afterProvince.match(/^(.+?(?:市|自治州|地区|盟))/u);
  const city = cityMatch?.[1] ?? "";
  const afterCity = city ? afterProvince.slice(city.length) : afterProvince;
  const districtMatch = afterCity.match(/^(.+?(?:区|县|旗|镇|乡|街道))/u);
  const district = districtMatch?.[1] ?? "";

  return { province, city, district };
};

const buildPreferredWeatherLookupCandidates = (location: string): string[] => {
  const normalized = normalizeString(location);
  if (!normalized) return [];

  return uniqueStrings([
    normalized,
    compactLocationText(normalized),
    ...buildWeatherLookupCandidates(location),
  ]);
};

const buildPhotonSearchQueries = (location: string): string[] => {
  const normalized = normalizeString(location);
  if (!normalized) return [];

  const { city, district } = parseChineseLocationParts(normalized);
  const cityWithoutSuffix = city.replace(/市$/u, "");
  const locationTokens = getLocationTokens(normalized);

  return uniqueStrings([
    district && cityWithoutSuffix ? `${district} ${cityWithoutSuffix}` : "",
    district && city ? `${district} ${city}` : "",
    cityWithoutSuffix && district ? `${cityWithoutSuffix} ${district}` : "",
    city && district ? `${city} ${district}` : "",
    locationTokens.join(" "),
    normalized,
  ]);
};

const getLocationTokens = (value: string): string[] => {
  const normalized = normalizeString(value)
    .replace(/[()]/g, " ")
    .replace(/[,\u3001\uff0c/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const withBoundaries = normalized.replace(
    /(特别行政区|自治区|自治州|街道|地区|省|市|区|县|旗|镇|乡|盟)/gu,
    "$1 ",
  );

  return uniqueStrings(
    withBoundaries
      .split(/\s+/)
      .map((token) => token.replace(ADMIN_SUFFIX_PATTERN, "").trim().toLowerCase())
      .filter((token) =>
        /[a-z]/i.test(token) ? token.length >= 3 : token.length >= 2,
      ),
  );
};

const buildResolvedLocationName = (result: NominatimSearchResult): string =>
  pickNonEmptyString(result.display_name, result.name);

const ADMINISTRATIVE_RESULT_TYPES = new Set([
  "district",
  "city",
  "county",
  "state",
  "suburb",
  "borough",
]);

const getResultMatchMeta = (
  query: string,
  result: NominatimSearchResult,
): {
  score: number;
  matchedTokenCount: number;
  requiredTokenCount: number;
} => {
  const tokens = getLocationTokens(query);
  const haystacks = [
    result.display_name,
    result.name,
    result.address?.country,
    result.address?.state,
    result.address?.province,
    result.address?.region,
    result.address?.city,
    result.address?.town,
    result.address?.village,
    result.address?.municipality,
    result.address?.county,
    result.address?.district,
    result.address?.city_district,
    result.address?.suburb,
    result.address?.borough,
    result.address?.neighbourhood,
  ]
    .map((value) => compactLocationText(value))
    .filter(Boolean);

  const queryCompact = compactLocationText(query);
  const displayCompact = compactLocationText(buildResolvedLocationName(result));
  const queryLooksAdministrative = /(?:省|市|区|县|旗|镇|乡|街道|自治区|特别行政区|自治州|地区|盟)/u.test(
    query,
  );
  const resultType = normalizeString(result.type).toLowerCase();
  const resultIsAdministrative = ADMINISTRATIVE_RESULT_TYPES.has(resultType);
  let matchedTokenCount = 0;
  let score = 0;

  if (
    queryCompact &&
    displayCompact &&
    displayCompact.includes(queryCompact) &&
    (!queryLooksAdministrative || resultIsAdministrative)
  ) {
    score += 1000;
  }

  if (queryLooksAdministrative) {
    score += resultIsAdministrative ? 250 : -250;
  }

  for (const token of tokens) {
    const compactToken = compactLocationText(token);
    if (!compactToken) continue;
    const matched = haystacks.some((haystack) => haystack.includes(compactToken));
    if (!matched) continue;
    matchedTokenCount += 1;
    score += compactToken.length * 10;
  }

  score += Number(result.importance ?? 0);
  score += Number(result.place_rank ?? 0) / 100;

  return {
    score,
    matchedTokenCount,
    requiredTokenCount: tokens.length,
  };
};

const selectBestGeocodeResult = (
  query: string,
  results: NominatimSearchResult[],
): {
  result: NominatimSearchResult;
  matchedTokenCount: number;
  requiredTokenCount: number;
} | null => {
  const ranked = results
    .map((result) => ({
      result,
      ...getResultMatchMeta(query, result),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best) return null;

  return {
    result: best.result,
    matchedTokenCount: best.matchedTokenCount,
    requiredTokenCount: best.requiredTokenCount,
  };
};

const photonTypeScore = (type: string): { importance: number; placeRank: number } => {
  switch (type) {
    case "district":
      return { importance: 0.95, placeRank: 12 };
    case "city":
      return { importance: 0.9, placeRank: 16 };
    case "county":
      return { importance: 0.86, placeRank: 14 };
    case "state":
      return { importance: 0.82, placeRank: 8 };
    case "suburb":
    case "borough":
      return { importance: 0.74, placeRank: 13 };
    case "locality":
      return { importance: 0.65, placeRank: 18 };
    default:
      return { importance: 0.45, placeRank: 20 };
  }
};

const normalizePhotonResults = (
  payload: PhotonSearchResponse,
): NominatimSearchResult[] => {
  const features = Array.isArray(payload.features) ? payload.features : [];

  return features
    .map((feature): NominatimSearchResult | null => {
      const properties = feature.properties;
      const coordinates = feature.geometry?.coordinates;
      const latitude = Array.isArray(coordinates) ? toNumber(coordinates[1]) : undefined;
      const longitude = Array.isArray(coordinates) ? toNumber(coordinates[0]) : undefined;
      if (latitude === undefined || longitude === undefined) return null;

      const name = pickNonEmptyString(
        properties?.name,
        properties?.district,
        properties?.city,
        properties?.county,
        properties?.state,
      );
      const displayName = uniqueStrings([
        pickNonEmptyString(properties?.name),
        pickNonEmptyString(properties?.district),
        pickNonEmptyString(properties?.city),
        pickNonEmptyString(properties?.state),
        pickNonEmptyString(properties?.country),
      ]).join(", ");
      const scoreMeta = photonTypeScore(normalizeString(properties?.type).toLowerCase());

      return {
        name,
        display_name: displayName,
        lat: String(latitude),
        lon: String(longitude),
        importance: scoreMeta.importance,
        place_rank: scoreMeta.placeRank,
        type: normalizeString(properties?.type).toLowerCase(),
        address: {
          country: pickNonEmptyString(properties?.country),
          state: pickNonEmptyString(properties?.state),
          city: pickNonEmptyString(properties?.city),
          district: pickNonEmptyString(properties?.district),
          county: pickNonEmptyString(properties?.county),
          suburb: pickNonEmptyString(properties?.suburb),
          borough: pickNonEmptyString(properties?.borough),
          neighbourhood: pickNonEmptyString(properties?.locality),
        },
      } satisfies NominatimSearchResult;
    })
    .filter((result): result is NominatimSearchResult => Boolean(result));
};

const buildGeocodeUrl = (query: string): string =>
  `https://photon.komoot.io/api/?limit=10&q=${encodeURIComponent(query)}`;

const buildOpenMeteoForecastUrl = (input: {
  latitude: number;
  longitude: number;
  unit: "celsius" | "fahrenheit";
  forecastDays: number;
}): string => {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: String(input.forecastDays),
    temperature_unit: input.unit,
    wind_speed_unit: input.unit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: input.unit === "fahrenheit" ? "inch" : "mm",
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
};

const resolveWeatherLocation = async (
  locationQuery: string,
  fetchFn: typeof fetch,
): Promise<ResolvedWeatherLocation | null> => {
  const candidates = buildPreferredWeatherLookupCandidates(locationQuery);
  let fallback: ResolvedWeatherLocation | null = null;

  for (const candidate of candidates) {
    for (const searchQuery of buildPhotonSearchQueries(candidate)) {
      let results: NominatimSearchResult[] = [];

      try {
        const payload = await fetchJson<PhotonSearchResponse>(
          fetchFn,
          buildGeocodeUrl(searchQuery),
        );
        results = normalizePhotonResults(payload);
      } catch {
        continue;
      }

      if (!Array.isArray(results) || results.length === 0) continue;

      const best = selectBestGeocodeResult(candidate, results);
      if (!best) continue;

      const latitude = toNumber(best.result.lat);
      const longitude = toNumber(best.result.lon);
      if (latitude === undefined || longitude === undefined) continue;
      const resultType = normalizeString(best.result.type).toLowerCase();
      const resultIsAdministrative = ADMINISTRATIVE_RESULT_TYPES.has(resultType);
      const allowAdministrativeFallbackMatch =
        resultIsAdministrative &&
        best.requiredTokenCount > 1 &&
        best.matchedTokenCount === 0 &&
        searchQuery !== candidate &&
        /\s/u.test(searchQuery);

      const address = best.result.address;
      const resolvedLocation: ResolvedWeatherLocation = {
        query: candidate,
        latitude,
        longitude,
        displayName: allowAdministrativeFallbackMatch
          ? candidate
          : buildResolvedLocationName(best.result),
        country: pickNonEmptyString(address?.country),
        admin1: pickNonEmptyString(address?.state, address?.province, address?.region),
        admin2: pickNonEmptyString(
          address?.city,
          address?.town,
          address?.village,
          address?.municipality,
          address?.county,
          address?.district,
          address?.city_district,
          address?.suburb,
          address?.borough,
          address?.neighbourhood,
          best.result.name,
        ),
      };

      if (
        best.requiredTokenCount <= 1 ||
        best.matchedTokenCount >= best.requiredTokenCount ||
        allowAdministrativeFallbackMatch
      ) {
        return resolvedLocation;
      }

      if (!fallback) {
        fallback = resolvedLocation;
      }
    }
  }

  return fallback;
};

const getLocalTimeOfDay = (time?: string): number => {
  if (!time) return new Date().getHours() / 24;
  const [, rawClock = "12:00"] = time.split("T");
  const [hours = "12", minutes = "0"] = rawClock.split(":");
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes, 10);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes)) {
    return new Date().getHours() / 24;
  }
  return (parsedHours + parsedMinutes / 60) / 24;
};

const metersToKilometers = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : Number((value / 1000).toFixed(1));

const metersToMiles = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : Number((value / 1609.344).toFixed(1));

const getWeather = async (
  input: AssistantSidebarGetWeatherArgs,
  options: {
    forecastDays: number;
    fetchFn: typeof fetch;
    messages?: UIMessage[];
  },
): Promise<AssistantChatWeatherToolOutput> => {
  const locationQuery = resolveRequestedWeatherLocation({
    inputLocation: input.location,
    messages: options.messages,
  });
  if (!locationQuery) {
    throw new Error("weather_location_required");
  }

  const resolvedLocation = await resolveWeatherLocation(
    locationQuery,
    options.fetchFn,
  );
  if (!resolvedLocation) {
    throw new Error("weather_location_not_found");
  }

  const unit = input.unit === "fahrenheit" ? "fahrenheit" : "celsius";
  const forecastUrl = buildOpenMeteoForecastUrl({
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
    unit,
    forecastDays: options.forecastDays,
  });
  const payload = await fetchJson<OpenMeteoForecastResponse>(
    options.fetchFn,
    forecastUrl,
  );

  const current = payload.current;
  const daily = payload.daily;
  const time = Array.isArray(daily?.time) ? daily.time : [];
  const weatherCodes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const maxTemps = Array.isArray(daily?.temperature_2m_max)
    ? daily.temperature_2m_max
    : [];
  const minTemps = Array.isArray(daily?.temperature_2m_min)
    ? daily.temperature_2m_min
    : [];
  const precipitationProbabilities = Array.isArray(
    daily?.precipitation_probability_max,
  )
    ? daily?.precipitation_probability_max
    : [];

  if (
    !current ||
    current.temperature_2m === undefined ||
    time.length === 0 ||
    weatherCodes.length === 0 ||
    maxTemps.length === 0 ||
    minTemps.length === 0
  ) {
    throw new Error("weather_data_unavailable");
  }

  const currentWindSpeed = toNumber(current.wind_speed_10m);
  const currentConditionCode = toNumber(current.weather_code);
  const currentCondition = describeOpenMeteoCondition(
    currentConditionCode,
    currentWindSpeed,
  );
  const isDay = current.is_day === 1;
  const localTimeOfDay = getLocalTimeOfDay(current.time);
  const updatedAt = new Date().toISOString();

  const forecast = time.slice(0, options.forecastDays).map((date, index) => {
    const forecastCode = weatherCodes[index];
    return {
      date: normalizeString(date),
      tempMax: toNumber(maxTemps[index]),
      tempMin: toNumber(minTemps[index]),
      conditionCode: toNumber(forecastCode),
      condition: describeOpenMeteoCondition(forecastCode, undefined),
      precipitationProbability: toNumber(precipitationProbabilities[index]),
      isDay: true,
    };
  });

  const currentTemperature = current.temperature_2m;
  const tempMin = forecast[0]?.tempMin ?? currentTemperature;
  const tempMax = forecast[0]?.tempMax ?? currentTemperature;
  const precipitation = toNumber(current.precipitation);
  const visibilityMeters = toNumber(current.visibility);
  const visibility =
    unit === "fahrenheit"
      ? metersToMiles(visibilityMeters)
      : metersToKilometers(visibilityMeters);

  const widget = buildWeatherWidgetPayload({
    id:
      `weather-${compactLocationText(locationQuery).replaceAll(/[^a-z0-9\u4e00-\u9fff]+/g, "-")}` ||
      "weather-result",
    locationName: locationQuery,
    unit,
    currentTemperature,
    tempMin,
    tempMax,
    windSpeed: currentWindSpeed,
    precipitation,
    visibility,
    conditionCode: currentConditionCode,
    forecast,
    localTimeOfDay,
    updatedAt,
    isDay,
  });

  return {
    id: widget.id,
    widget,
    location: {
      name: locationQuery,
      resolvedName: resolvedLocation.displayName,
      latitude: payload.latitude ?? resolvedLocation.latitude,
      longitude: payload.longitude ?? resolvedLocation.longitude,
      timezone: pickNonEmptyString(payload.timezone),
      country: resolvedLocation.country,
      admin1: resolvedLocation.admin1,
      admin2: resolvedLocation.admin2,
    },
    unit,
    temperature: currentTemperature,
    temperatureUnit:
      pickNonEmptyString(payload.current_units?.temperature_2m) ||
      (unit === "fahrenheit" ? "°F" : "°C"),
    apparentTemperature: toNumber(current.apparent_temperature),
    humidity: toNumber(current.relative_humidity_2m),
    humidityUnit: pickNonEmptyString(payload.current_units?.relative_humidity_2m) || "%",
    windSpeed: currentWindSpeed,
    windSpeedUnit:
      pickNonEmptyString(payload.current_units?.wind_speed_10m) ||
      (unit === "fahrenheit" ? "mph" : "km/h"),
    windDirection: toNumber(current.wind_direction_10m),
    precipitation,
    precipitationUnit:
      pickNonEmptyString(payload.current_units?.precipitation) ||
      (unit === "fahrenheit" ? "inch" : "mm"),
    visibility,
    visibilityUnit: unit === "fahrenheit" ? "mi" : "km",
    conditionCode: currentConditionCode,
    condition: currentCondition,
    isDay,
    localTimeOfDay,
    forecast,
    updatedAt,
    source: {
      name: "Open-Meteo",
      url: forecastUrl,
    },
  };
};

export const createAssistantChatWeatherTools = (
  config: AssistantChatWeatherToolsConfig | null | undefined,
  dependencies: WeatherToolDependencies = {},
): AssistantChatWeatherToolsResult => {
  if (config?.enabled === false) {
    return { tools: {}, reason: "disabled" };
  }

  const fetchFn = dependencies.fetchFn || fetch;
  const forecastDays = clampForecastDays(config?.forecastDays);

  return {
    tools: {
      getWeather: tool({
        description:
          "Get current weather and a short forecast for a city or place. Use this for weather, temperature, rain, snow, wind, or humidity questions instead of web search.",
        inputSchema: assistantSidebarGetWeatherParameters,
        execute: (input) =>
          getWeather(input, {
            forecastDays,
            fetchFn,
            messages: dependencies.messages,
          }),
      }),
    },
    reason: "registered",
  };
};
