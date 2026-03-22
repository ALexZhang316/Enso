import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // 全局忽略
  {
    ignores: ["dist/**", "node_modules/**", "tests/**", "scripts/**", "*.cjs", "*.mjs"]
  },
  // 基础 JS 推荐规则
  js.configs.recommended,
  // TypeScript 推荐规则
  ...tseslint.configs.recommended,
  // 关闭与 Prettier 冲突的规则
  eslintConfigPrettier,
  // 项目自定义规则
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // 允许显式 any（项目中有 better-sqlite3 行等合理场景）
      "@typescript-eslint/no-explicit-any": "off",
      // 允许未使用的变量以下划线开头
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // 主进程中有合理的 require() 使用（Electron safe storage 等）
      "@typescript-eslint/no-require-imports": "off",
      // shadcn/ui 组件使用空接口继承 HTML 属性
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
);
