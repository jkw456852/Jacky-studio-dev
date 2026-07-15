"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import {
  EffectCompositorRuntime,
  getNearestCheckpoint,
  getSceneBrightnessFromTimeOfDay,
  getWeatherTheme,
  resolveWeatherTime,
  snapTimeOfDayToNearestCheckpoint,
  TUNED_WEATHER_EFFECTS_CHECKPOINT_OVERRIDES,
} from "./generated/weather-runtime-core.generated";
import type { WeatherWidgetRuntimeProps } from "./schema-runtime";
import { WeatherDataOverlay } from "./weather-data-overlay";

type TimeCheckpoint = "dawn" | "noon" | "dusk" | "midnight";
type WeatherCheckpointPreset = {
  cloud?: {
    turbulence?: number;
    windSpeed?: number;
    [key: string]: unknown;
  };
  layers?: {
    clouds?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
type WeatherCloudCssProperties = CSSProperties &
  Record<`--weather-cloud-${string}`, string>;

const WEATHER_CLOUD_MOTION_CSS = `
  .weather-widget-cloud-motion {
    contain: strict;
    opacity: var(--weather-cloud-opacity, 0.82);
  }

  .weather-widget-cloud-motion__sheet {
    position: absolute;
    inset: 0;
    transform: translate3d(0, 0, 0);
    overflow: hidden;
  }

  .weather-widget-cloud-motion__sheet--far {
    opacity: var(--weather-cloud-far-opacity, 0.28);
    filter: blur(5px);
  }

  .weather-widget-cloud-motion__sheet--near {
    opacity: var(--weather-cloud-near-opacity, 0.22);
    filter: blur(2.5px);
  }

  .weather-widget-cloud-motion__track {
    position: absolute;
    inset: 0 auto 0 0;
    width: 200%;
    height: 100%;
    transform: translate3d(0, 0, 0);
    will-change: transform;
    animation-name: weatherCloudTrack;
    animation-duration: var(--weather-cloud-duration, 112s);
    animation-delay: var(--weather-cloud-delay, 0s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: var(--weather-cloud-play-state, running);
  }

  .weather-widget-cloud-motion__group {
    position: absolute;
    inset-block: 0;
    width: 50%;
  }

  .weather-widget-cloud-motion__group--a {
    left: 0;
  }

  .weather-widget-cloud-motion__group--b {
    left: 50%;
  }

  .weather-widget-cloud-motion__cloud {
    position: absolute;
    left: var(--weather-cloud-x, 0%);
    width: var(--weather-cloud-width, 62%);
    height: var(--weather-cloud-height, 32%);
    top: var(--weather-cloud-top, 20%);
    background-color: var(--weather-cloud-body);
    border-radius: 999px;
    box-shadow:
      inset 0 16px 24px -14px var(--weather-cloud-highlight),
      inset 0 -16px 24px -14px var(--weather-cloud-shadow),
      0 8px 18px -12px var(--weather-cloud-shadow);
    transform: translate3d(0, 0, 0);
  }

  .weather-widget-cloud-motion__cloud::before,
  .weather-widget-cloud-motion__cloud::after {
    position: absolute;
    bottom: 30%;
    content: "";
    background-color: var(--weather-cloud-body);
    border-radius: 50%;
    box-shadow:
      inset 0 14px 20px -14px var(--weather-cloud-highlight),
      inset 0 -12px 18px -14px var(--weather-cloud-shadow);
  }

  .weather-widget-cloud-motion__cloud::before {
    left: 14%;
    width: 42%;
    height: 152%;
  }

  .weather-widget-cloud-motion__cloud::after {
    right: 13%;
    width: 34%;
    height: 116%;
  }

  @keyframes weatherCloudTrack {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-50%, 0, 0);
    }
  }
`;

const TIME_CHECKPOINTS: TimeCheckpoint[] = [
  "dawn",
  "noon",
  "dusk",
  "midnight",
];

const stabilizeCloudMotionPresets = (
  presets: typeof TUNED_WEATHER_EFFECTS_CHECKPOINT_OVERRIDES,
) => {
  for (const conditionPreset of Object.values(presets)) {
    for (const checkpoint of TIME_CHECKPOINTS) {
      const checkpointPreset = conditionPreset?.[
        checkpoint
      ] as WeatherCheckpointPreset | undefined;
      if (!checkpointPreset) continue;

      checkpointPreset.cloud = {
        ...(checkpointPreset.cloud ?? {}),
        turbulence: 0,
        windSpeed: 0,
      };
      checkpointPreset.layers = {
        ...(checkpointPreset.layers ?? {}),
        clouds: false,
      };
    }
  }
};

stabilizeCloudMotionPresets(TUNED_WEATHER_EFFECTS_CHECKPOINT_OVERRIDES);

const CLOUD_MOTION_CONDITIONS = new Set<string>([
  "clear",
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "heavy-rain",
  "thunderstorm",
  "snow",
  "sleet",
  "hail",
  "windy",
]);

const CSS_ONLY_CLOUD_CONDITIONS = new Set<string>([
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "windy",
]);

const CLOUD_DRIFT_STYLES = {
  farTrack: {
    "--weather-cloud-delay": "-41s",
    "--weather-cloud-duration": "104s",
  },
  nearTrack: {
    "--weather-cloud-delay": "-27s",
    "--weather-cloud-duration": "76s",
  },
  farUpper: {
    "--weather-cloud-height": "15%",
    "--weather-cloud-top": "15%",
    "--weather-cloud-width": "42%",
    "--weather-cloud-x": "4%",
  },
  farLower: {
    "--weather-cloud-height": "12%",
    "--weather-cloud-top": "39%",
    "--weather-cloud-width": "34%",
    "--weather-cloud-x": "56%",
  },
  nearLower: {
    "--weather-cloud-height": "17%",
    "--weather-cloud-top": "55%",
    "--weather-cloud-width": "46%",
    "--weather-cloud-x": "12%",
  },
  nearMiddle: {
    "--weather-cloud-height": "14%",
    "--weather-cloud-top": "31%",
    "--weather-cloud-width": "39%",
    "--weather-cloud-x": "62%",
  },
} satisfies Record<string, WeatherCloudCssProperties>;

export function WeatherWidget({
  version: _version,
  id,
  location,
  units,
  current,
  forecast,
  time,
  updatedAt,
  className,
  effects,
}: WeatherWidgetRuntimeProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQueryList = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    setPrefersReducedMotion(mediaQueryList.matches);

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleMotionPreferenceChange);
      return () => {
        mediaQueryList.removeEventListener(
          "change",
          handleMotionPreferenceChange,
        );
      };
    }

    mediaQueryList.addListener(handleMotionPreferenceChange);
    return () => {
      mediaQueryList.removeListener(handleMotionPreferenceChange);
    };
  }, []);

  const reducedMotion = effects?.reducedMotion ?? prefersReducedMotion;
  const effectsEnabled = effects?.enabled !== false && !reducedMotion;

  const resolvedTime = resolveWeatherTime({
    time,
    updatedAt,
  });
  const timeOfDay = snapTimeOfDayToNearestCheckpoint(resolvedTime.timeOfDay);
  const tunedOverrides =
    TUNED_WEATHER_EFFECTS_CHECKPOINT_OVERRIDES[current.conditionCode];
  const checkpoint = getNearestCheckpoint(timeOfDay) as TimeCheckpoint;
  const checkpointOverrides = tunedOverrides?.[checkpoint];
  const glassParams =
    checkpointOverrides && "glass" in checkpointOverrides
      ? checkpointOverrides.glass
      : undefined;
  const brightness = getSceneBrightnessFromTimeOfDay(
    timeOfDay,
    current.conditionCode,
  );
  const weatherTheme = getWeatherTheme(brightness, undefined);
  const isWeatherDark = weatherTheme === "dark";
  const isClearWeather = current.conditionCode === "clear";
  const cloudLayerEnabled =
    effects?.enabled !== false &&
    CLOUD_MOTION_CONDITIONS.has(current.conditionCode);
  const showCloudMotionOverlay =
    cloudLayerEnabled;
  const renderEffectCompositor =
    effectsEnabled && !CSS_ONLY_CLOUD_CONDITIONS.has(current.conditionCode);
  const cloudMotionStyle = {
    "--weather-cloud-opacity": isClearWeather
      ? isWeatherDark
        ? "0.44"
        : "0.56"
      : isWeatherDark
        ? "0.82"
        : "0.96",
    "--weather-cloud-far-opacity": isClearWeather ? "0.46" : "0.78",
    "--weather-cloud-near-opacity": isClearWeather ? "0.36" : "0.74",
    "--weather-cloud-highlight": isWeatherDark
      ? "rgba(226, 232, 240, 0.58)"
      : "rgba(255, 255, 255, 0.96)",
    "--weather-cloud-body": isWeatherDark
      ? "rgba(180, 194, 214, 0.6)"
      : "rgba(248, 252, 255, 0.9)",
    "--weather-cloud-shadow": isWeatherDark
      ? "rgba(30, 41, 59, 0.68)"
      : "rgba(101, 137, 163, 0.52)",
    "--weather-cloud-play-state": reducedMotion ? "paused" : "running",
  } as CSSProperties;
  const backgroundClass = isWeatherDark
    ? "bg-gradient-to-b from-zinc-950 via-zinc-900/70 to-zinc-950"
    : "bg-gradient-to-b from-sky-50 via-sky-100/70 to-white";

  return (
    <article
      data-slot="weather-widget"
      data-tool-ui-id={id}
      className={cn("isolate w-full max-w-md", className)}
    >
      <div
        data-slot="card"
        className={cn(
          "@container/weather [container-type:size] relative aspect-[4/3] overflow-clip rounded-2xl border-0 p-0 shadow-none",
          backgroundClass,
        )}
      >
        {renderEffectCompositor && (
          <EffectCompositorRuntime
            className="absolute inset-0"
            conditionCode={current.conditionCode}
            windSpeed={current.windSpeed}
            precipitationLevel={current.precipitationLevel}
            visibility={current.visibility}
            timestamp={updatedAt}
            timeOfDay={timeOfDay}
            settings={effects}
          />
        )}

        {showCloudMotionOverlay ? (
          <div
            aria-hidden="true"
            className="weather-widget-cloud-motion pointer-events-none absolute inset-0 z-[1] overflow-hidden"
            style={cloudMotionStyle}
          >
            <div className="weather-widget-cloud-motion__sheet weather-widget-cloud-motion__sheet--far">
              <div
                className="weather-widget-cloud-motion__track"
                style={CLOUD_DRIFT_STYLES.farTrack}
              >
                <div className="weather-widget-cloud-motion__group weather-widget-cloud-motion__group--a">
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--far"
                    style={CLOUD_DRIFT_STYLES.farUpper}
                  />
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--far"
                    style={CLOUD_DRIFT_STYLES.farLower}
                  />
                </div>
                <div className="weather-widget-cloud-motion__group weather-widget-cloud-motion__group--b">
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--far"
                    style={CLOUD_DRIFT_STYLES.farUpper}
                  />
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--far"
                    style={CLOUD_DRIFT_STYLES.farLower}
                  />
                </div>
              </div>
            </div>
            <div className="weather-widget-cloud-motion__sheet weather-widget-cloud-motion__sheet--near">
              <div
                className="weather-widget-cloud-motion__track"
                style={CLOUD_DRIFT_STYLES.nearTrack}
              >
                <div className="weather-widget-cloud-motion__group weather-widget-cloud-motion__group--a">
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--near"
                    style={CLOUD_DRIFT_STYLES.nearLower}
                  />
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--near"
                    style={CLOUD_DRIFT_STYLES.nearMiddle}
                  />
                </div>
                <div className="weather-widget-cloud-motion__group weather-widget-cloud-motion__group--b">
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--near"
                    style={CLOUD_DRIFT_STYLES.nearLower}
                  />
                  <div
                    className="weather-widget-cloud-motion__cloud weather-widget-cloud-motion__cloud--near"
                    style={CLOUD_DRIFT_STYLES.nearMiddle}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <WeatherDataOverlay
          location={location.name}
          conditionCode={current.conditionCode}
          temperature={current.temperature}
          tempHigh={current.tempMax}
          tempLow={current.tempMin}
          forecast={forecast}
          unit={units.temperature}
          theme={weatherTheme}
          timeOfDay={timeOfDay}
          timestamp={updatedAt}
          glassParams={glassParams}
          reducedMotion={reducedMotion}
        />
        <style>{WEATHER_CLOUD_MOTION_CSS}</style>
      </div>
    </article>
  );
}
