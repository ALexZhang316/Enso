import { OpenAiCompatibleProvider } from "./openai-compatible-provider";

export class DeepSeekProvider extends OpenAiCompatibleProvider {
  constructor() {
    super({
      id: "deepseek",
      label: "DeepSeek"
    });
  }
}
