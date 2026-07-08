import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNormalizedImageDataUrl,
  normalizeImageDataUrlString,
} from './data-url-helpers.ts';

test('normalizeImageDataUrlString normalizes whitespace and missing padding', () => {
  assert.equal(
    normalizeImageDataUrlString('data:image/png;base64,a Gk'),
    'data:image/png;base64,aGk=',
  );
});

test('normalizeImageDataUrlString rejects invalid data urls', () => {
  assert.equal(
    normalizeImageDataUrlString('data:image/png;base64,%%%not-valid%%%'),
    null,
  );
});

test('isNormalizedImageDataUrl recognizes normalized image data urls', () => {
  assert.equal(isNormalizedImageDataUrl('data:image/png;base64,aGk='), true);
  assert.equal(isNormalizedImageDataUrl('blob:abc'), false);
});
