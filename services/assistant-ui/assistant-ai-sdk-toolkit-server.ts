type AssistantAiSdkToolkit = {
  tools(options?: {
    frontend?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};

type AssistantAiSdkToolkitConstructor = new (options: {
  toolkit: Record<string, unknown>;
}) => AssistantAiSdkToolkit;

let assistantAiSdkToolkitConstructorPromise:
  | Promise<AssistantAiSdkToolkitConstructor>
  | null = null;

const loadOfficialAiSdkToolkit = async () => {
  // Keep this lazy so the Vite API worker only resolves assistant-ui's server
  // toolkit when a chat request actually needs it, while still staying on the
  // documented public package surface.
  const module = (await import("@assistant-ui/react-ai-sdk")) as {
    AISDKToolkit: AssistantAiSdkToolkitConstructor;
  };

  return module.AISDKToolkit;
};

export const createAssistantAiSdkToolkit = async (
  toolkit: Record<string, unknown>,
) => {
  assistantAiSdkToolkitConstructorPromise ??= loadOfficialAiSdkToolkit();
  const AISDKToolkit = await assistantAiSdkToolkitConstructorPromise;
  return new AISDKToolkit({ toolkit });
};
