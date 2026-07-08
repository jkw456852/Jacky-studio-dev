import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Project } from "../types/index.ts";
import {
  markProjectConversationDeleted,
  mergeConversationBackupsForSave,
  mergeConversationBackupsIntoProject,
  mergeLoadedProjectConversationsForHydration,
  mergeMissingConversationsForSave,
  mergeSaferConversationsForSave,
  rememberLoadedProjectConversationsForPersistence,
} from "./storage.ts";

test("workspace DB version includes the conversation backup store migration", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./storage.ts", import.meta.url)),
    "utf8",
  );
  const versionMatch = /const\s+DB_VERSION\s*=\s*(\d+)/.exec(source);

  assert.ok(versionMatch, "DB_VERSION should stay explicit for IndexedDB migrations");
  assert.ok(
    Number(versionMatch[1]) >= 7,
    "conversation_backups was added after version 6, so existing local DBs need a version bump",
  );
  assert.match(source, /\bCONVERSATION_BACKUP_STORE\b/);
  assert.match(source, /createObjectStore\(CONVERSATION_BACKUP_STORE/);
});

const createProject = (
  id: string,
  conversationIds: string[],
): Project => ({
  id,
  title: "Project",
  updatedAt: "2026-07-07",
  elements: [],
  markers: [],
  conversations: conversationIds.map((conversationId, index) => ({
    id: conversationId,
    title: conversationId,
    messages: [],
    createdAt: index + 1,
    updatedAt: index + 1,
  })),
});

