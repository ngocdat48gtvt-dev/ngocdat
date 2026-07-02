import { chromium } from "playwright";

const url = process.argv[2] || "https://quanlysuco-road.vercel.app/nhat-ky";
const logs = [];
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => errors.push(String(err)));

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  const root = await page.$eval("#root", (el) => ({
    childCount: el.childElementCount,
    html: el.innerHTML.slice(0, 500),
    text: el.innerText.slice(0, 200)
  }));
  console.log("ROOT:", JSON.stringify(root, null, 2));
} catch (e) {
  console.log("GOTO_ERR:", e.message);
}

console.log("PAGE_ERRORS:", errors.length ? errors.join("\n") : "(none)");
console.log("CONSOLE:", logs.slice(0, 20).join("\n") || "(none)");
await browser.close();
