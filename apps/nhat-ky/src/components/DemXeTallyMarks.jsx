import { parseCount } from "../utils/demXeCompute";

/** Mỗi ô vuông tối đa 5 gạch (4 cạnh + 1 chéo). Mỗi hàng tối đa 15 ô. */
export const TALLY_PER_BOX = 5;
export const TALLY_BOXES_PER_ROW = 15;

/**
 * Thứ tự gạch trong ô (kiểu đếm thủ công):
 * 1 trái · 2 trên · 3 phải · 4 dưới · 5 chéo
 */
function TallyBox({ marks }) {
  const n = Math.max(0, Math.min(TALLY_PER_BOX, Number(marks) || 0));
  return (
    <svg
      className="demxe-tally-box"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden
    >
      {n >= 1 && <line x1="3" y1="3" x2="3" y2="17" />}
      {n >= 2 && <line x1="3" y1="3" x2="17" y2="3" />}
      {n >= 3 && <line x1="17" y1="3" x2="17" y2="17" />}
      {n >= 4 && <line x1="3" y1="17" x2="17" y2="17" />}
      {n >= 5 && <line x1="3" y1="3" x2="17" y2="17" />}
    </svg>
  );
}

function buildBoxMarks(total) {
  const n = Math.max(0, Math.floor(total));
  if (n <= 0) return [];
  const boxes = [];
  let left = n;
  while (left > 0) {
    const m = Math.min(TALLY_PER_BOX, left);
    boxes.push(m);
    left -= m;
  }
  return boxes;
}

function chunkRows(boxes, perRow = TALLY_BOXES_PER_ROW) {
  const rows = [];
  for (let i = 0; i < boxes.length; i += perRow) {
    rows.push(boxes.slice(i, i + perRow));
  }
  return rows;
}

/** Hiển thị số liệu đếm bằng ô vuông gạch (5 xe / ô). */
export default function DemXeTallyMarks({ count }) {
  const n = parseCount(count);
  if (n <= 0) return null;

  const boxes = buildBoxMarks(n);
  const rows = chunkRows(boxes);

  return (
    <div className="demxe-tally" aria-hidden>
      {rows.map((row, ri) => (
        <div key={ri} className="demxe-tally-row">
          {row.map((marks, bi) => (
            <TallyBox key={`${ri}-${bi}`} marks={marks} />
          ))}
        </div>
      ))}
    </div>
  );
}
