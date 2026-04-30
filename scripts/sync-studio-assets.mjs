import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const assetsRoot = path.join(repoRoot, "studio-assets");
const outputJsonPath = path.join(
  repoRoot,
  "public",
  "runtime-assets",
  "studio-registry.json",
);
const outputTsPath = path.join(
  repoRoot,
  "services",
  "runtime-assets",
  "generated",
  "studio-registry.generated.ts",
);

const sharedInstructionTokens = {
  "{{shared.imagenGoldenFormula}}": "imagenGoldenFormula",
  "{{shared.jsonRules}}": "jsonRules",
  "{{shared.interactionRules}}": "interactionRules",
  "{{shared.corePlanningBrain}}": "corePlanningBrain",
  "{{shared.deliverableDecompositionBrain}}": "deliverableDecompositionBrain",
  "{{shared.planningSelfCheckBrain}}": "planningSelfCheckBrain",
  "{{shared.unifiedAgentBrain}}": "unifiedAgentBrain",
};

const ensureDir = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const walkMarkdownFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkMarkdownFiles(absolute);
    }
    return entry.name.endsWith(".md") ? [absolute] : [];
  });
};

const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");

const readMarkdownAsset = (filePath) => {
  const raw = normalizeNewlines(fs.readFileSync(filePath, "utf8"));
  const metaMatch = raw.match(/^```json\s*\n([\s\S]*?)\n```\s*/);
  if (!metaMatch) {
    return null;
  }
  const meta = JSON.parse(metaMatch[1]);
  const rest = raw.slice(metaMatch[0].length);
  const sections = {};
  const sectionRegex = /^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s+|\s*$)/gm;
  let match = sectionRegex.exec(rest);
  while (match) {
    sections[match[1].trim()] = match[2].trim();
    match = sectionRegex.exec(rest);
  }
  return {
    filePath,
    meta,
    sections,
  };
};

const buildRoutingPromptBlock = (rules) =>
  rules
    .filter((rule) => Number(rule.priority) < 99)
    .map(
      (rule, index) =>
        `## ${index + 3}. ${rule.label} → ${rule.agent.charAt(0).toUpperCase()}${rule.agent.slice(1)}\n触发词：${rule.keywords.join("、")}\n→ targetAgent: "${rule.agent}"`,
    )
    .join("\n\n");

const replaceAllTokens = (template, replacements) => {
  let output = template;
  Object.entries(replacements).forEach(([token, value]) => {
    output = output.split(token).join(String(value ?? ""));
  });
  return output.trim();
};

