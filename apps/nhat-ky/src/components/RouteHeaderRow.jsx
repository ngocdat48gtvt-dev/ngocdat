/** Hàng tiêu đề nhánh khi gộp đường trên sổ. */
export default function RouteHeaderRow({ heading, colSpan, className = "" }) {
  if (!heading) return null;
  return (
    <tr className={`so-route-header-row ${className}`.trim()}>
      <td className="so-route-header-cell" colSpan={colSpan}>
        {heading}
      </td>
    </tr>
  );
}
