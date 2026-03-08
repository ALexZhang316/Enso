import { ProviderId } from "../../shared/providers";
import { KimiProvider } from "./kimi-provider";
import { ProviderError, TextGenerationProvider } from "./types";

const kimiProvider = new KimiProvider();

export const createTextGenerationProvider = (providerId: ProviderId): TextGenerationProvider => {
  if (providerId === "kimi") {
    return kimiProvider;
  }

  throw new ProviderError("invalid_request", `当前构建未实现 provider：${providerId}`);
};
