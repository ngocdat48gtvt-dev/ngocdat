export const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const VI_MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12"
];

export function isoToParts(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function partsToIso(y, m, d) {
  if (!y || !m || !d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isoToDisplay(iso) {
  const p = isoToParts(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

export function yearMonthToDisplay(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return "";
  const [y, m] = yearMonth.split("-").map(Number);
  return `${VI_MONTHS[m - 1]}/${y}`;
}

export function todayIso() {
  const d = new Date();
  return partsToIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse dd/mm/yyyy hoặc d/m/yyyy → ISO */
export function displayToIso(text) {
  const m = String(text || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = partsToIso(y, mo, d);
  const check = isoToParts(iso);
  if (!check || check.d !== d || check.m !== mo) return null;
  return iso;
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function compareIso(a, b) {
  if (!a || !b) return 0;
  return a.localeCompare(b);
}

export function calendarCells(y, m) {
  const first = new Date(y, m - 1, 1);
  const startPad = first.getDay();
  const total = daysInMonth(y, m);
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
