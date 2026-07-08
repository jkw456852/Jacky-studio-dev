import type {
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../skill-object-types.ts";

export interface SkillDraftInput {
  definition: SkillDefinition;
  version: SkillVersion;
  preset?: SkillPreset;
}

export interface SkillVersionQuery {
  definitionId?: string;
  releaseStatus?: SkillVersion["releaseStatus"];
  reviewStatus?: SkillVersion["reviewStatus"];
  limit?: number;
}

export interface UpdateDraftSkillVersionPatch {
  semver?: string;
  manifest?: SkillVersion["manifest"];
  changelog?: SkillVersion["changelog"];
  sourceSnapshot?: SkillVersion["sourceSnapshot"];
}

export interface SkillCatalogStore {
  upsertDefinition(definition: SkillDefinition): SkillDefinition;
  getDefinition(definitionId: string): SkillDefinition | null;
  listDefinitions(): SkillDefinition[];

  createDraftVersion(input: SkillDraftInput): SkillVersion;
  updateDraftVersion(
    versionId: string,
    patch: UpdateDraftSkillVersionPatch,
  ): SkillVersion;
  getVersion(versionId: string): SkillVersion | null;
  listVersions(query?: SkillVersionQuery): SkillVersion[];
  updateVersionReviewStatus(
    versionId: string,
    status: SkillVersion["reviewStatus"],
    actor: string,
  ): SkillVersion;
  publishVersion(versionId: string, actor: string): SkillVersion;
  deprecateVersion(versionId: string, actor: string): SkillVersion;
  rollbackToVersion(definitionId: string, versionId: string, actor: string): SkillVersion;

  upsertPreset(preset: SkillPreset): SkillPreset;
  getPreset(presetId: string): SkillPreset | null;
  listPresets(definitionId?: string): SkillPreset[];

  clear(): void;
}

export interface CreateInMemorySkillCatalogStoreOptions {
  now?: () => number;
}

const cloneDefinition = (d: SkillDefinition): SkillDefinition => ({
  ...d,
  tags: [...d.tags],
});

const cloneVersion = (v: SkillVersion): SkillVersion => ({
  ...v,
  manifest: JSON.parse(JSON.stringify(v.manifest)),
  sourceSnapshot: v.sourceSnapshot ? { ...v.sourceSnapshot } : undefined,
});

const clonePreset = (p: SkillPreset): SkillPreset => ({
  ...p,
  visibleToRoles: p.visibleToRoles ? [...p.visibleToRoles] : undefined,
});

export const createInMemorySkillCatalogStore = (
  options: CreateInMemorySkillCatalogStoreOptions = {},
): SkillCatalogStore => {
  const now = options.now ?? (() => Date.now());
  const definitions = new Map<string, SkillDefinition>();
  const versions = new Map<string, SkillVersion>();
  const presets = new Map<string, SkillPreset>();

  const setDefinition = (definition: SkillDefinition): SkillDefinition => {
    const next = { ...definition, updatedAt: now() } as SkillDefinition;
    if (!definitions.has(definition.id)) {
      next.createdAt = next.createdAt || now();
    }
    definitions.set(definition.id, next);
    return cloneDefinition(next);
  };

  const ensureDefinition = (definitionId: string): SkillDefinition => {
    const existing = definitions.get(definitionId);
    if (!existing) throw new Error(`skill_definition_not_found: ${definitionId}`);
    return existing;
  };

  const ensureVersion = (versionId: string): SkillVersion => {
    const existing = versions.get(versionId);
    if (!existing) throw new Error(`skill_version_not_found: ${versionId}`);
    return existing;
  };

  const setPreset = (preset: SkillPreset): SkillPreset => {
    const next: SkillPreset = {
      ...preset,
      updatedAt: now(),
    };
    presets.set(next.id, next);
    return clonePreset(next);
  };

  return {
    upsertDefinition(definition) {
      return setDefinition(definition);
    },

    getDefinition(definitionId) {
      const existing = definitions.get(definitionId);
      return existing ? cloneDefinition(existing) : null;
    },

    listDefinitions() {
      return Array.from(definitions.values()).map(cloneDefinition);
    },

    createDraftVersion(input) {
      if (input.version.skillDefinitionId !== input.definition.id) {
        throw new Error(
          `skill_version_definition_mismatch: ${input.version.id} not in ${input.definition.id}`,
        );
      }
      if (input.preset && input.preset.skillDefinitionId !== input.definition.id) {
        throw new Error(
          `skill_preset_definition_mismatch: ${input.preset.id} not in ${input.definition.id}`,
        );
      }
      if (!definitions.has(input.definition.id)) {
        setDefinition(input.definition);
      }
      const draft: SkillVersion = {
        ...input.version,
        reviewStatus: "draft",
        releaseStatus: "draft",
        createdAt: input.version.createdAt || now(),
      };
      versions.set(draft.id, draft);
      const definition = definitions.get(input.definition.id)!;
      const nextDefinition: SkillDefinition = {
        ...definition,
        currentDraftVersionId: draft.id,
        updatedAt: now(),
      };
      if (input.preset && !nextDefinition.defaultPresetId) {
        nextDefinition.defaultPresetId = input.preset.id;
      }
      definitions.set(definition.id, nextDefinition);
      if (input.preset) {
        setPreset(input.preset);
      }
      return cloneVersion(draft);
    },

    updateDraftVersion(versionId, patch) {
      const existing = ensureVersion(versionId);
      if (existing.releaseStatus !== "draft") {
        throw new Error(`skill_version_draft_required: ${versionId}`);
      }
      const definition = ensureDefinition(existing.skillDefinitionId);
      if (patch.manifest && patch.manifest.identity.key !== definition.key) {
        throw new Error(
          `skill_manifest_identity_mismatch: ${patch.manifest.identity.key} !== ${definition.key}`,
        );
      }
      const next: SkillVersion = {
        ...existing,
        semver: patch.semver ?? existing.semver,
        manifest: patch.manifest
          ? JSON.parse(JSON.stringify(patch.manifest))
          : existing.manifest,
        changelog:
          patch.changelog === undefined ? existing.changelog : patch.changelog,
        sourceSnapshot:
          patch.sourceSnapshot === undefined
            ? existing.sourceSnapshot
            : patch.sourceSnapshot
              ? { ...patch.sourceSnapshot }
              : undefined,
      };
      versions.set(versionId, next);
      return cloneVersion(next);
    },

    getVersion(versionId) {
      const v = versions.get(versionId);
      return v ? cloneVersion(v) : null;
    },

    listVersions(query = {}) {
      const out: SkillVersion[] = [];
      for (const v of versions.values()) {
        if (query.definitionId && v.skillDefinitionId !== query.definitionId) continue;
        if (query.releaseStatus && v.releaseStatus !== query.releaseStatus) continue;
        if (query.reviewStatus && v.reviewStatus !== query.reviewStatus) continue;
        out.push(cloneVersion(v));
      }
      out.sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt));
      if (query.limit && query.limit > 0) return out.slice(0, query.limit);
      return out;
    },

    updateVersionReviewStatus(versionId, status, actor) {
      const existing = ensureVersion(versionId);
      if (existing.releaseStatus === "published" && status !== "approved") {
        throw new Error(`skill_version_review_locked: ${versionId} is published`);
      }
      const next: SkillVersion = { ...existing, reviewStatus: status, createdBy: existing.createdBy || actor };
      versions.set(versionId, next);
      return cloneVersion(next);
    },

    publishVersion(versionId, actor) {
      const existing = ensureVersion(versionId);
      if (existing.reviewStatus !== "approved") {
        throw new Error(`skill_version_not_approved: ${versionId}`);
      }
      const timestamp = now();
      const definition = ensureDefinition(existing.skillDefinitionId);
      const previouslyPublishedId = definition.currentPublishedVersionId;
      if (previouslyPublishedId && previouslyPublishedId !== versionId) {
        const prior = versions.get(previouslyPublishedId);
        if (prior) {
          versions.set(prior.id, { ...prior, releaseStatus: "deprecated" });
        }
      }
      const next: SkillVersion = {
        ...existing,
        releaseStatus: "published",
        publishedAt: timestamp,
        publishedBy: actor,
      };
      versions.set(versionId, next);
      definitions.set(definition.id, {
        ...definition,
        currentPublishedVersionId: versionId,
        currentDraftVersionId:
          definition.currentDraftVersionId === versionId
            ? undefined
            : definition.currentDraftVersionId,
        updatedAt: timestamp,
      });
      return cloneVersion(next);
    },

    deprecateVersion(versionId, actor) {
      const existing = ensureVersion(versionId);
      const definition = ensureDefinition(existing.skillDefinitionId);
      const next: SkillVersion = { ...existing, releaseStatus: "deprecated", publishedBy: actor };
      versions.set(versionId, next);
      if (definition.currentPublishedVersionId === versionId) {
        definitions.set(definition.id, {
          ...definition,
          currentPublishedVersionId: undefined,
          updatedAt: now(),
        });
      }
      return cloneVersion(next);
    },

    rollbackToVersion(definitionId, versionId, actor) {
      const definition = ensureDefinition(definitionId);
      const previouslyPublished = definition.currentPublishedVersionId;
      const target = ensureVersion(versionId);
      if (target.skillDefinitionId !== definitionId) {
        throw new Error(`skill_version_definition_mismatch: ${versionId} not in ${definitionId}`);
      }
      if (target.reviewStatus !== "approved") {
        throw new Error(`skill_version_not_approved: ${versionId}`);
      }
      if (previouslyPublished && previouslyPublished !== versionId) {
        const prior = versions.get(previouslyPublished);
        if (prior) {
          versions.set(prior.id, { ...prior, releaseStatus: "rolled_back" });
        }
      }
      const timestamp = now();
      const restored: SkillVersion = {
        ...target,
        releaseStatus: "published",
        publishedAt: timestamp,
        publishedBy: actor,
      };
      versions.set(versionId, restored);
      definitions.set(definition.id, {
        ...definition,
        currentPublishedVersionId: versionId,
        updatedAt: timestamp,
      });
      return cloneVersion(restored);
    },

    upsertPreset(preset) {
      return setPreset(preset);
    },

    getPreset(presetId) {
      const p = presets.get(presetId);
      return p ? clonePreset(p) : null;
    },

    listPresets(definitionId) {
      const out: SkillPreset[] = [];
      for (const p of presets.values()) {
        if (definitionId && p.skillDefinitionId !== definitionId) continue;
        out.push(clonePreset(p));
      }
      return out;
    },

    clear() {
      definitions.clear();
      versions.clear();
      presets.clear();
    },
  };
};
