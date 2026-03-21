import { OpenAiCompatibleProvider } from "./openai-compatible-provider";

const prepareMessages = (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) =>
  messages.map((message) => ({
    role: message.role === "system" ? "developer" : message.role,
    content: message.content
  }));

export class OpenAIProvider extends OpenAiCompatibleProvider {
  constructor() {
    super({
      id: "openai",
      label: "OpenAI",
      prepareMessages
    });
  }
}
