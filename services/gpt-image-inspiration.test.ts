import assert from "node:assert/strict";
import test from "node:test";

import {
  shuffleGptImageInspirationCases,
  type GptImageInspirationCase,
} from "./gpt-image-inspiration.ts";

const createCase = (id: number): GptImageInspirationCase => ({
  id,
  title: `Case ${id}`,
  image: `https://example.com/${id}.png`,
  imageAlt: `Case ${id}`,
  sourceLabel: "Test",
  sourceUrl: "https://example.com",
  prompt: `Prompt ${id}`,
  promptPreview: `Prompt ${id}`,
  category: "Test",
  styles: [],
  scenes: [],
  featured: false,
  githubUrl: "https://github.com/example/test",
});

test("inspiration shuffle is stable for one page seed", () => {
  const cases = Array.from({ length: 24 }, (_, index) => createCase(index + 1));
  assert.deepEqual(
    shuffleGptImageInspirationCases(cases, 1234).map((item) => item.id),
    shuffleGptImageInspirationCases(cases, 1234).map((item) => item.id),
  );
  assert.deepEqual(cases.map((item) => item.id), Array.from({ length: 24 }, (_, index) => index + 1));
});

test("different page seeds produce different inspiration orders", () => {
  const cases = Array.from({ length: 24 }, (_, index) => createCase(index + 1));
  const first = shuffleGptImageInspirationCases(cases, 111).map((item) => item.id);
  const second = shuffleGptImageInspirationCases(cases, 222).map((item) => item.id);
  assert.notDeepEqual(first, second);
  assert.deepEqual([...first].sort((a, b) => a - b), [...second].sort((a, b) => a - b));
});
