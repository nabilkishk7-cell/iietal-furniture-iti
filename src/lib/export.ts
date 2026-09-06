import * as XLSX from "xlsx";

export type Signatory = { name: string; title: string };

export type ExportTable = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
  /** خانات التوقيع (لجنة الجرد) */
  signatures?: Signatory[];
  /** توقيع مدير الفرع */
  branchManager?: Signatory | null;
};


/** تصدير إلى ملف Excel (xlsx) */
export function exportExcel({ title, headers, rows, fileName }: ExportTable) {
  const aoa: (string | number)[][] = [[title], [], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيانات");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** تصدير إلى PDF عبر نافذة طباعة عربية صحيحة الاتجاه */
export function exportPdf({ title, subtitle, headers, rows }: ExportTable) {
  const esc = (v: string | number) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap">
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Cairo", sans-serif; color:#1a1416; margin:0; }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { font-size:12px; color:#6b5c60; margin:0 0 14px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { border:1px solid #d9c9cc; padding:5px 6px; text-align:right; }
  thead th { background:#b3243b; color:#fff; }
  tbody tr:nth-child(even) { background:#faf3f4; }
  .foot { margin-top:12px; font-size:10px; color:#6b5c60; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
  <table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>
  <p class="foot">معهد تكنولوجيا المعلومات — فرع المنوفية · تم الإنشاء في ${new Date().toLocaleString("ar-EG")}</p>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
