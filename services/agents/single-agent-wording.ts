const LEGACY_SPECIALIST_NAME =
  '(?:Cameron|Poster|Vireo|Motion|Package|Campaign)';

const LEGACY_SPECIALIST_WITH_LABEL = `${LEGACY_SPECIALIST_NAME}(?:（[^）]*）|\\([^)]*\\))?`;

const DIRECT_HANDOFF_PATTERNS: Array<[RegExp, string]> = [
  [
    new RegExp(
      `本次任务由\\s*${LEGACY_SPECIALIST_WITH_LABEL}\\s*调度执行[。！!]?`,
      'gi',
    ),
    '本次任务由我直接处理。',
  ],
  [
    new RegExp(
      `(交给|已交给|将交给)\\s*${LEGACY_SPECIALIST_WITH_LABEL}\\s*(处理|执行|负责|调度执行)`,
      'gi',
    ),
    '直接处理',
  ],
  [
    new RegExp(
      `已由\\s*${LEGACY_SPECIALIST_WITH_LABEL}\\s*(处理|执行|负责|调度执行)`,
      'gi',
    ),
    '我已直接',
  ],
  [
    new RegExp(
      `将由\\s*${LEGACY_SPECIALIST_WITH_LABEL}\\s*(处理|执行|负责|调度执行)`,
      'gi',
    ),
    '我将直接',
  ],
  [
    new RegExp(
      `由\\s*${LEGACY_SPECIALIST_WITH_LABEL}\\s*(处理|执行|负责|调度执行)`,
      'gi',
    ),
    '由我直接处理',
  ],
  [
    new RegExp(
      `路由(?:给|到)\\s*${LEGACY_SPECIALIST_WITH_LABEL}`,
      'gi',
    ),
    '直接进入当前执行流程',
  ],
];

export const sanitizeSingleAgentVisibleText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const input = value.trim();
  if (!input) return input;

  let next = input;
  for (const [pattern, replacement] of DIRECT_HANDOFF_PATTERNS) {
    next = next.replace(pattern, replacement);
  }

  next = next
    .replace(/我先直接处理/g, '我先直接处理')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/。{2,}/g, '。')
    .trim();

  return next;
};
