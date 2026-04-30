import { getRegistrySharedInstructions } from "./registry";

const shared = getRegistrySharedInstructions();

export const IMAGEN_GOLDEN_FORMULA = shared.imagenGoldenFormula;
export const SHARED_JSON_RULES = shared.jsonRules;
export const SHARED_INTERACTION_RULES = shared.interactionRules;
export const SHARED_CORE_PLANNING_BRAIN = shared.corePlanningBrain;
export const SHARED_DELIVERABLE_DECOMPOSITION_BRAIN =
  shared.deliverableDecompositionBrain;
export const SHARED_PLANNING_SELF_CHECK_BRAIN = shared.planningSelfCheckBrain;
export const SHARED_UNIFIED_AGENT_BRAIN = shared.unifiedAgentBrain;
