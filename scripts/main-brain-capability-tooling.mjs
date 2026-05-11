import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const manifestModuleUrl = pathToFileURL(
  path.join(repoRoot, "services", "agents", "main-brain-capability-manifest.ts"),
).href;
const registryModuleUrl = pathToFileURL(
  path.join(repoRoot, "services", "agents", "main-brain-capability-registry.ts"),
).href;
const governanceExecutorPath = path.join(
  repoRoot,
  "services",
  "agents",
  "main-brain-role-governance.ts",
);

const normalizeText = (value) => String(value ?? "").trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");
const uniqueSorted = (values) =>
  Array.from(new Set((values || []).map((item) => normalizeText(item)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const parseArgs = (argv) => {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      result._.push(current);
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
};

const readTextFile = (filePath) => normalizeNewlines(fs.readFileSync(filePath, "utf8"));

const extractGovernanceHandlerKeys = (source) => {
  const startMarker = "const GOVERNANCE_ACTION_HANDLERS: Record<string, GovernanceActionHandler> = {";
  const endMarker = "\n\nexport const applyMainBrainRoleGovernanceAudit";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Unable to locate governance handler registry block.");
  }
  const block = source.slice(start, end);
  return uniqueSorted(Array.from(block.matchAll(/^\s{2}([a-z_]+):\s*\(/gm)).map((match) => match[1]));
};

const getGovernanceResourceLabel = (resource) => {
  switch (resource) {
    case "role":
      return "角色";
    case "role-addon":
      return "专家壳长期 addon";
    case "main-brain-soul":
      return "主脑 Soul 配置";
    case "main-brain-user":
      return "主脑 User 配置";
    case "main-brain-workflow":
      return "主脑 Workflow 配置";
    case "main-brain-memory":
      return "主脑长期记忆";
    case "main-brain-heartbeat":
      return "主脑 Heartbeat 任务";
    case "main-brain-bootstrap":
      return "主脑 Bootstrap 配置";
    default:
      return resource;
  }
};

const getGovernanceOperationLabel = (operation) => {
  switch (operation) {
    case "read":
      return "读取";
    case "create":
      return "创建";
    case "update":
      return "更新";
    case "archive":
      return "归档";
    case "promote":
      return "升级";
    case "delete":
      return "删除";
    case "bind":
      return "绑定";
    case "suggest":
      return "建议替换";
    default:
      return operation;
  }
};

const deriveAuditTemplates = ({ resource, operation }) => {
  const resourceLabel = getGovernanceResourceLabel(resource);
  const operationLabel = getGovernanceOperationLabel(operation);
  return {
    autoExecuted: `角色治理：已自动对${resourceLabel}执行${operationLabel}。`,
    suggestionOnly: `角色治理：${resourceLabel}的${operationLabel}仅记录为建议，未自动执行。`,
    skipped: `角色治理：${resourceLabel}的${operationLabel}缺少必要参数，已跳过。`,
  };
};

const loadCapabilityModules = async () => {
  const manifestModule = await import(manifestModuleUrl);
  const registryModule = await import(registryModuleUrl);
  return { manifestModule, registryModule };
};

const runCheck = async () => {
  const { manifestModule, registryModule } = await loadCapabilityModules();
  const { GOVERNANCE_CAPABILITIES } = manifestModule;
  const { buildMainBrainCapabilityPromptSummary, listGovernanceCapabilityExecutorKeys } = registryModule;

  const governanceCapabilities = Array.isArray(GOVERNANCE_CAPABILITIES) ? GOVERNANCE_CAPABILITIES : [];
  if (governanceCapabilities.length === 0) {
    throw new Error("No governance capabilities found in manifest.");
  }

  const missingMetadata = [];
  for (const capability of governanceCapabilities) {
    if (!capability?.id) missingMetadata.push("missing id");
    if (!capability?.executorKey) missingMetadata.push(`${capability?.id || "unknown"}: missing executorKey`);
    if (!capability?.mutation?.resource || !capability?.mutation?.operation) {
      missingMetadata.push(`${capability?.id || "unknown"}: missing mutation metadata`);
    }
    if (!capability?.permissionPolicy) {
      missingMetadata.push(`${capability?.id || "unknown"}: missing permissionPolicy`);
    }
    if (!capability?.exampleAction) {
      missingMetadata.push(`${capability?.id || "unknown"}: missing exampleAction`);
    }
  }

  const manifestExecutorKeys = uniqueSorted(governanceCapabilities.map((item) => item.executorKey || ""));
  const registryExecutorKeys = uniqueSorted(listGovernanceCapabilityExecutorKeys());
  const handlerKeys = extractGovernanceHandlerKeys(readTextFile(governanceExecutorPath));

  const manifestOnlyKeys = manifestExecutorKeys.filter(
    (key) => !registryExecutorKeys.some((item) => normalizeKey(item) === normalizeKey(key)),
  );
  const registryOnlyKeys = registryExecutorKeys.filter(
    (key) => !manifestExecutorKeys.some((item) => normalizeKey(item) === normalizeKey(key)),
  );
  const missingHandlerKeys = manifestExecutorKeys.filter(
    (key) => !handlerKeys.some((item) => normalizeKey(item) === normalizeKey(key)),
  );
  const orphanHandlerKeys = handlerKeys.filter(
    (key) => !manifestExecutorKeys.some((item) => normalizeKey(item) === normalizeKey(key)),
  );

  const governancePrompt = buildMainBrainCapabilityPromptSummary({
    includeInternalModules: false,
    includeSpecialists: false,
  });
  const missingPromptIds = governanceCapabilities
    .map((item) => item.id)
    .filter((id) => !governancePrompt.includes(id));

  const errors = [
    ...missingMetadata,
    ...manifestOnlyKeys.map((key) => `registry missing manifest executorKey: ${key}`),
    ...registryOnlyKeys.map((key) => `manifest missing registry executorKey: ${key}`),
    ...missingHandlerKeys.map((key) => `handler registry missing executorKey: ${key}`),
    ...orphanHandlerKeys.map((key) => `handler registry has orphan executorKey: ${key}`),
    ...missingPromptIds.map((id) => `governance prompt summary missing capability id: ${id}`),
  ];

  if (errors.length > 0) {
    console.error("[main-brain-capability-tooling] Coverage check failed:\n");
    errors.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
    return;
  }

  console.log("[main-brain-capability-tooling] Coverage check passed.");
  console.log(`- governance capabilities: ${governanceCapabilities.length}`);
  console.log(`- manifest executor keys: ${manifestExecutorKeys.join(", ")}`);
  console.log(`- handler executor keys: ${handlerKeys.join(", ")}`);
  console.log("- governance prompt summary is aligned with manifest capability ids.");
};

const quote = (value) => JSON.stringify(normalizeText(value));

const buildScaffold = (rawArgs) => {
  const id = normalizeText(rawArgs.id);
  const label = normalizeText(rawArgs.label);
  const executorKey = normalizeText(rawArgs.executorKey);
  const resource = normalizeText(rawArgs.resource);
  const operation = normalizeText(rawArgs.operation);

  if (!id || !label || !executorKey || !resource || !operation) {
    throw new Error(
      "Scaffold mode requires --id, --label, --executorKey, --resource, and --operation.",
    );
  }

  const purpose =
    normalizeText(rawArgs.purpose) || `${label} capability for ${getGovernanceOperationLabel(operation)}${getGovernanceResourceLabel(resource)}。`;
  const plannerSummary =
    normalizeText(rawArgs.plannerSummary) || `Planner-only governance capability for ${getGovernanceOperationLabel(operation)}${getGovernanceResourceLabel(resource)}。`;
  const useWhen =
    normalizeText(rawArgs.useWhen) || `当规划阶段需要对${getGovernanceResourceLabel(resource)}执行${getGovernanceOperationLabel(operation)}时。`;
  const reason =
    normalizeText(rawArgs.reason) || `需要对${getGovernanceResourceLabel(resource)}执行${getGovernanceOperationLabel(operation)}。`;
  const auditTemplates = deriveAuditTemplates({ resource, operation });

  const manifestSnippet = `{
  id: ${quote(id)},
  kind: 'governance-skill',
  label: ${quote(label)},
  purpose: ${quote(purpose)},
  plannerSummary: ${quote(plannerSummary)},
  useWhen: [${quote(useWhen)}],
  inputs: [
    { name: 'metadata', description: 'Planning and governance context.' },
  ],
  outputs: ['governanceResult'],
  tags: [${quote(resource)}, 'governance', ${quote(operation)}],
  auditChannel: 'roleGovernanceAudit',
  executorKey: ${quote(executorKey)},
  mutation: { resource: ${quote(resource)}, operation: ${quote(operation)} },
  permissionPolicy: {
    governanceModes: ['approval_required', 'auto_manage'],
    requireHumanApprovalByDefault: true,
  },
  exampleAction: governanceExample(
    {
      action: ${quote(executorKey)},
      capabilityId: ${quote(id)},
      reason: ${quote(reason)},
      requiresHumanApproval: true,
    },
    {
      resource: ${quote(resource)},
      operation: ${quote(operation)},
      reason: ${quote(reason)},
      requiresHumanApproval: true,
    },
  ),
},`;

  const handlerSnippet = `${quote(executorKey)}: ({ action, state }) => {
  state.notes.push(${quote(auditTemplates.suggestionOnly)});
},`;

  const registryTestSnippet = `test(${quote(`findGovernanceCapabilityByExecutorKey resolves ${executorKey}`)}, () => {
  const capability = findGovernanceCapabilityByExecutorKey(${quote(executorKey)});
  assert.equal(capability?.id, ${quote(id)});
  assert.equal(capability?.mutation?.resource, ${quote(resource)});
  assert.equal(capability?.mutation?.operation, ${quote(operation)});
});`;

  const manifestTestSnippet = `test(${quote(`${id} capability metadata is complete`)}, () => {
  const capability = GOVERNANCE_CAPABILITIES.find((item) => item.id === ${quote(id)});
  assert.equal(capability?.executorKey, ${quote(executorKey)});
  assert.equal(capability?.auditChannel, 'roleGovernanceAudit');
  assert.equal(capability?.mutation?.resource, ${quote(resource)});
  assert.equal(capability?.mutation?.operation, ${quote(operation)});
  assert.equal(Boolean(capability?.permissionPolicy), true);
  assert.equal(Boolean(capability?.exampleAction), true);
});`;

  console.log("[main-brain-capability-tooling] Governance scaffold generated.\n");
  console.log("# Manifest snippet\n");
  console.log(manifestSnippet);
  console.log("\n# Handler snippet\n");
  console.log(handlerSnippet);
  console.log("\n# Registry test snippet\n");
  console.log(registryTestSnippet);
  console.log("\n# Manifest test snippet\n");
  console.log(manifestTestSnippet);
  console.log("\n# Derived audit note templates\n");
  console.log(`- autoExecuted: ${auditTemplates.autoExecuted}`);
  console.log(`- suggestionOnly: ${auditTemplates.suggestionOnly}`);
  console.log(`- skipped: ${auditTemplates.skipped}`);
  console.log("\n# Prompt summary note\n");
  console.log(
    "- Governance capability prompt summary is already manifest-derived. Adding the manifest snippet is enough; no extra manual prompt copy is required.",
  );
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const command = normalizeText(args._[0] || "check").toLowerCase();

  if (command === "check") {
    await runCheck();
    return;
  }

  if (command === "scaffold") {
    buildScaffold(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error(`[main-brain-capability-tooling] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
