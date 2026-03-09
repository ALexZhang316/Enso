import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root") as HTMLElement;

function mount(): void {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

function renderBridgeError(): void {
  rootElement.innerHTML = `
    <div style="display:flex;height:100%;align-items:center;justify-content:center;padding:24px;background:#f2f2f7;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:480px;border-radius:20px;background:white;padding:24px;box-shadow:0 12px 30px rgba(0,0,0,0.08);">
        <div style="font-size:20px;font-weight:600;margin-bottom:8px;">未检测到 Enso 主进程桥接</div>
        <div style="font-size:14px;line-height:1.6;color:#6e6e73;">
          当前页面没有连接到 Electron preload。请从桌面版 Enso 启动，而不是直接在浏览器里打开构建产物。
        </div>
      </div>
    </div>
  `;
}

const shouldUseBrowserMock =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_BROWSER_MOCK === "true" &&
  !window.enso;

if (shouldUseBrowserMock) {
  import("./browser-mock").then(({ mockBridge }) => {
    (window as unknown as { enso: typeof mockBridge }).enso = mockBridge;
    mount();
  });
} else if (!window.enso) {
  renderBridgeError();
} else {
  mount();
}
