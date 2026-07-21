import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const websiteRoot = join(root, '..', 'website')

function patchIndex(targetDir, basePath) {
  const indexPath = join(targetDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.warn(`Skip ${targetDir}: không có index.html`)
    return
  }
  let html = readFileSync(indexPath, 'utf8')
  html = html
    .replace(/href="\.\/assets\//g, `href="${basePath}/assets/`)
    .replace(/src="\.\/assets\//g, `src="${basePath}/assets/`)
    .replace(/src="\.\/firebase-config\.js"/g, `src="${basePath}/firebase-config.js"`)
  writeFileSync(indexPath, html, 'utf8')
  console.log(`Patched ${targetDir} → ${basePath}/`)
}

function deployFolder(portalDir, basePath) {
  const target = join(websiteRoot, portalDir)
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  cpSync(dist, target, { recursive: true })
  patchIndex(target, basePath)
}

console.log('Building dieu-hanh…')
const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  shell: true,
  stdio: 'inherit',
})

if (build.status !== 0) process.exit(build.status ?? 1)
if (!existsSync(dist)) {
  console.error('Build xong nhưng không thấy dist/')
  process.exit(1)
}

deployFolder('dashboard', '/dashboard')
deployFolder('dieu-hanh', '/dieu-hanh')

console.log('')
console.log('Đã copy dist → apps/website/dashboard và apps/website/dieu-hanh')
console.log('Tiếp theo (tự chạy):')
console.log('  cd G:\\QuanLySuCo-Old\\apps\\website')
console.log('  git add dieu-hanh dashboard')
console.log('  git commit -m "Deploy web điều hành"')
console.log('  git push origin main')
