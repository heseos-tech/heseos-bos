// Single source of truth for how Heseos BOS handles dates. Heseos operates in India, so all
// calendar dates are IST (Asia/Kolkata). Storage keeps full instants in ISO/UTC (precise), but
// the human-facing `date` field and every display are IST. Ported verbatim from MARG.

const IST = 'Asia/Kolkata';

// Current calendar date in IST as yyyy-mm-dd — use this for the stored `date` field.
export function istDateStr(d = new Date()) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: IST }); // en-CA → yyyy-mm-dd
}

function istDisplay(d) {
  return new Date(d).toLocaleDateString('en-GB', { timeZone: IST }).replace(/\//g, '-');
}

// Display formatter: dd-mm-yyyy, always IST for timestamps.
export function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return istDisplay(v);
  const s = String(v).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return istDisplay(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(v) : istDisplay(d);
}

// Display a full timestamp (date + time) in IST, e.g. "10 Aug 2026, 02:30 pm".
export function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: IST });
}
