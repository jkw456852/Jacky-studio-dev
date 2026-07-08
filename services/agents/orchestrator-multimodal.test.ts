import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types/common.ts';
import {
  collectConversationReferenceImageUrls,
  extractReferenceImageUrlsFromMessage,
} from './orchestrator-multimodal.ts';

test('extractReferenceImageUrlsFromMessage prefers agentData image urls and inline parts', () => {
  const urls = extractReferenceImageUrlsFromMessage({
    attachments: ['https://cdn.example.com/user-upload.png'],
    inlineParts: [
      { type: 'text', text: 'desc' },
      {
        type: 'attachment',
        url: 'https://cdn.example.com/inline-ref.jpg',
        label: 'inline',
      },
    ],
    agentData: {
      imageUrls: [
        'https://cdn.example.com/generated-1.png',
        'not-a-url',
      ],
      assets: [
        { type: 'image', url: 'https://cdn.example.com/asset-1.webp' },
        { type: 'video', url: 'https://cdn.example.com/should-skip.mp4' },
        { type: 'image', url: 'data:image/png;base64,AAA' },
      ],
    },
  });

  assert.deepEqual(urls, [
    'https://cdn.example.com/user-upload.png',
    'https://cdn.example.com/inline-ref.jpg',
    'https://cdn.example.com/generated-1.png',
    'https://cdn.example.com/asset-1.webp',
    'data:image/png;base64,AAA=',
  ]);
});

test('extractReferenceImageUrlsFromMessage drops non-image attachments and bad shapes', () => {
  const urls = extractReferenceImageUrlsFromMessage({
    attachments: [
      'https://cdn.example.com/notes.pdf',
      'data:image/png;base64,%%%not-valid%%%',
    ],
    agentData: undefined,
  });

  assert.deepEqual(urls, []);
});

test('extractReferenceImageUrlsFromMessage keeps normalized data image references', () => {
  const urls = extractReferenceImageUrlsFromMessage({
    agentData: {
      imageUrls: [
        'data:image/png;base64,a Gk',
        'data:image/png;base64,%%%not-valid%%%',
      ],
      assets: [
        { type: 'image', url: 'data:image/jpeg;base64,a Gk' },
        { type: 'image', url: 'https://cdn.example.com/keep.png' },
      ],
    },
  });

  assert.deepEqual(urls, [
    'data:image/png;base64,aGk=',
    'data:image/jpeg;base64,aGk=',
    'https://cdn.example.com/keep.png',
  ]);
});

test('collectConversationReferenceImageUrls walks history newest-first and deduplicates', () => {
  const messages: ChatMessage[] = [
    {
      id: 'u-older',
      role: 'user',
      text: 'older message',
      attachments: ['https://cdn.example.com/older.png'],
      timestamp: 1,
    },
    {
      id: 'm-generated',
      role: 'model',
      text: 'generated previous',
      agentData: {
        imageUrls: [
          'https://cdn.example.com/gen-1.png',
          'https://cdn.example.com/gen-2.png',
        ],
      },
      timestamp: 2,
    },
    {
      id: 'u-follow',
      role: 'user',
      text: 'short follow up',
      attachments: [],
      timestamp: 3,
    },
  ];

  const urls = collectConversationReferenceImageUrls(messages, {
    maxMessages: 6,
    maxUrls: 5,
  });

  assert.deepEqual(urls, [
    'https://cdn.example.com/gen-1.png',
    'https://cdn.example.com/gen-2.png',
    'https://cdn.example.com/older.png',
  ]);
});

test('collectConversationReferenceImageUrls respects maxUrls budget', () => {
  const messages: ChatMessage[] = [
    {
      id: 'm-previous',
      role: 'model',
      text: 'previous',
      agentData: {
        imageUrls: [
          'https://cdn.example.com/a.png',
          'https://cdn.example.com/b.png',
          'https://cdn.example.com/c.png',
          'https://cdn.example.com/d.png',
        ],
      },
      timestamp: 1,
    },
  ];

  const urls = collectConversationReferenceImageUrls(messages, {
    maxMessages: 3,
    maxUrls: 2,
  });

  assert.deepEqual(urls, [
    'https://cdn.example.com/a.png',
    'https://cdn.example.com/b.png',
  ]);
});

test('collectInheritedReferenceUrls recognizes "上一张图" as a follow-up edit signal', async () => {
  const { collectInheritedReferenceUrls } = await import('./orchestrator-multimodal.ts');

  const urls = collectInheritedReferenceUrls({
    message: '在上一张图基础上，把泳池边的光线再柔和一点',
    shouldPreferUploadedReferences: false,
    currentTaskAssetUrls: ['https://cdn.example.com/current.png'],
    sessionApprovedUrls: ['https://cdn.example.com/approved.png'],
    recentHistoryAttachmentUrls: ['https://cdn.example.com/history.png'],
  });

  assert.deepEqual(urls, [
    'https://cdn.example.com/current.png',
    'https://cdn.example.com/history.png',
    'https://cdn.example.com/approved.png',
  ]);
});

test('extractDesignSessionReferenceUrls merges approved and anchor URLs while dropping non-image strings', async () => {
  const { extractDesignSessionReferenceUrls } = await import('./orchestrator-multimodal.ts');
  const urls = extractDesignSessionReferenceUrls({
    approvedAssetIds: [
      'https://cdn.example.com/approved-1.png',
      'asset-id-not-a-url',
      'https://cdn.example.com/approved-2.gif',
    ],
    subjectAnchors: [
      'https://cdn.example.com/approved-1.png',
      'https://cdn.example.com/anchor-1.webp',
      'https://cdn.example.com/anchor.pdf',
    ],
  });

  assert.deepEqual(urls, [
    'https://cdn.example.com/approved-1.png',
    'https://cdn.example.com/approved-2.gif',
    'https://cdn.example.com/anchor-1.webp',
  ]);
});

test('extractDesignSessionReferenceUrls respects maxUrls budget', async () => {
  const { extractDesignSessionReferenceUrls } = await import('./orchestrator-multimodal.ts');
  const urls = extractDesignSessionReferenceUrls(
    {
      approvedAssetIds: [
        'https://cdn.example.com/a.png',
        'https://cdn.example.com/b.png',
        'https://cdn.example.com/c.png',
      ],
      subjectAnchors: [],
    },
    { maxUrls: 2 },
  );

  assert.deepEqual(urls, [
    'https://cdn.example.com/a.png',
    'https://cdn.example.com/b.png',
  ]);
});
