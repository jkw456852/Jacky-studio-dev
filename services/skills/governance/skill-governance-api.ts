import type {
  SkillDefinition,
  SkillPreset,
  SkillVersion,
} from "../catalog/skill-object-types.ts";
import type {
  SkillCatalogStore,
  SkillDraftInput,
  SkillVersionQuery,
  UpdateDraftSkillVersionPatch,
} from "../catalog/store/skill-catalog-store.ts";
import type {
  SkillAuditQuery,
  SkillAuditRecord,
  SkillGovernanceActor,
  SkillGovernanceService,
  SkillReviewDecision,
} from "./skill-governance.ts";

export interface CreateSkillGovernanceApiArgs {
  catalog: SkillCatalogStore;
  governance: SkillGovernanceService;
}

export interface SkillGovernanceApi {
  listDefinitions(): SkillDefinition[];
  getDefinition(definitionId: string): SkillDefinition | null;
  listVersions(
    definitionId?: string,
    query?: Omit<SkillVersionQuery, "definitionId">,
  ): SkillVersion[];
  getVersion(versionId: string): SkillVersion | null;
  listPresets(definitionId?: string): SkillPreset[];
  getPreset(presetId: string): SkillPreset | null;
  createDraft(args: {
    actor: SkillGovernanceActor;
    input: SkillDraftInput;
    reason: string;
  }): SkillVersion;
  updateDraft(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    patch: UpdateDraftSkillVersionPatch;
    reason: string;
  }): SkillVersion;
  submitReview(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  review(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    decision: SkillReviewDecision;
    reason: string;
  }): SkillVersion;
  publish(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  deprecate(args: {
    actor: SkillGovernanceActor;
    versionId: string;
    reason: string;
  }): SkillVersion;
  rollback(args: {
    actor: SkillGovernanceActor;
    definitionId: string;
    versionId: string;
    reason: string;
  }): SkillVersion;
  listAudits(query?: SkillAuditQuery): SkillAuditRecord[];
}

export const createSkillGovernanceApi = ({
  catalog,
  governance,
}: CreateSkillGovernanceApiArgs): SkillGovernanceApi => ({
  listDefinitions() {
    return catalog.listDefinitions();
  },

  getDefinition(definitionId) {
    return catalog.getDefinition(definitionId);
  },

  listVersions(definitionId, query = {}) {
    return catalog.listVersions({
      ...query,
      definitionId,
    });
  },

  getVersion(versionId) {
    return catalog.getVersion(versionId);
  },

  listPresets(definitionId) {
    return catalog.listPresets(definitionId);
  },

  getPreset(presetId) {
    return catalog.getPreset(presetId);
  },

  createDraft(args) {
    return governance.createDraft(args);
  },

  updateDraft(args) {
    return governance.updateDraftVersion(args);
  },

  submitReview(args) {
    return governance.submitVersionForReview(args);
  },

  review(args) {
    return governance.reviewVersion(args);
  },

  publish(args) {
    return governance.publishVersion(args);
  },

  deprecate(args) {
    return governance.deprecateVersion(args);
  },

  rollback(args) {
    return governance.rollbackVersion(args);
  },

  listAudits(query = {}) {
    return governance.listAuditRecords(query);
  },
});
