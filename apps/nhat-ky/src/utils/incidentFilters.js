export function parseViDate(s) {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || "").trim());
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return null;
}

function matchesDateRangeForField(dateStr, from, to, requireDateWhenFiltering) {
  if (!from && !to) return true;
  const d = dateStr?.trim() ? parseViDate(dateStr) : null;
  if (!d) return !requireDateWhenFiltering;
  if (from) {
    const fromD = parseViDate(from);
    if (fromD && d < fromD) return false;
  }
  if (to) {
    const toD = parseViDate(to);
    if (toD) {
      const end = new Date(toD);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
  }
  return true;
}

export function matchesDateRange(inc, from, to) {
  return matchesDateRangeForField(inc.date, from, to, false);
}

export function matchesCompletedDateRange(inc, from, to) {
  return matchesDateRangeForField(inc.completedDate, from, to, true);
}
