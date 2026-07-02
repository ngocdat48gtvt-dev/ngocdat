/**
 * Sau `npm run build`, copy dist vào website rồi chạy script này
 * để index.html dùng đường dẫn tuyệt đối (tránh lỗi /dashboard không có slash cuối).
 *
 * node scripts/patch-website-index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "website");

function patchIndex(portalDir, basePath) {
  const indexPath = path.join(root, portalDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn(`Skip ${portalDir}: không có index.html`);
    return;
  }
  let html = fs.readFileSync(indexPath, "utf8");
  html = html
    .replace(/href="\.\/assets\//g, `href="${basePath}/assets/`)
    .replace(/src="\.\/assets\//g, `src="${basePath}/assets/`)
    .replace(/src="\.\/firebase-config\.js"/g, `src="${basePath}/firebase-config.js"`);
  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`Patched ${portalDir}/index.html → ${basePath}/`);
}

patchIndex("dashboard", "/dashboard");
patchIndex("dieu-hanh", "/dieu-hanh");
