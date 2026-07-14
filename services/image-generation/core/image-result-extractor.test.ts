import assert from "node:assert/strict";
import test from "node:test";
import { extractImageUrlsFromResult } from "./image-result-extractor.ts";

test("extractImageUrlsFromResult supports plain string and object-shaped image results", () => {
  assert.deepEqual(extractImageUrlsFromResult("https://example.com/a.png"), [
    "https://example.com/a.png",
  ]);

  assert.deepEqual(
    extractImageUrlsFromResult({
      analysis: "done",
      editedImage: "https://example.com/edited.png",
    }),
    ["https://example.com/edited.png"],
  );

  assert.deepEqual(
    extractImageUrlsFromResult({
      imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
    }),
    ["https://example.com/1.png", "https://example.com/2.png"],
  );
});

test("extractImageUrlsFromResult reads nested image items and deduplicates repeated urls", () => {
  assert.deepEqual(
    extractImageUrlsFromResult({
      anchorUrl: "https://example.com/anchor.png",
      imageUrl: "https://example.com/a.png",
      anchorSheetUrl: "https://example.com/sheet.png",
      images: [
        { url: "https://example.com/a.png" },
        { imageUrl: "https://example.com/b.png" },
        "https://example.com/c.png",
      ],
    }),
    [
      "https://example.com/a.png",
      "https://example.com/anchor.png",
      "https://example.com/sheet.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ],
  );
});
