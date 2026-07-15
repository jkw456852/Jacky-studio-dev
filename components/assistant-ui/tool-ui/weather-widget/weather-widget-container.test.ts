import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(__dirname, "weather-widget-container.tsx"),
  "utf8",
);

test("weather cloud animation uses a seamless duplicated track", () => {
  assert.match(source, /@keyframes weatherCloudTrack/);
  assert.match(source, /transform: translate3d\(-50%, 0, 0\);/);
  assert.match(source, /weather-widget-cloud-motion__group--b/);
  assert.doesNotMatch(source, /@keyframes weatherCloudFloat/);
  assert.doesNotMatch(source, /animation-name: weatherCloudFloat/);
});

test("weather clouds remain visible without the unstable WebGL cloud layer", () => {
  assert.match(source, /const CLOUD_MOTION_CONDITIONS[\s\S]*?"clear"/);
  assert.match(source, /--weather-cloud-body/);
  assert.match(source, /--weather-cloud-shadow/);
  assert.doesNotMatch(source, /mix-blend-mode:\s*screen/);
  assert.match(source, /cloudLayerEnabled/);
  assert.match(source, /weather-widget-cloud-motion__sheet--near[\s\S]*?blur\(2\.5px\)/);
  assert.match(source, /absolute inset-0 z-\[1\] overflow-hidden/);
});

test("reduced motion pauses clouds instead of removing their layer", () => {
  assert.match(
    source,
    /--weather-cloud-play-state": reducedMotion \? "paused" : "running"/,
  );
  assert.match(
    source,
    /animation-play-state: var\(--weather-cloud-play-state, running\)/,
  );
});
