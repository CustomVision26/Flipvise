/** Escape a CSV cell and neutralize spreadsheet formula injection. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const neutralized =
    raw.length > 0 && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\n");
}
