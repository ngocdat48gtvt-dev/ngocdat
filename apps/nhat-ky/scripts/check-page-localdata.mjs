import { chromium } from "playwright";

const url = process.argv[2] || "https://quanlysuco-road.vercel.app/nhat-ky";
const errors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", (err) => errors.push(String(err)));

// Giả lập đã đăng nhập + có dữ liệu local (không qua Firebase)
await context.addInitScript(() => {
  const badData = {
    entries: [
      {
        section: "Tai nạn giao thông",
        date: "2026-06-01",
        type: "Va chạm",
        kmFrom: "1+000",
        side: "P",
        exportTngt: true,
        tngtCauseDetail: "test",
        vehicleAuto: 2,
        vehicleMoto: 1,
        tngtCauseCategory: "nguoi"
      }
    ],
    dayMeta: {},
    reportMeta: {}
  };
  localStorage.setItem("nhatky_testuid_road1", JSON.stringify(badData));
  localStorage.setItem("nhatky_roads_testuid", JSON.stringify({
    activeRoadId: "road1",
    roads: [{
      id: "road1",
      roadName: "QL.37",
      hat: "1.37",
      kmFrom: "356+700",
      kmTo: "404+000",
      company: "CTY"
    }]
  }));
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

const root = await page.$eval("#root", (el) => ({
  childCount: el.childElementCount,
  text: el.innerText.slice(0, 300),
  html: el.innerHTML.slice(0, 400)
}));

console.log("ROOT:", JSON.stringify(root, null, 2));
console.log("ERRORS:", errors.join("\n") || "(none)");
await browser.close();
