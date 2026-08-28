// ─────────────────────────────────────────────────────────────────────────────
// Canonical lead lifecycle — ONE source of truth for stages across the whole system
// (employee dashboard, partner portal, and anywhere a lead's progress is shown).
// Adapted from MARG's lib/leadStage.js for Heseos's home-automation sales journey:
//
//   New Lead → Demo Scheduled → Converted
//
// Rejected is a terminal branch that can occur from any stage. Within "Demo Scheduled", the
// sales engineer can log an outcome that doesn't end the lead (Out of Station / Future Demo
// Requested) — these are annotations on the stage (a reschedule is needed), not new stages.
//
// Every stage/sub-stage transition is timestamped (contactStageAt, demoScheduledAt,
// demoOutcomeAt, convertedAt, rejectedAt) — matching MARG's "timestamp of every stage".
// ─────────────────────────────────────────────────────────────────────────────

export const LEAD_STAGES = ['New Lead', 'Demo Scheduled', 'Converted'];

export const STAGE_COLOR = {
  'New Lead':       { c: '#6B7E96', bg: '#F1F5F9' },
  'Demo Scheduled': { c: '#0EA5E9', bg: '#E0F2FE' },
  'Converted':      { c: '#16A34A', bg: '#DCFCE7' },
  'Rejected':       { c: '#C0392B', bg: '#FEE2E2' },
};

// ── Pre-demo "work the lead" funnel ────────────────────────────────────────
// What the pre-sales / lead-nurturing team logs BEFORE a demo is scheduled. These are
// sub-states of the New Lead stage; once a demo is scheduled the lead advances to
// "Demo Scheduled" and these no longer apply. Stored on the lead as `contactStage`
// (+ contactStageAt/By, followUpAt, contactNote).
export const CONTACT_STAGES = [
  { key: 'call_not_picked', label: 'Call Not Picked',     c: '#B7791F', bg: '#FEF3C7' },
  { key: 'not_interested',  label: 'Not Interested',      c: '#C0392B', bg: '#FEE2E2' },
  { key: 'follow_up',       label: 'Follow-up Later',     c: '#7C3AED', bg: '#EDE9FE' },
  { key: 'qualified',       label: 'Qualified for Demo',  c: '#0EA5E9', bg: '#E0F2FE' },
];
export const CONTACT_LABEL = Object.fromEntries(CONTACT_STAGES.map(s => [s.key, s.label]));
export const CONTACT_COLOR = Object.fromEntries(CONTACT_STAGES.map(s => [s.key, { c: s.c, bg: s.bg }]));

// The lead's current contact-stage while it's still pre-demo. Returns null once a demo has
// been scheduled (we're past the nurture funnel by then).
export function contactStageOf(l = {}) {
  if (l.demoScheduledAt) return null;
  const s = l.contactStage;
  return CONTACT_LABEL[s] ? s : null;
}

// ── Post-scheduling demo outcome ───────────────────────────────────────────
// What the sales engineer logs once the demo visit has been attempted. Stored on the lead as
// `demoOutcome` (+ demoOutcomeAt/By, demoOutcomeNote). Two of the five outcomes are terminal
// (dead); two mean the visit didn't happen and a new demo needs to be scheduled; one converts.
export const DEMO_OUTCOMES = [
  { key: 'rejected_before_demo',     label: 'Rejected Before Demo',    c: '#C0392B', bg: '#FEE2E2', kind: 'dead' },
  { key: 'out_of_station',           label: 'Customer Out of Station', c: '#B7791F', bg: '#FEF3C7', kind: 'reschedule' },
  { key: 'future_demo',              label: 'Future Demo Requested',   c: '#7C3AED', bg: '#EDE9FE', kind: 'reschedule' },
  { key: 'not_interested_after_demo', label: 'Not Interested (After Demo)', c: '#C0392B', bg: '#FEE2E2', kind: 'dead' },
  { key: 'converted',                label: 'Converted',               c: '#16A34A', bg: '#DCFCE7', kind: 'won' },
];
export const DEMO_OUTCOME_LABEL = Object.fromEntries(DEMO_OUTCOMES.map(s => [s.key, s.label]));
export const DEMO_OUTCOME_COLOR = Object.fromEntries(DEMO_OUTCOMES.map(s => [s.key, { c: s.c, bg: s.bg }]));
export const DEMO_OUTCOME_KIND = Object.fromEntries(DEMO_OUTCOMES.map(s => [s.key, s.kind]));

// A lead the customer declined, at any point — excluded from active counts.
export function isDeadLead(l = {}) {
  const cs = contactStageOf(l);
  if (cs === 'not_interested') return true;
  return DEMO_OUTCOME_KIND[l.demoOutcome] === 'dead';
}
// A lead parked for a future follow-up (pre-sales' own scheduling — needs a call-back).
export function isFollowUpLead(l = {}) { return contactStageOf(l) === 'follow_up'; }
// A demo that was scheduled but didn't happen — needs a NEW date/time.
export function needsReschedule(l = {}) { return DEMO_OUTCOME_KIND[l.demoOutcome] === 'reschedule'; }

// Map a lead's raw fields → its canonical stage.
export function stageOf(l = {}) {
  if (l.demoOutcome === 'converted') return 'Converted';
  if (DEMO_OUTCOME_KIND[l.demoOutcome] === 'dead') return 'Rejected';
  if (contactStageOf(l) === 'not_interested') return 'Rejected';
  if (l.demoScheduledAt) return 'Demo Scheduled';
  return 'New Lead';
}

// Position on the linear track (0..2). Rejected returns -1 (off-track / terminal).
export function stageIndex(l = {}) {
  const st = stageOf(l);
  return st === 'Rejected' ? -1 : LEAD_STAGES.indexOf(st);
}

// The label + colours to show in a STATUS column. A pre-demo lead reflects the pre-sales
// contact-funnel outcome; a scheduled lead awaiting/after a demo reflects the demo outcome;
// everything else falls back to the canonical stage.
export function displayStatus(l = {}) {
  const cs = contactStageOf(l);
  if (cs && CONTACT_LABEL[cs] && cs !== 'qualified') return { key: cs, label: CONTACT_LABEL[cs], ...CONTACT_COLOR[cs] };
  if (l.demoOutcome && needsReschedule(l)) return { key: l.demoOutcome, label: DEMO_OUTCOME_LABEL[l.demoOutcome], ...DEMO_OUTCOME_COLOR[l.demoOutcome] };
  const st = stageOf(l);
  return { key: st, label: st, ...(STAGE_COLOR[st] || STAGE_COLOR['New Lead']) };
}

// A sub-update overlay shown alongside the stage — e.g. "Needs reschedule" after Out of
// Station / Future Demo Requested. Mirrors MARG's on-hold / docs-pending overlay: it doesn't
// move the lead off "Demo Scheduled", it just flags that attention is needed.
export function subUpdateOf(l = {}) {
  if (needsReschedule(l)) return { label: DEMO_OUTCOME_LABEL[l.demoOutcome] + ' — needs reschedule', note: l.demoOutcomeNote || '' };
  return null;
}

// Append a timestamped entry to the lead's audit trail. Every stage/sub-stage transition
// should call this so the full history (who did what, when) is always reconstructable —
// this is the "timestamp of every stage" requirement.
export function pushHistory(lead, entry) {
  const history = Array.isArray(lead.history) ? lead.history.slice() : [];
  history.push({ at: new Date().toISOString(), ...entry });
  return history;
}
