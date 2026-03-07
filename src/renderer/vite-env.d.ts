/// <reference types="vite/client" />

import type { EnsoBridge } from "@shared/bridge";

declare global {
  interface Window {
    enso: EnsoBridge;
  }
}

export {};
