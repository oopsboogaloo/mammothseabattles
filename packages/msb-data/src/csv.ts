/**
 * A small CSV reader for the card files in data/cards (engineering design §7.2): quoted fields, doubled quotes, CRLF or LF.
 * Rows are returned as objects keyed by the header; blank rows are skipped.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (quoted) throw new Error('A quoted CSV field is never closed');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...body] = rows;
  const columns = header.map((h) => h.trim());
  return body
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(columns.map((h, i) => [h, (r[i] ?? '').trim()])));
}
