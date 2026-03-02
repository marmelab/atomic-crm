/**
 * Export an array of row objects as a CSV file formatted for Italian locale:
 * - semicolon (;) as field separator
 * - comma (,) as decimal separator for numbers
 * - BOM prefix for Excel compatibility
 */
export function downloadCSVItalian(
  rows: Record<string, unknown>[],
  filename: string,
): void {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const formatValue = (val: unknown): string => {
    if (val == null || val === "") return "";
    if (typeof val === "number") {
      return val.toLocaleString("it-IT", {
        useGrouping: false,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    const str = String(val);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => formatValue(row[h])).join(";")),
  ];

  const BOM = "\uFEFF";
  const csv = csvRows.join("\n");
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
