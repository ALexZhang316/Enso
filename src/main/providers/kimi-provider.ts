import { OpenAiCompatibleProvider } from "./openai-compatible-provider";

export class KimiProvider extends OpenAiCompatibleProvider {
  constructor() {
    super({
      id: "kimi",
      label: "Kimi",
      scriptedEnvPrefix: "KIMI"
    });
  }
}
