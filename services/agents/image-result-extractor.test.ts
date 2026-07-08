import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImageAssetsFromSkillResults,
  extractImageUrlsFromResult,
} from './image-result-extractor.ts';

test('extractImageUrlsFromResult supports plain string and object-shaped image results', () => {
  assert.deepEqual(extractImageUrlsFromResult('https://example.com/a.png'), [
    'https://example.com/a.png',
  ]);

  assert.deepEqual(
    extractImageUrlsFromResult({
      analysis: 'done',
      editedImage: 'https://example.com/edited.png',
    }),
    ['https://example.com/edited.png'],
  );

  assert.deepEqual(
    extractImageUrlsFromResult({
      imageUrls: ['https://example.com/1.png', 'https://example.com/2.png'],
    }),
    ['https://example.com/1.png', 'https://example.com/2.png'],
  );
});

test('extractImageUrlsFromResult reads nested image items and deduplicates repeated urls', () => {
  assert.deepEqual(
    extractImageUrlsFromResult({
      anchorUrl: 'https://example.com/anchor.png',
      imageUrl: 'https://example.com/a.png',
      anchorSheetUrl: 'https://example.com/sheet.png',
      images: [
        { url: 'https://example.com/a.png' },
        { imageUrl: 'https://example.com/b.png' },
        'https://example.com/c.png',
      ],
    }),
    [
      'https://example.com/a.png',
      'https://example.com/anchor.png',
      'https://example.com/sheet.png',
      'https://example.com/b.png',
      'https://example.com/c.png',
    ],
  );
});

test('buildImageAssetsFromSkillResults converts successful touch edit results into image assets', () => {
  const assets = buildImageAssetsFromSkillResults(
    [
      {
        skillName: 'touchEdit',
        success: true,
        result: {
          analysis: 'removed object',
          editedImage: 'https://example.com/out.png',
        },
        params: {
          prompt: 'remove the cup',
          model: 'gemini-3-pro-image-preview',
        },
      },
      {
        skillName: 'touchEdit',
        success: false,
        result: {
          editedImage: 'https://example.com/ignored.png',
        },
      },
    ],
    'coco',
  );

  assert.equal(assets.length, 1);
  assert.equal(assets[0].type, 'image');
  assert.equal(assets[0].url, 'https://example.com/out.png');
  assert.equal(assets[0].metadata.agentId, 'coco');
  assert.equal(assets[0].metadata.prompt, 'remove the cup');
  assert.equal(assets[0].metadata.model, 'gemini-3-pro-image-preview');
});
