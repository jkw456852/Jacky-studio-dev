import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractAspectRatioHint,
  extractExactSizeHint,
  extractImageSizeHint,
} from './request-hints.ts';

test('request hints extract ratio and resolution tier from prompt text', () => {
  assert.equal(extractAspectRatioHint('生成一张亚洲年轻美女图，4K，9:16'), '9:16');
  assert.equal(extractImageSizeHint('生成一张亚洲年轻美女图，4K，9:16'), '4K');
});

test('request hints extract exact dimensions when present', () => {
  assert.equal(
    extractExactSizeHint('请输出 2160x3840 的竖版海报'),
    '2160x3840',
  );
});
