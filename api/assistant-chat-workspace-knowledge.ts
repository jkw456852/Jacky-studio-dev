import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { tool, type ToolSet } from "ai";

import {
  assistantSidebarSearchWorkspaceKnowledgeParameters,
  type AssistantSidebarSearchWorkspaceKnowledgeArgs,
} from "../services/assistant-ui/assistant-sidebar-tool-schemas.ts";

type WorkspaceKnowledgeSource =
  | "studio-assets"
  | "studio-skills"
  | "knowledge";

type WorkspaceKnowledgeDocument = {
  source: WorkspaceKnowledgeSource;
  path: string;
  title: string;
  text: string;
};

export type AssistantChatWorkspaceKnowledgeMatch = {
  source: WorkspaceKnowledgeSource;
  path: string;
  title: string;
  excerpt: string;
  score: number;
};

export type AssistantChatWorkspaceKnowledgeResult = {
  matches: AssistantChatWorkspaceKnowledgeMatch[];
  totalAvailable: number;
  guidance: string;
};

export type AssistantChatWorkspaceKnowledgeSource = {
  title: string;
  path: string;
  source: WorkspaceKnowledgeSource;
  excerpt: string;
};

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAX_FILE_BYTES = 80_000;
const MAX_EXCERPT_LENGTH = 720;

const KNOWLEDGE_ROOTS: Array<{
  source: WorkspaceKnowledgeSource;
  directory: string;
  extensions: Set<string>;
}> = [
  {
    source: "studio-assets",
    directory: "studio-assets",
    extensions: new Set([".md"]),
  },
  {
    source: "studio-skills",
    directory: "studio-skills",
    extensions: new Set([".md"]),
  },
  {
    source: "knowledge",
    directory: "knowledge",
    extensions: new Set([".md", ".ts", ".js", ".json"]),
  },
];

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const hasMojibake = (value: string): boolean =>
  /[\uFFFD\u9365\u9471\u6FB6\u5A11\u6748\u93BC\u7D31\u6C8C]/.test(value);

const hasAllowedExtension = (path: string, extensions: Set<string>): boolean => {
  const match = /\.[^.\\/]+$/.exec(path);
  return Boolean(match && extensions.has(match[0].toLowerCase()));
};

const toPortablePath = (path: string): string => path.split(sep).join("/");

