import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ProviderId } from "../../shared/providers";

interface SecretFile {
  providers: Partial<Record<ProviderId, string>>;
}

let electronSafeStorage:
  | {
      isEncryptionAvailable: () => boolean;
      encryptString: (value: string) => Buffer;
      decryptString: (value: Buffer) => string;
    }
  | undefined;

try {
  const electronModule = require("electron") as { safeStorage?: typeof electronSafeStorage };
  electronSafeStorage = electronModule.safeStorage;
} catch {
  electronSafeStorage = undefined;
}

export class SecretService {
  constructor(private readonly secretPath: string) {}

  private get fallbackKeyPath(): string {
    return `${this.secretPath}.key`;
  }

  private ensureSecretFile(): void {
    fs.mkdirSync(path.dirname(this.secretPath), { recursive: true });
    if (!fs.existsSync(this.secretPath)) {
      const initial: SecretFile = { providers: {} };
      fs.writeFileSync(this.secretPath, JSON.stringify(initial, null, 2), "utf8");
    }
  }

  private readSecrets(): SecretFile {
    this.ensureSecretFile();

    try {
      const raw = fs.readFileSync(this.secretPath, "utf8");
      const parsed = JSON.parse(raw) as SecretFile;
      return {
        providers: parsed.providers ?? {}
      };
    } catch {
      return { providers: {} };
    }
  }

  private writeSecrets(secrets: SecretFile): void {
    this.ensureSecretFile();
    fs.writeFileSync(this.secretPath, JSON.stringify(secrets, null, 2), "utf8");
  }

  private getFallbackKey(): Buffer {
    fs.mkdirSync(path.dirname(this.fallbackKeyPath), { recursive: true });

    if (!fs.existsSync(this.fallbackKeyPath)) {
      fs.writeFileSync(this.fallbackKeyPath, crypto.randomBytes(32).toString("base64"), "utf8");
    }

    return Buffer.from(fs.readFileSync(this.fallbackKeyPath, "utf8"), "base64");
  }

  private encrypt(value: string): string {
    if (electronSafeStorage?.isEncryptionAvailable()) {
      return `safe:${electronSafeStorage.encryptString(value).toString("base64")}`;
    }

    const key = this.getFallbackKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `fallback:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  private decrypt(value: string): string | null {
    if (value.startsWith("safe:")) {
      if (!electronSafeStorage?.isEncryptionAvailable()) {
        return null;
      }

      try {
        return electronSafeStorage.decryptString(Buffer.from(value.slice(5), "base64"));
      } catch {
        return null;
      }
    }

    if (!value.startsWith("fallback:")) {
      return null;
    }

    const [, ivBase64, tagBase64, encryptedBase64] = value.split(":");
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
      return null;
    }

    try {
      const key = this.getFallbackKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
      decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedBase64, "base64")), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }

  saveProviderApiKey(providerId: ProviderId, apiKey: string): void {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      return;
    }

    const secrets = this.readSecrets();
    secrets.providers[providerId] = this.encrypt(trimmed);
    this.writeSecrets(secrets);
  }

  getProviderApiKey(providerId: ProviderId): string | null {
    const secrets = this.readSecrets();
    const encrypted = secrets.providers[providerId];
    if (!encrypted) {
      return null;
    }

    return this.decrypt(encrypted);
  }

  hasProviderApiKey(providerId: ProviderId): boolean {
    return Boolean(this.getProviderApiKey(providerId));
  }

  clearProviderApiKey(providerId: ProviderId): void {
    const secrets = this.readSecrets();
    delete secrets.providers[providerId];
    this.writeSecrets(secrets);
  }
}
