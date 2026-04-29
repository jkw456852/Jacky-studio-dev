import type { ProductType } from '../types/workflow.types';

export type AmazonShot = {
  key: string;
  name: string;
  when: ProductType[];
  priority: number;
  promptHint: string;
};

export const AMAZON_SHOTS: AmazonShot[] = [
  {
    key: 'hero_full_front',
    name: '全身正面主图',
    when: ['top', 'dress', 'set', 'outerwear'],
    priority: 1,
    promptHint: 'full body, front view, centered, pure white background (#FFFFFF)',
  },
  {
    key: 'three_quarter_front',
    name: '3/4 正面',
    when: ['top', 'dress', 'set', 'outerwear'],
    priority: 2,
    promptHint: 'three-quarter front view, natural pose, no occlusion, pure white background',
  },
  {
    key: 'back_view',
    name: '背面展示',
    when: ['top', 'dress', 'set', 'outerwear'],
    priority: 2,
    promptHint: 'back view, hair not covering neckline, pure white background',
  },
  {
    key: 'side_view',
    name: '侧面展示',
    when: ['top', 'dress', 'set', 'outerwear', 'pants', 'skirt'],
    priority: 3,
    promptHint: 'side view, show silhouette, pure white background',
  },
  {
    key: 'stretch_demo',
    name: '弹力/面料演示',
    when: ['top', 'dress', 'set'],
    priority: 1,
    promptHint: 'hands gently pulling hem to show stretch, tasteful, pure white background',
  },
  {
    key: 'detail_neckline',
    name: '领口细节特写',
    when: ['top', 'dress', 'outerwear'],
    priority: 2,
    promptHint: 'close-up on neckline stitching and edge finishing, pure white background',
  },
  {
    key: 'detail_stitching',
    name: '工艺走线细节',
    when: ['top', 'dress', 'pants', 'skirt', 'set', 'outerwear'],
    priority: 2,
    promptHint: 'close-up on stitching quality and seam details, pure white background',
  },
];
