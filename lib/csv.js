// lib/csv.js — small dependency-free CSV read/write helpers (RFC4180-ish: quoted fields,
// escaped quotes as "", commas and newlines inside quotes). No library needed for the shapes
// this app actually produces/consumes (a flat table of scalar values) — first user is
// components/admin/ProductsPage.jsx's bulk import / template export.

export function toCsv(rows, columns) {
  // columns: [{ key, label }]. Always quotes every field — simplest way to be unambiguously
  // correct for a value that might contain a comma, quote or newline (a product description,
  // say), at the cost of a few harmless extra quote characters on plain values.
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Parses CSV text into an array of plain objects keyed by the (lowercased) header row —
// handles quoted fields (RFC4180: "" inside a quoted field is a literal quote, and a quoted
// field can contain commas/newlines). Blank lines are skipped. Header matching is
// case-insensitive and trimmed, so a template edited by hand in Excel/Sheets still matches.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushField();
      pushRow();
    } else if (c === '\r') {
      // ignore — a \r\n line ending is handled by the \n that follows
    } else {
      field += c;
    }
  }
  // Final field/row if the file doesn't end with a trailing newline.
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }

  const nonEmpty = rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => String(h).trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ''; });
    return obj;
  });
}
