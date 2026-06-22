import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePlannedMarkerSmartEditCalls } from './planned-marker-smart-edit-normalizer.ts';

test('normalizePlannedMarkerSmartEditCalls rewrites smartEdit sourceUrl to attachment token and appends marker hint', () => {
  const parsedPlan = {
    skillCalls: [
      {
        skillName: 'smartEdit',
        params: {
          sourceUrl: 'https://i.ibb.co/example/marker-annotated-1.png',
          instruction: '在狗狗鼻子附近加一只蜜蜂。',
        },
      },
    ],
  };

  normalizePlannedMarkerSmartEditCalls({
    parsedPlan,
    attachments: [
      {
        markerName: 'Selection',
        markerInfo: {
          fullImageUrl: 'https://example.com/original.png',
          normalizedX: 0.48,
          normalizedY: 0.51,
        },
      } as any,
    ],
    uploadedAttachments: ['https://i.ibb.co/example/marker-annotated-1.png'],
  });

  assert.equal(parsedPlan.skillCalls[0].params.sourceUrl, 'ATTACHMENT_0');
  assert.match(String(parsedPlan.skillCalls[0].params.instruction), /\[Marker Anchor\]/);
  assert.match(
    String(parsedPlan.skillCalls[0].params.instruction),
    /48% from the left and 51% from the top/i,
  );
  assert.match(
    String(parsedPlan.skillCalls[0].params.instruction),
    /exact user-selected edit anchor/i,
  );
});

test('normalizePlannedMarkerSmartEditCalls leaves non-smartEdit calls unchanged', () => {
  const parsedPlan = {
    skillCalls: [
      {
        skillName: 'generateImage',
        params: {
          referenceImage: 'ATTACHMENT_0',
        },
      },
    ],
  };

  const result = normalizePlannedMarkerSmartEditCalls({
    parsedPlan,
    attachments: [
      {
        markerInfo: {
          normalizedX: 0.2,
          normalizedY: 0.3,
        },
      } as any,
    ],
    uploadedAttachments: ['https://example.com/annotated.png'],
  });

  assert.equal(result.skillCalls[0].params.referenceImage, 'ATTACHMENT_0');
  assert.equal('sourceUrl' in result.skillCalls[0].params, false);
});
