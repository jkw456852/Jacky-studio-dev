import { getRegistrySystemPrompt } from './prompts/registry.ts';
import { STARTUP_PACK } from './prompts/packs/startup.pack.ts';
import { P0_PACK } from './prompts/packs/p0.pack.ts';
import { P1_PACK } from './prompts/packs/p1.pack.ts';
import { P2_PACK } from './prompts/packs/p2.pack.ts';
import { P3_PACK } from './prompts/packs/p3.pack.ts';
import { P4_PACK } from './prompts/packs/p4.pack.ts';
import { P5_PACK } from './prompts/packs/p5.pack.ts';

export type JkaiPackName =
  | 'STARTUP_PACK'
  | 'P0_PACK'
  | 'P1_PACK'
  | 'P2_PACK'
  | 'P3_PACK'
  | 'P4_PACK'
  | 'P5_PACK';

type AgentRegistryEntry = {
  readonly core: string;
  readonly packs: Record<JkaiPackName, string>;
};

const jkaiOneclickPacks: Record<JkaiPackName, string> = {
  STARTUP_PACK,
  P0_PACK,
  P1_PACK,
  P2_PACK,
  P3_PACK,
  P4_PACK,
  P5_PACK,
};

const createOneclickRegistryEntry = (): AgentRegistryEntry => ({
  get core() {
    return getRegistrySystemPrompt('skysper-core');
  },
  packs: jkaiOneclickPacks,
});

export const AgentRegistry = {
  'jkai-oneclick': createOneclickRegistryEntry(),
  'xcai-oneclick': createOneclickRegistryEntry(),
};

export type AgentRegistryId = keyof typeof AgentRegistry;
