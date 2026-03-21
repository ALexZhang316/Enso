import { ProviderError } from "./types";

export const ensureBaseUrl = (baseUrl: string): string => (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

const extractMessage = (payload: unknown): string | null => {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    return extractMessage(record.error);
  }

  return null;
};

export const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    const message = extractMessage(payload);
    return message?.trim() || JSON.stringify(payload);
  } catch {
    return (await response.text()).trim();
  }
};

export const toProviderError = async (providerLabel: string, response: Response): Promise<ProviderError> => {
  const details = (await readErrorBody(response)) || `${providerLabel} request failed.`;
  const normalized = details.toLowerCase();
  const looksLikeAuthIssue =
    normalized.includes("api key") ||
    normalized.includes("authentication") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid key") ||
    normalized.includes("permission");

  if (response.status === 401 || response.status === 403 || (response.status === 400 && looksLikeAuthIssue)) {
    return new ProviderError("auth", `${providerLabel} authentication failed: ${details}`);
  }

  if (response.status === 429) {
    return new ProviderError("rate_limit", `${providerLabel} rate limit hit: ${details}`);
  }

  if (response.status >= 400 && response.status < 500) {
    return new ProviderError("invalid_request", `${providerLabel} request was invalid: ${details}`);
  }

  if (response.status >= 500) {
    return new ProviderError("server", `${providerLabel} service error: ${details}`);
  }

  return new ProviderError("unknown", `${providerLabel} request failed: ${details}`);
};

export const toNetworkError = (providerLabel: string, error: unknown): ProviderError => {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError(
    "network",
    `${providerLabel} network request failed: ${error instanceof Error ? error.message : "unknown error"}`
  );
};

export const extractTextFromParts = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (!part || typeof part !== "object") {
        return "";
      }

      const record = part as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }

      if (record.text && typeof record.text === "object") {
        const nested = record.text as Record<string, unknown>;
        if (typeof nested.value === "string") {
          return nested.value;
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};
