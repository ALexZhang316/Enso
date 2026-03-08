import { ProviderError, TextGenerationProvider, TextGenerationRequest, TextGenerationResult } from "./types";

const ensureBaseUrl = (baseUrl: string): string => (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

const extractAssistantText = (payload: any): string => {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "";
};

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const message =
      (typeof payload?.error === "string" ? payload.error : payload?.error?.message) ??
      payload?.message ??
      payload?.error ??
      JSON.stringify(payload);
    return typeof message === "string" ? message : JSON.stringify(message);
  } catch {
    return await response.text();
  }
};

const toProviderError = async (response: Response): Promise<ProviderError> => {
  const details = (await readErrorBody(response)).trim() || "Kimi 请求失败。";

  if (response.status === 401 || response.status === 403) {
    return new ProviderError("auth", `Kimi 认证失败：${details}`);
  }

  if (response.status === 429) {
    return new ProviderError("rate_limit", `Kimi 触发限流：${details}`);
  }

  if (response.status >= 400 && response.status < 500) {
    return new ProviderError("invalid_request", `Kimi 请求无效：${details}`);
  }

  if (response.status >= 500) {
    return new ProviderError("server", `Kimi 服务异常：${details}`);
  }

  return new ProviderError("unknown", `Kimi 调用失败：${details}`);
};

export class KimiProvider implements TextGenerationProvider {
  readonly id = "kimi";

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const scriptedResponse = process.env.ENSO_TEST_KIMI_RESPONSE;
    const scriptedError = process.env.ENSO_TEST_KIMI_ERROR;
    if (scriptedError === "auth") {
      throw new ProviderError("auth", "Kimi 认证失败：测试环境模拟错误。");
    }
    if (scriptedError === "network") {
      throw new ProviderError("network", "Kimi 网络请求失败：测试环境模拟错误。");
    }
    if (scriptedError === "rate_limit") {
      throw new ProviderError("rate_limit", "Kimi 触发限流：测试环境模拟错误。");
    }
    if (scriptedResponse) {
      return { text: scriptedResponse };
    }

    try {
      const response = await fetch(new URL("chat/completions", ensureBaseUrl(request.baseUrl)), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages
        })
      });

      if (!response.ok) {
        throw await toProviderError(response);
      }

      const payload = await response.json();
      const text = extractAssistantText(payload);
      if (!text) {
        throw new ProviderError("unknown", "Kimi 返回了空响应。");
      }

      return { text };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError("network", `Kimi 网络请求失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
}
