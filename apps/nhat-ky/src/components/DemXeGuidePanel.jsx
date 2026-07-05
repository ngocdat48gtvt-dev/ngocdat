import { DEMXE_GUIDE_SECTIONS } from "../utils/demXeConstants";

export default function DemXeGuidePanel() {
  return (
    <div className="demxe-sheet demxe-sheet--guide demxe-print-section" data-print-section="guide">
      <h2 className="demxe-guide-title">Hướng dẫn ghi sổ đếm xe</h2>
      <p className="demxe-guide-intro">
        Phụ lục số 03 — Căn cứ Thông tư 41/2024/TT-BGTVT và TCVN 14182:2024 Bảo dưỡng thường xuyên đường bộ.
      </p>
      {DEMXE_GUIDE_SECTIONS.map((s) => (
        <section key={s.title} className="demxe-guide-block">
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </section>
      ))}
    </div>
  );
}
