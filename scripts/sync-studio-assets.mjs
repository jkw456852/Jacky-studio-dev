import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const assetsRoot = path.join(repoRoot, "studio-assets");
const studioSkillsRoot = path.join(repoRoot, "studio-skills");
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

const STUDIO_SKILL_RUNTIME_SKILL_DATA_ID = "autonomous-main-brain";

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

const walkStudioSkillFiles = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const skillFilePath = path.join(dir, entry.name, "SKILL.md");
    return fs.existsSync(skillFilePath) ? [skillFilePath] : [];
  });
};

const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n");

const normalizeWhitespace = (value) =>
  String(value || "").replace(/\s+/g, " ").trim();

const normalizeStringList = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean)
    : [];

const dedupeStringList = (value) => [...new Set(normalizeStringList(value))];

const clipString = (value, maxLength = 240) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trim()}...`;
};

const parseMarkdownSections = (raw) => {
  const sections = {};
  const headingRegex = /^##\s+([^\n]+)\n/gm;
  const headings = [];
  let match = headingRegex.exec(raw);

  while (match) {
    headings.push({
      title: match[1].trim(),
      contentStart: headingRegex.lastIndex,
      headingStart: match.index,
    });
    match = headingRegex.exec(raw);
  }

  headings.forEach((heading, index) => {
    const nextHeadingStart =
      index + 1 < headings.length ? headings[index + 1].headingStart : raw.length;
    sections[heading.title] = raw.slice(heading.contentStart, nextHeadingStart).trim();
  });

  return sections;
};

const parseSectionList = (value) => {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
};

const parseTopLevelMarkdownList = (value) => {
  const lines = normalizeNewlines(String(value || "")).split("\n");
  const items = [];
  let currentItem = "";

  const pushCurrentItem = () => {
    const normalized = normalizeWhitespace(currentItem);
    if (normalized) items.push(normalized);
    currentItem = "";
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const indent = line.match(/^\s*/)?.[0]?.length || 0;
    const topLevelMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (topLevelMatch && indent <= 2) {
      pushCurrentItem();
      currentItem = topLevelMatch[1].trim();
      return;
    }

    if (!currentItem) {
      currentItem = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "").trim();
      return;
    }

    const continuationText = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "").trim();
    if (!continuationText) return;
    const separator = /^[*-]\s+/.test(trimmed) ? "; " : " ";
    currentItem = `${currentItem}${separator}${continuationText}`;
  });

  pushCurrentItem();
  return items;
};

const getFirstMeaningfulParagraph = (value) => {
  const paragraphs = normalizeNewlines(String(value || ""))
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" "),
    )
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);

  const preferredParagraph = paragraphs.find(
    (paragraph) =>
      !/^(?:[-*]|\d+\.)\s+/.test(paragraph) &&
      !/[:：]$/.test(paragraph),
  );

  return preferredParagraph || paragraphs[0] || "";
};

const getSectionValue = (sections, names) => {
  for (const name of names) {
    const sectionValue = String(sections?.[name] || "").trim();
    if (sectionValue) return sectionValue;
  }
  return "";
};

const getSectionSummary = (value) => {
  const paragraph = getFirstMeaningfulParagraph(value);
  if (paragraph) return paragraph;
  return parseTopLevelMarkdownList(value)[0] || "";
};

const resolveSectionText = (sectionValue, metaValue) => {
  const sectionText = String(sectionValue || "").trim();
  if (sectionText) return sectionText;
  const metaText = String(metaValue || "").trim();
  return metaText;
};

const resolveSectionStringList = (sectionValue, metaValue) => {
  const sectionItems = parseSectionList(sectionValue);
  return sectionItems.length > 0 ? sectionItems : normalizeStringList(metaValue);
};

const readMarkdownAsset = (filePath) => {
  const raw = normalizeNewlines(fs.readFileSync(filePath, "utf8"));
  const metaMatch = raw.match(/^```json\s*\n([\s\S]*?)\n```\s*/);
  if (!metaMatch) {
    return null;
  }
  const meta = JSON.parse(metaMatch[1]);
  const rest = raw.slice(metaMatch[0].length);
  const sections = parseMarkdownSections(rest);
  return {
    filePath,
    meta,
    sections,
  };
};

const parseSimpleFrontmatter = (raw) => {
  const meta = {};
  let currentKey = null;

  const parseScalar = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  };

  normalizeNewlines(raw)
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const keyMatch = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
      if (keyMatch && !line.startsWith(" ")) {
        currentKey = keyMatch[1];
        const rawValue = keyMatch[2].trim();
        if (!rawValue) {
          meta[currentKey] = [];
        } else {
          meta[currentKey] = parseScalar(rawValue);
          currentKey = null;
        }
        return;
      }

      const listMatch = line.match(/^\s*-\s+(.*)$/);
      if (listMatch && currentKey) {
        if (!Array.isArray(meta[currentKey])) {
          meta[currentKey] = [];
        }
        meta[currentKey].push(parseScalar(listMatch[1]));
      }
    });

  return meta;
};

const readStudioSkillMarkdownAsset = (filePath) => {
  const raw = normalizeNewlines(fs.readFileSync(filePath, "utf8"));
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!frontmatterMatch) {
    return null;
  }

  const meta = parseSimpleFrontmatter(frontmatterMatch[1]);
  const body = raw.slice(frontmatterMatch[0].length);
  return {
    filePath,
    meta,
    body,
    sections: parseMarkdownSections(body),
  };
};

const mapStudioSkillRouteIntentToTab = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (
    normalized === "video" ||
    normalized === "social" ||
    normalized === "commerce" ||
    normalized === "branding"
  ) {
    return normalized;
  }
  return "branding";
};

const mapStudioSkillModeToPresetCategory = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === "workflow") return "workflow";
  return "agent";
};

const mapStudioSkillModeToExecutionType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === "workflow") return "workflow";
  return "agent";
};

const resolveStudioSkillActivationHint = (asset) =>
  clipString(
    getSectionSummary(getSectionValue(asset.sections, ["When to Use"])) ||
      asset.meta.description,
    180,
  );

const resolveStudioSkillInstruction = (asset) =>
  clipString(
    getSectionSummary(getSectionValue(asset.sections, ["Purpose"])) ||
      asset.meta.description,
    320,
  );

const compileStudioSkillPresetAsset = (asset, index) => {
  const skillId = normalizeWhitespace(asset.meta.id).toLowerCase();
  const directoryId = path.basename(path.dirname(asset.filePath)).toLowerCase();
  const title = normalizeWhitespace(asset.meta.title);
  const description = normalizeWhitespace(asset.meta.description);
  const status = normalizeWhitespace(asset.meta.status).toLowerCase();
  if (!skillId || !title || !description) {
    throw new Error(
      `Invalid studio skill at ${path.relative(repoRoot, asset.filePath)}: missing required frontmatter fields`,
    );
  }
  if (skillId !== directoryId) {
    throw new Error(
      `Invalid studio skill at ${path.relative(repoRoot, asset.filePath)}: frontmatter id "${skillId}" must match directory "${directoryId}"`,
    );
  }
  if (status && status !== "active") {
    return null;
  }

  const routeIntent =
    normalizeWhitespace(asset.meta.route_intent).toLowerCase() ||
    normalizeWhitespace(asset.meta.category).toLowerCase() ||
    "branding";
  const mode = normalizeWhitespace(asset.meta.mode).toLowerCase() || "skill";
  const abilities = dedupeStringList(asset.meta.abilities);
  const clarifyChecklist = dedupeStringList(asset.meta.clarify_checklist);
  const inputs = dedupeStringList(asset.meta.inputs);
  const declaredOutputs = dedupeStringList(asset.meta.outputs);
  const workflowSection = getSectionValue(asset.sections, ["Workflow"]);
  const outputSection = getSectionValue(asset.sections, ["Output", "Outputs"]);
  const boundariesSection = getSectionValue(asset.sections, ["Boundaries"]);
  const examplePromptsSection = getSectionValue(asset.sections, ["Example Prompts"]);
  const executionOutline = dedupeStringList(parseTopLevelMarkdownList(workflowSection));
  const outputBlueprint = dedupeStringList([
    ...declaredOutputs,
    ...parseTopLevelMarkdownList(outputSection),
  ]);
  const toolPolicy = dedupeStringList(parseTopLevelMarkdownList(boundariesSection));
  const examplePrompt = clipString(
    parseTopLevelMarkdownList(examplePromptsSection)[0] || "",
    320,
  );
  const activationHint = resolveStudioSkillActivationHint(asset);
  const instruction = resolveStudioSkillInstruction(asset);
  const routeSummary = clipString(
    instruction || activationHint || description,
    220,
  );
  const tags = dedupeStringList([
    normalizeWhitespace(asset.meta.category).toLowerCase(),
    "studio-skill",
    "skill-md-v1",
    ...abilities,
  ]);

  return {
    id: skillId,
    name: title,
    description,
    category: mapStudioSkillModeToPresetCategory(mode),
    tab: mapStudioSkillRouteIntentToTab(routeIntent),
    frontstagePriority: "primary",
    executionType: mapStudioSkillModeToExecutionType(mode),
    activationHint: activationHint || description,
    iconName: normalizeWhitespace(asset.meta.icon) || "Sparkles",
    order:
      typeof asset.meta.order === "number" && Number.isFinite(asset.meta.order)
        ? asset.meta.order
        : 40 + index * 5,
    skillDataId: STUDIO_SKILL_RUNTIME_SKILL_DATA_ID,
    skillDataName: title,
    allowAutonomousRouting: true,
    mode: "unified-sidebar-agent",
    frontstageSkillId: skillId,
    routeIntent,
    routeLabel: title,
    routeSummary,
    ...(abilities.length > 0 ? { preferredSkills: abilities } : {}),
    suggestedTaskMode: "generate",
    ...(normalizeWhitespace(asset.meta.follow_up_mode)
      ? { followUpMode: normalizeWhitespace(asset.meta.follow_up_mode) }
      : {}),
    ...(clarifyChecklist.length > 0 ? { clarifyChecklist } : {}),
    ...(outputBlueprint.length > 0 ? { outputBlueprint } : {}),
    ...(executionOutline.length > 0 ? { executionOutline } : {}),
    ...(toolPolicy.length > 0 ? { toolPolicy } : {}),
    ...(instruction ? { instruction } : {}),
    ...(examplePrompt ? { examplePrompt } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(inputs.length > 0 ? { notes: `Inputs: ${inputs.join(" | ")}` } : {}),
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
  const skillPresets = files.filter((asset) => asset.meta.type === "skill-preset");
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
    skillPresets: Object.fromEntries(
      skillPresets.map((asset) => [
        asset.meta.id,
        (() => {
          const clarifyChecklist = resolveSectionStringList(
            asset.sections.ClarifyChecklist,
            asset.meta.clarifyChecklist,
          );
          const reusableQuestions = resolveSectionStringList(
            asset.sections.ClarifyQuestions,
            asset.meta.reusableQuestions,
          );
          const executionOutline = resolveSectionStringList(
            asset.sections.ExecutionOutline,
            asset.meta.executionOutline,
          );
          const executionRecipe = resolveSectionStringList(
            asset.sections.ExecutionRecipe,
            asset.meta.executionRecipe,
          );
          const outputBlueprint = resolveSectionStringList(
            asset.sections.OutputBlueprint,
            asset.meta.outputBlueprint,
          );
          const toolPolicy = resolveSectionStringList(
            asset.sections.ToolPolicy,
            asset.meta.toolPolicy,
          );
          const examplePrompt = resolveSectionText(
            asset.sections.ExamplePrompt,
            asset.meta.examplePrompt,
          );
          return {
          id: asset.meta.id,
          name: asset.meta.name,
          description: asset.meta.description || "",
          category: asset.meta.category || "agent",
          tab: asset.meta.tab || "branding",
          frontstagePriority: asset.meta.frontstagePriority || "secondary",
          executionType: asset.meta.executionType || "skill",
          activationHint: asset.meta.activationHint || "",
          iconName: asset.meta.iconName || "Sparkles",
          order: Number(asset.meta.order || 999),
          skillDataId: asset.meta.skillDataId || asset.meta.id,
          ...(asset.meta.skillDataName
            ? { skillDataName: asset.meta.skillDataName }
            : {}),
          ...(asset.meta.pluginId ? { pluginId: asset.meta.pluginId } : {}),
          ...(asset.meta.requiresAttachments === true
            ? { requiresAttachments: true }
            : {}),
          ...(asset.meta.followUpMode
            ? { followUpMode: asset.meta.followUpMode }
            : {}),
          ...(asset.meta.allowAutonomousRouting === true
            ? { allowAutonomousRouting: true }
            : {}),
          ...(asset.meta.mode ? { mode: asset.meta.mode } : {}),
          ...(asset.meta.frontstageSkillId
            ? { frontstageSkillId: asset.meta.frontstageSkillId }
            : {}),
          ...(asset.meta.routeIntent ? { routeIntent: asset.meta.routeIntent } : {}),
          ...(asset.meta.routeLabel ? { routeLabel: asset.meta.routeLabel } : {}),
          ...(asset.meta.routeSummary
            ? { routeSummary: asset.meta.routeSummary }
            : {}),
          ...(Array.isArray(asset.meta.preferredSkills)
            ? { preferredSkills: asset.meta.preferredSkills }
            : {}),
          ...(asset.meta.suggestedTaskMode
            ? { suggestedTaskMode: asset.meta.suggestedTaskMode }
            : {}),
          ...(clarifyChecklist.length > 0
            ? { clarifyChecklist }
            : {}),
          ...(reusableQuestions.length > 0
            ? { reusableQuestions }
            : {}),
          ...(executionOutline.length > 0
            ? { executionOutline }
            : {}),
          ...(executionRecipe.length > 0
            ? { executionRecipe }
            : {}),
          ...(outputBlueprint.length > 0
            ? { outputBlueprint }
            : {}),
          ...(toolPolicy.length > 0
            ? { toolPolicy }
            : {}),
          ...(asset.sections.Instruction || asset.meta.instruction
            ? {
                instruction:
                  asset.sections.Instruction || asset.meta.instruction || "",
              }
            : {}),
          ...(examplePrompt ? { examplePrompt } : {}),
          ...(asset.sections.Notes ? { notes: asset.sections.Notes } : {}),
          ...(asset.sections.Research ? { research: asset.sections.Research } : {}),
          ...(Array.isArray(asset.meta.tags) ? { tags: asset.meta.tags } : {}),
          ...(Array.isArray(asset.meta.sources)
            ? { sources: asset.meta.sources }
            : {}),
          };
        })(),
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
