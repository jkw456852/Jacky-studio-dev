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