const main = () => {
  const files = walkMarkdownFiles(assetsRoot)
    .map(readMarkdownAsset)
    .filter(Boolean);
  const sharedInstructionsAsset = files.find(
    (asset) => asset.meta.type === "shared-instructions",
  );
  if (!sharedInstructionsAsset) {
    throw new Error("Missing shared-instructions asset");
  }

  const sharedInstructions = {
    imagenGoldenFormula: sharedInstructionsAsset.sections.ImagenGoldenFormula || "",
    jsonRules: sharedInstructionsAsset.sections.JsonRules || "",
    interactionRules: sharedInstructionsAsset.sections.InteractionRules || "",
    corePlanningBrain: sharedInstructionsAsset.sections.CorePlanningBrain || "",
    deliverableDecompositionBrain:
      sharedInstructionsAsset.sections.DeliverableDecompositionBrain || "",
    planningSelfCheckBrain:
      sharedInstructionsAsset.sections.PlanningSelfCheckBrain || "",
  };

  sharedInstructions.unifiedAgentBrain = [
    sharedInstructions.corePlanningBrain,
    "",
    sharedInstructions.deliverableDecompositionBrain,
    "",
    sharedInstructions.planningSelfCheckBrain,
    "",
    "# Role Overlay Principle",
    "- 你们本质上共享同一个底层脑子。当前角色只是任务覆盖层，决定你的专业偏向、输出风格与可调用能力，不改变你的基础思考质量。",
    "- 先用统一脑子思考，再用当前角色语气、领域知识和工具规则完成输出。",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  const routingAsset = files.find((asset) => asset.meta.type === "routing-config");
  if (!routingAsset) {
    throw new Error("Missing routing-config asset");
  }

  const compiledRouting = {
    rules: routingAsset.meta.rules || [],
    editKeywords: routingAsset.meta.editKeywords || [],
    chatPatterns: routingAsset.meta.chatPatterns || [],
    vaguePatterns: routingAsset.meta.vaguePatterns || [],
  };
  compiledRouting.promptBlock = buildRoutingPromptBlock(compiledRouting.rules);

  const sharedTokenValues = Object.fromEntries(
    Object.entries(sharedInstructionTokens).map(([token, key]) => [token, sharedInstructions[key]]),
  );

  const renderTemplate = (template) =>
    replaceAllTokens(template, {
      ...sharedTokenValues,
      "{{routing.promptBlock}}": compiledRouting.promptBlock,
    });

  const primaryAgents = files
    .filter((asset) => asset.meta.type === "agent-role")
    .map((asset) => ({
      asset,
      systemPrompt: renderTemplate(asset.sections.PromptTemplate || ""),
    }));

  const specializations = files
    .filter((asset) => asset.meta.type === "specialization-role")
    .map((asset) => ({
      asset,
      systemPrompt: renderTemplate(asset.sections.PromptTemplate || ""),
    }));

  const styleLibraries = files.filter((asset) => asset.meta.type === "style-library");
  const plugins = files.filter((asset) => asset.meta.type === "plugin");
  const systems = files
    .filter((asset) => asset.meta.type === "system-prompt")
    .map((asset) => ({
      asset,
      prompt: renderTemplate(asset.sections.PromptTemplate || ""),
    }));

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: "studio-assets",
    primaryAgentIds: primaryAgents.map((entry) => entry.asset.meta.agentId),
    sharedInstructions,
    routing: {
      ...compiledRouting,
      promptBlock: compiledRouting.promptBlock,
    },
    agents: Object.fromEntries(
      primaryAgents.map(({ asset, systemPrompt }) => [
        asset.meta.agentId,
        {
          id: asset.meta.agentId,
          info: {
            id: asset.meta.agentId,
            name: asset.meta.name,
            avatar: asset.meta.avatar,
            description: asset.meta.description,
            capabilities: asset.meta.capabilities || [],
            color: asset.meta.color,
          },
          roleProfile: {
            agentId: asset.meta.agentId,
            purpose: asset.meta.purpose,
            useWhen: asset.meta.useWhen || [],
            avoidWhen: asset.meta.avoidWhen || [],
            adaptWhen: asset.meta.adaptWhen || [],
            dynamicRolePolicy: asset.meta.dynamicRolePolicy,
          },
          systemPrompt,
          promptTemplate: asset.sections.PromptTemplate || "",
          notes: asset.sections.Notes || "",
          tags: asset.meta.tags || [],
        },
      ]),
    ),
    specializations: Object.fromEntries(
      specializations.map(({ asset, systemPrompt }) => [
        asset.meta.id,
        {
          id: asset.meta.id,
          ownerAgentId: asset.meta.ownerAgentId,
          info: {
            name: asset.meta.name,
            avatar: asset.meta.avatar,
            description: asset.meta.description,
            capabilities: asset.meta.capabilities || [],
            color: asset.meta.color,
          },
          systemPrompt,
          promptTemplate: asset.sections.PromptTemplate || "",
          notes: asset.sections.Notes || "",
          tags: asset.meta.tags || [],
        },
      ]),
    ),
    styleLibraries: Object.fromEntries(
      styleLibraries.map((asset) => [
        asset.meta.mode,
        {
          mode: asset.meta.mode,
          label: asset.meta.label,
          hint: asset.meta.hint,
          library: {
            title: asset.meta.label,
            summary: asset.meta.summary,
            referenceInterpretation: asset.meta.referenceInterpretation,
            planningDirectives: asset.meta.planningDirectives || [],
            promptDirectives: asset.meta.promptDirectives || [],
            createdBy: asset.meta.createdBy,
          },
          notes: asset.sections.Notes || "",
        },
      ]),
    ),
    plugins: Object.fromEntries(
      plugins.map((asset) => [
        asset.meta.id,
        {
          id: asset.meta.id,
          name: asset.meta.name,
          label: asset.meta.label || asset.meta.name,
          description: asset.meta.description || "",
          category: asset.meta.category || "other",
          skillId: asset.meta.skillId || undefined,
          defaultEnabled: asset.meta.defaultEnabled !== false,
          defaultPinned: asset.meta.defaultPinned === true,
          notes: asset.sections.Notes || "",
          tags: asset.meta.tags || [],
        },
      ]),
    ),
    systems: Object.fromEntries(
      systems.map(({ asset, prompt }) => [
        asset.meta.systemId,
        {
          id: asset.meta.systemId,
          title: asset.meta.title,
          summary: asset.meta.summary || "",
          prompt,
          promptTemplate: asset.sections.PromptTemplate || "",
        },
      ]),
    ),
  };

  ensureDir(outputJsonPath);
  ensureDir(outputTsPath);

  fs.writeFileSync(outputJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    outputTsPath,
    `export const STUDIO_REGISTRY_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;\n`,
    "utf8",
  );

  console.log(
    `[sync-studio-assets] wrote ${path.relative(repoRoot, outputJsonPath)} and ${path.relative(
      repoRoot,
      outputTsPath,
    )}`,
  );
};

main();
