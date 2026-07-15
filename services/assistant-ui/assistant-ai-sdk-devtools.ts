import {
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";

type AssistantLanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];
type AssistantAiSdkDevToolsEnvironment = {
  [key: string]: string | undefined;
  AI_SDK_DEVTOOLS?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};
type AssistantAiSdkDevToolsModule = {
  devToolsMiddleware: () => LanguageModelMiddleware;
};

const isExplicitlyDisabled = (value: string | undefined): boolean =>
  value === "0" || value?.toLowerCase() === "false" || value?.toLowerCase() === "off";

export const shouldEnableAssistantAiSdkDevTools = (
  env: AssistantAiSdkDevToolsEnvironment = process.env,
): boolean =>
  env.NODE_ENV !== "production" &&
  env.VERCEL_ENV !== "production" &&
  !isExplicitlyDisabled(env.AI_SDK_DEVTOOLS);

export const wrapAssistantLanguageModelWithDevTools = async (
  model: AssistantLanguageModel,
  options: {
    env?: AssistantAiSdkDevToolsEnvironment;
    loadDevTools?: () => Promise<AssistantAiSdkDevToolsModule>;
  } = {},
): Promise<{ model: AssistantLanguageModel; enabled: boolean }> => {
  if (!shouldEnableAssistantAiSdkDevTools(options.env)) {
    return { model, enabled: false };
  }

  const loadDevTools =
    options.loadDevTools ?? (() => import("@ai-sdk/devtools"));
  const { devToolsMiddleware } = await loadDevTools();

  return {
    model: wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    }),
    enabled: true,
  };
};
