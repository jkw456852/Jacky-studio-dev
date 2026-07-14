import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImageAssetsFromSkillResults } from './image-result-extractor.ts';

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
