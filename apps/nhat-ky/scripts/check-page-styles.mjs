import { chromium } from "playwright";

const url = process.argv[2] || "https://quanlysuco-road.vercel.app/nhat-ky";
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

const styles = await page.evaluate(() => {
  const card = document.querySelector(".nhatky-login-card");
  const h1 = document.querySelector(".nhatky-login h1");
  const body = document.body;
  function cs(el) {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      color: s.color,
      background: s.backgroundColor,
      height: el.offsetHeight,
      width: el.offsetWidth
    };
  }
  return { body: cs(body), card: cs(card), h1: cs(h1), rootChildren: document.getElementById("root")?.childElementCount };
});

console.log("STYLES:", JSON.stringify(styles, null, 2));
console.log("ERRORS:", errors.join("\n") || "(none)");

// Simulate logged-in: inject mock - can't easily

await browser.close();