test("mergeMissingConversationsForSave restores conversations missing from an incomplete save snapshot", () => {
  const existingProject = createProject("project-1", [
    "conv-current",
    "conv-history-a",
    "conv-history-b",
  ]);
  const nextProject = createProject("project-1", ["conv-current"]);

  const merged = mergeMissingConversationsForSave(
    existingProject,
    nextProject,
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
});

test("mergeMissingConversationsForSave does not restore explicitly deleted conversations", () => {
  const existingProject = createProject("project-2", [
    "conv-current",
    "conv-deleted",
  ]);
  const nextProject = createProject("project-2", ["conv-current"]);

  markProjectConversationDeleted("project-2", "conv-deleted");
  const merged = mergeMissingConversationsForSave(
    existingProject,
    nextProject,
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current"],
  );
});

test("mergeSaferConversationsForSave keeps fuller stored thread when a transient save has a shorter active topic", () => {
  const existingProject = createProject("project-3", ["conv-current"]);
  const nextProject = createProject("project-3", ["conv-current"]);

  existingProject.conversations![0] = {
    ...existingProject.conversations![0],
    messages: [
      { id: "legacy-1", role: "user", text: "old user", timestamp: 1 },
      { id: "legacy-2", role: "model", text: "old assistant", timestamp: 2 },
    ],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-1",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-1", role: "user", parts: [] },
        },
        {
          id: "assistant-2",
          parent_id: "assistant-1",
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };
  nextProject.conversations![0] = {
    ...nextProject.conversations![0],
    messages: [],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-2",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };

  const merged = mergeSaferConversationsForSave(existingProject, nextProject);

  assert.equal(merged.conversations?.[0]?.messages.length, 2);
  assert.equal(merged.conversations?.[0]?.assistantThread?.messages.length, 2);
});

test("mergeConversationBackupsIntoProject restores topics missing from a partial project snapshot", () => {
  const project = createProject("project-4", ["conv-current"]);
  const backup = createProject("project-4", [
    "conv-history-a",
    "conv-history-b",
  ]).conversations!;

  const merged = mergeConversationBackupsIntoProject(project, backup);

  assert.deepEqual(
    merged?.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
});

test("mergeConversationBackupsIntoProject does not resurrect explicitly deleted topics", () => {
  const project = createProject("project-5", ["conv-current"]);
  const backup = createProject("project-5", [
    "conv-deleted",
    "conv-history",
  ]).conversations!;

  markProjectConversationDeleted("project-5", "conv-deleted");
  const merged = mergeConversationBackupsIntoProject(project, backup);

  assert.deepEqual(
    merged?.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history"],
  );
});

test("mergeConversationBackupsForSave preserves history when the main project snapshot is already narrow", () => {
  const existingProject = createProject("project-6", ["conv-current"]);
  const nextProject = createProject("project-6", ["conv-current"]);
  const backup = createProject("project-6", [
    "conv-history-a",
    "conv-history-b",
  ]).conversations!;

  const merged = mergeConversationBackupsForSave(
    existingProject,
    nextProject,
    backup,
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
});

test("mergeConversationBackupsForSave restores backup topics even without a usable existing project snapshot", () => {
  const nextProject = createProject("project-7", ["conv-current"]);
  const backup = createProject("project-7", [
    "conv-history-a",
    "conv-history-b",
  ]).conversations!;

  const merged = mergeConversationBackupsForSave(
    undefined,
    nextProject,
    backup,
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
});

test("mergeConversationBackupsIntoProject keeps fuller backup content for an existing topic", () => {
  const project = createProject("project-8", ["conv-current", "conv-history"]);
  const backup = createProject("project-8", ["conv-current"]).conversations!;

  project.conversations![0] = {
    ...project.conversations![0],
    messages: [],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-2",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };
  backup[0] = {
    ...backup[0],
    messages: [
      { id: "legacy-1", role: "user", text: "old user", timestamp: 1 },
      { id: "legacy-2", role: "model", text: "old assistant", timestamp: 2 },
    ],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-1",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-1", role: "user", parts: [] },
        },
        {
          id: "assistant-2",
          parent_id: "assistant-1",
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };

  const merged = mergeConversationBackupsIntoProject(project, backup);

  assert.equal(merged?.conversations?.[0]?.messages.length, 2);
  assert.equal(merged?.conversations?.[0]?.assistantThread?.messages.length, 2);
  assert.deepEqual(
    merged?.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history"],
  );
});

test("mergeConversationBackupsForSave restores missing topics and fuller backup content in the same narrow save", () => {
  const existingProject = createProject("project-9", ["conv-current"]);
  const nextProject = createProject("project-9", ["conv-current"]);
  const backup = createProject("project-9", [
    "conv-current",
    "conv-history-a",
    "conv-history-b",
  ]).conversations!;

  nextProject.conversations![0] = {
    ...nextProject.conversations![0],
    messages: [],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-2",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };
  backup[0] = {
    ...backup[0],
    messages: [
      { id: "legacy-1", role: "user", text: "old user", timestamp: 1 },
      { id: "legacy-2", role: "model", text: "old assistant", timestamp: 2 },
    ],
    assistantThread: {
      headId: "assistant-2",
      messages: [
        {
          id: "assistant-1",
          parent_id: null,
          format: "ai-sdk/v6",
          content: { id: "assistant-1", role: "user", parts: [] },
        },
        {
          id: "assistant-2",
          parent_id: "assistant-1",
          format: "ai-sdk/v6",
          content: { id: "assistant-2", role: "assistant", parts: [] },
        },
      ],
    },
  };

  const merged = mergeConversationBackupsForSave(
    existingProject,
    nextProject,
    backup,
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
  assert.equal(merged.conversations?.[0]?.messages.length, 2);
  assert.equal(merged.conversations?.[0]?.assistantThread?.messages.length, 2);
});

test("mergeConversationBackupsForSave keeps topics from the loaded project when a refresh emits a narrow snapshot", () => {
  const loadedProject = createProject("project-10", [
    "conv-current",
    "conv-history-a",
    "conv-history-b",
  ]);
  const nextProject = createProject("project-10", ["conv-current"]);

  rememberLoadedProjectConversationsForPersistence(loadedProject);
  const merged = mergeConversationBackupsForSave(
    undefined,
    nextProject,
    [],
  );

  assert.deepEqual(
    merged.conversations?.map((conversation) => conversation.id),
    ["conv-current", "conv-history-a", "conv-history-b"],
  );
});

test("mergeLoadedProjectConversationsForHydration restores remembered topics before sidebar hydration", () => {
  const fullProject = createProject("project-11", [
    "conv-active",
    "conv-yesterday",
    "conv-today",
  ]);
  const narrowLoadedProject = createProject("project-11", ["conv-active"]);

  rememberLoadedProjectConversationsForPersistence(fullProject);
  const merged =
    mergeLoadedProjectConversationsForHydration(narrowLoadedProject);

  assert.deepEqual(
    merged?.conversations?.map((conversation) => conversation.id),
    ["conv-active", "conv-yesterday", "conv-today"],
  );
});