const toSearchTokens = (value: string): string[] =>
  normalizeString(value)
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`~|/\\\uFF0C\u3002\uFF1B\uFF1A\uFF01\uFF1F\uFF08\uFF09\u3010\u3011\u3001]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const cleanKnowledgeText = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractTitle = (path: string, text: string): string => {
  const heading = /^#\s+(.+)$/m.exec(text);
  if (heading?.[1]) return heading[1].trim();
  const filename = path.split(/[\\/]/).pop() || path;
  return filename.replace(/\.[^.]+$/, "");
};

const collectKnowledgeFiles = async (
  root: (typeof KNOWLEDGE_ROOTS)[number],
  directory = join(REPO_ROOT, root.directory),
): Promise<string[]> => {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectKnowledgeFiles(root, fullPath));
      continue;
    }
    if (entry.isFile() && hasAllowedExtension(fullPath, root.extensions)) {
      files.push(fullPath);
    }
  }
  return files;
};

const loadKnowledgeDocuments = async (
  sourceFilter?: WorkspaceKnowledgeSource,
): Promise<WorkspaceKnowledgeDocument[]> => {
  const roots = sourceFilter
    ? KNOWLEDGE_ROOTS.filter((root) => root.source === sourceFilter)
    : KNOWLEDGE_ROOTS;
  const documents: WorkspaceKnowledgeDocument[] = [];

  for (const root of roots) {
    const files = await collectKnowledgeFiles(root);
    for (const filePath of files) {
      const fileStat = await stat(filePath).catch(() => null);
      if (!fileStat || fileStat.size > MAX_FILE_BYTES) continue;
      const raw = await readFile(filePath, "utf8").catch(() => "");
      const text = cleanKnowledgeText(raw);
      if (!text || hasMojibake(text)) continue;
      const portablePath = toPortablePath(relative(REPO_ROOT, filePath));
      documents.push({
        source: root.source,
        path: portablePath,
        title: extractTitle(portablePath, text),
        text,
      });
    }
  }

  return documents;
};

const countOccurrences = (value: string, token: string): number => {
  if (!token) return 0;
  let count = 0;
  let index = value.indexOf(token);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(token, index + token.length);
  }
  return count;
};

const scoreDocument = (
  document: WorkspaceKnowledgeDocument,
  tokens: string[],
): number => {
  const title = document.title.toLowerCase();
  const path = document.path.toLowerCase();
  const text = document.text.toLowerCase();
  return tokens.reduce((score, token) => {
    const titleScore = title.includes(token) ? 20 : 0;
    const pathScore = path.includes(token) ? 12 : 0;
    const bodyScore = Math.min(30, countOccurrences(text, token) * 4);
    return score + titleScore + pathScore + bodyScore;
  }, 0);
};

const createExcerpt = (
  document: WorkspaceKnowledgeDocument,
  tokens: string[],
): string => {
  const text = document.text.replace(/\s+/g, " ").trim();
  const lowerText = text.toLowerCase();
  const firstHit = tokens
    .map((token) => lowerText.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const start =
    firstHit === undefined ? 0 : Math.max(0, firstHit - Math.floor(MAX_EXCERPT_LENGTH / 3));
  const excerpt = text.slice(start, start + MAX_EXCERPT_LENGTH).trim();
  return `${start > 0 ? "..." : ""}${excerpt}${
    start + MAX_EXCERPT_LENGTH < text.length ? "..." : ""
  }`;
};

export const searchAssistantChatWorkspaceKnowledge = async (
  input: AssistantSidebarSearchWorkspaceKnowledgeArgs,
): Promise<AssistantChatWorkspaceKnowledgeResult> => {
  const query = normalizeString(input.query);
  const tokens = toSearchTokens(query);
  const numericLimit = Number(input.limit);
  const limit = Number.isFinite(numericLimit)
    ? Math.max(1, Math.floor(numericLimit))
    : 5;
  const documents = await loadKnowledgeDocuments(input.source);
  const matches = documents
    .map((document) => ({
      document,
      score: scoreDocument(document, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.document.path.localeCompare(b.document.path))
    .slice(0, limit)
    .map(({ document, score }) => ({
      source: document.source,
      path: document.path,
      title: document.title,
      excerpt: createExcerpt(document, tokens),
      score,
    }));

  return {
    matches,
    totalAvailable: documents.length,
    guidance:
      "This is local XC Studio knowledge retrieval. Use these snippets as context only; do not treat them as executable legacy skills.",
  };
};

export const extractAssistantChatWorkspaceKnowledgeSources = (
  result: unknown,
): AssistantChatWorkspaceKnowledgeSource[] => {
  if (!result || typeof result !== "object") return [];
  const matches = Array.isArray((result as Record<string, unknown>).matches)
    ? ((result as Record<string, unknown>).matches as unknown[])
    : [];
  const seen = new Set<string>();
  const sources: AssistantChatWorkspaceKnowledgeSource[] = [];

  for (const match of matches) {
    if (!match || typeof match !== "object") continue;
    const record = match as Record<string, unknown>;
    const path = normalizeString(record.path);
    const title = normalizeString(record.title) || path;
    const source = normalizeString(record.source) as WorkspaceKnowledgeSource;
    const excerpt = normalizeString(record.excerpt);
    if (!path || !title || seen.has(path)) continue;
    if (source !== "studio-assets" && source !== "studio-skills" && source !== "knowledge") {
      continue;
    }
    seen.add(path);
    sources.push({
      title,
      path,
      source,
      excerpt,
    });
  }

  return sources;
};

export const createAssistantChatWorkspaceKnowledgeTools = (): {
  tools: ToolSet;
} => ({
  tools: {
    searchWorkspaceKnowledge: tool({
      description:
        "Search local XC Studio knowledge files such as studio assets, studio skills, and lightweight knowledge snippets.",
      inputSchema: assistantSidebarSearchWorkspaceKnowledgeParameters,
      execute: async (input) =>
        searchAssistantChatWorkspaceKnowledge(
          input as AssistantSidebarSearchWorkspaceKnowledgeArgs,
        ),
    }),
  },
});
