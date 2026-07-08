# Workspace Architecture Map

Last updated: 2026-07-07

## Current Authority

The workspace assistant sidebar now uses the assistant-ui + AI SDK path. Do not
reintroduce the removed legacy `AssistantSidebar*.tsx` component family or the
removed `useAssistantSidebar*.ts` controllers.

Authoritative sidebar entry points:

- `pages/Workspace/components/WorkspaceSidebarLayer.tsx`
- `pages/Workspace/components/assistantSidebarAiSdkRuntime.runtime.tsx`
- `pages/Workspace/components/assistantSidebarToolkit.tsx`
- `pages/Workspace/components/assistantSidebarToolUis.tsx`
- `api/assistant-chat.ts`
- `services/assistant-ui/assistant-ai-sdk-toolkit-server.ts`
- `services/assistant-ui/assistant-sidebar-server-toolkit.ts`

Official integration boundary:

- Frontend runtime: `useChatRuntime` with `AssistantChatTransport`.
- Thread persistence: assistant-ui `ThreadHistoryAdapter.withFormat` style
  storage over UIMessage-shaped assistant threads.
- Tooling: assistant-ui `defineToolkit`/`providerTool`/`stubTool` on the client
  and `AISDKToolkit(...).tools(...)` with AI SDK tools on the server.
- Streaming: AI SDK `streamText` and UI message parts. Do not mirror the new
  assistant thread into legacy `ChatMessage.agentData` or old progress
  broadcast chains.

## Workspace Shell

Current high-level workspace composition:

- `pages/Workspace.tsx` owns the page shell and still coordinates canvas,
  legacy workflow surfaces, project state, and panel props.
- `pages/Workspace/controllers/useWorkspacePageShellProps.ts` assembles shell
  props.
- `pages/Workspace/components/WorkspaceSidebarLayer.tsx` mounts the assistant-ui
  sidebar runtime lazily and wraps it in the current assistant sidebar layout.
- `pages/Workspace/components/WorkspaceLeftPanel.tsx` and
  `WorkspaceGeneratedFilesPanel.tsx` read active conversation data directly
  from the conversation/session state, including `assistantThread`, instead of
  depending on the legacy global agent message mirror.

## Legacy Boundaries

Some legacy types and services remain because bottom/canvas/workflow features
still use them. They must not be treated as the new sidebar chat architecture.

Still legacy-scoped:

- `ChatMessage`
- `agentData`
- `skillData`
- `stores/agent.store.ts`
- old skill execution services under `services/agents/` and `services/skills/`

Assistant-ui sidebar code must not import or adapt those chains as chat state.
When a feature is migrated, prefer deleting the old entry point after the new
assistant-ui / AI SDK path is live and verified.

Removed legacy entry points that must not return:

- `hooks/useAgentOrchestrator.ts`
- `pages/Workspace/controllers/useWorkspaceSend.ts`
- `pages/Workspace/controllers/useWorkspaceSmartGenerate.ts`

## Current Cleanup Direction

1. Keep new sidebar entry points on official assistant-ui and AI SDK primitives.
2. Delete obsolete examples, barrels, plans, and debug files that point future
   work back to removed sidebar code.
3. Migrate valuable legacy capabilities only as assistant-ui tools, AI SDK
   server tools, provider-native tools, or MCP tools.
4. Preserve project-specific glue only where it is truly specific to XC Studio,
   such as reading provider settings or syncing generated assets back to the
   canvas.
5. Add guard tests whenever a deleted legacy path is likely to be reintroduced.

## Verification

Use targeted assistant-ui guard tests plus TypeScript verification after sidebar
architecture changes:

```powershell
node --experimental-strip-types --test services/assistant-ui/assistant-ui-official-integration-guard.test.ts services/assistant-ui/assistant-sidebar-composer-and-reasoning.test.ts
npx tsc --noEmit --pretty false
```
