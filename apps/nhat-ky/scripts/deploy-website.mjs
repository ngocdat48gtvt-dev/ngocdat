import { cpSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const target = join(root, "..", "website", "nhat-ky");

console.log("Building với base /nhat-ky/ …");
const build = spawnSync("npx", ["vite", "build"], {
  cwd: root,
  env: { ...process.env, VITE_DEPLOY_BASE: "/nhat-ky/" },
  shell: true,
  stdio: "inherit"
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(dist)) {
  console.error("Build xong nhưng không thấy dist/");
  process.exit(1);
}

if (existsSync(join(target, "assets"))) {
  rmSync(join(target, "assets"), { recursive: true, force: true });
}

cpSync(join(dist, "index.html"), join(target, "index.html"));
cpSync(join(dist, "assets"), join(target, "assets"), { recursive: true });
if (existsSync(join(dist, "favicon.svg"))) {
  cpSync(join(dist, "favicon.svg"), join(target, "favicon.svg"));
}
const publicFirebase = join(root, "public", "firebase-config.js");
if (existsSync(publicFirebase)) {
  cpSync(publicFirebase, join(target, "firebase-config.js"));
}

console.log("Đã copy dist → website/nhat-ky/");
console.log("Hard refresh trình duyệt (Ctrl+F5). Nếu dùng Vercel: push git rồi đợi deploy.");
