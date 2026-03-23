/**
 * 从源图片生成多尺寸 PNG 图标
 * 用于 Electron 窗口图标和聊天头像
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_PATH = path.join(ROOT, "resources", "enso-icon-source.png");
const OUT_DIR = path.join(ROOT, "resources");

const SIZES = [16, 32, 48, 64, 128, 256, 512];

for (const size of SIZES) {
  const outPath = path.join(OUT_DIR, `icon-${size}.png`);
  await sharp(SOURCE_PATH)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`生成: icon-${size}.png`);
}

// 聊天头像（48x48，圆形裁剪效果由前端 CSS 处理）
await sharp(SOURCE_PATH)
  .resize(48, 48)
  .png()
  .toFile(path.join(OUT_DIR, "avatar.png"));

console.log("生成: avatar.png");
console.log("图标生成完成。");
