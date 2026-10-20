'use client';
// The Heseos Bot console's Inbox — the "MARG-like WhatsApp inbox" ask. Conversation list (with
// search + status tabs) + chat thread (bot on/off, Template, Open/Resolved) + a contact info
// panel with an Assign action, mirroring the reference screenshots. Talks to
// app/api/bot/chats*, scoped to the signed-in tenant via the heseos_bot_tenant cookie.
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { fmtDate } from '@/lib/date';
import { Avatar, fmtTime } from './ui';
import { IconSearch, IconSend } from './icons';
import { renderTemplate } from '@/lib/botTemplates';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_agent', label: 'Needs Agent' },
  { key: 'unread', label: 'Unread' },
  { key: 'resolved', label: 'Resolved' },
];

export default function InboxScreen({ tenant }) {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const bottomRef = useRef(null);

  // Template picker (the "Template" pill): lists approved templates, collects their variables,
  // previews the result and sends it — the only way to message a customer whose 24h window closed.
  const [tplOpen, setTplOpen] = useState(false);
  const [tplList, setTplList] = useState(null);
  const [tplNote, setTplNote] = useState('');
  const [tplCtx, setTplCtx] = useState(null); // { orderId, firstName, blocked } for the open chat
  const [tplChat, setTplChat] = useState(null); // chat the cached template list was loaded for
  const [tplSel, setTplSel] = useState(null);
  const [tplParams, setTplParams] = useState([]);
  const [tplSending, setTplSending] = useState(false);
  const [tplError, setTplError] = useState('');

  const fetchChats = useCallback(async () => {
    const res = await fetch('/api/bot/chats');
    if (res.ok) {
      const data = await res.json();
      setChats(data);
      setActiveId((prev) => prev || (data[0] && data[0].id) || null);
    }
  }, []);

  const fetchMessages = useCallback(async (id) => {
    if (!id) return;
    const res = await fetch(`/api/bot/chats/${encodeURIComponent(id)}/messages`);
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => {
    fetchChats();
    const t = setInterval(fetchChats, 15000);
    return () => clearInterval(t);
  }, [fetchChats]);

  useEffect(() => {
    if (!activeId) return;
    fetchMessages(activeId);
    fetch(`/api/bot/chats/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markRead: true }),
    }).then(fetchChats);
    const t = setInterval(() => fetchMessages(activeId), 8000);
    return () => clearInterval(t);
  }, [activeId, fetchMessages, fetchChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function patchActive(patch) {
    if (!activeId) return;
    await fetch(`/api/bot/chats/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    fetchChats();
  }

  async function send() {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/bot/chats/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      if (res.ok) { setText(''); fetchMessages(activeId); fetchChats(); }
    } finally {
      setSending(false);
    }
  }

  async function openTemplates() {
    setTplOpen(true); setTplSel(null); setTplError('');
    if (tplList && tplChat === activeId) return;
    try {
      const res = await fetch(`/api/bot/templates?chat=${encodeURIComponent(activeId || '')}`);
      const d = res.ok ? await res.json() : { templates: [] };
      setTplList(d.templates || []);
      setTplNote(d.note || '');
      setTplCtx(d.context || null);
      setTplChat(activeId);
    } catch { setTplList([]); setTplNote('Could not load templates.'); }
  }

  function pickTemplate(t) {
    const first = String(active?.name || '').trim().split(/\s+/)[0];
    const looksLikeName = first && !/^\d+$/.test(first);
    setTplSel(t);
    setTplError('');
    setTplParams(Array.from({ length: t.params }, (_, i) => {
      if (t.bookingButton && tplCtx) { if (i === 0) return tplCtx.firstName || (looksLikeName ? first : ''); if (i === 1) return tplCtx.orderId || ''; }
      return i === 0 && looksLikeName ? first : '';
    }));
  }

  async function sendTemplate() {
    if (!tplSel || !activeId) return;
    setTplSending(true); setTplError('');
    try {
      const res = await fetch(`/api/bot/chats/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: { name: tplSel.name, language: tplSel.language, body: tplSel.body, params: tplParams, ...(tplSel.bookingButton ? { bookingButton: true, buttonLabel: tplSel.buttonLabel } : {}) } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setTplError(d.error || 'Could not send'); }
      else if (d.delivered === false) { setTplError(d.error || 'Meta did not accept this template'); fetchMessages(activeId); fetchChats(); }
      else { setTplOpen(false); setTplSel(null); fetchMessages(activeId); fetchChats(); }
    } finally { setTplSending(false); }
  }

  const counts = useMemo(() => ({
    all: chats.length,
    needs_agent: chats.filter((c) => !c.botOn && c.status === 'open').length,
    unread: chats.filter((c) => c.unread > 0).length,
    resolved: chats.filter((c) => c.status === 'resolved').length,
  }), [chats]);

  const filtered = useMemo(() => {
    let list = chats;
    if (tab === 'needs_agent') list = list.filter((c) => !c.botOn && c.status === 'open');
    else if (tab === 'unread') list = list.filter((c) => c.unread > 0);
    else if (tab === 'resolved') list = list.filter((c) => c.status === 'resolved');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.lastText || '').toLowerCase().includes(q));
    }
    return list;
  }, [chats, tab, query]);

  const active = chats.find((c) => c.id === activeId);

  return (
    <div className="bc-page bc-page-flush">
      <div className="bc-inbox">
        <div className="bc-conv-col">
          <div className="bc-conv-head"><h2>Conversations</h2></div>
          <div className="bc-search">
            <IconSearch size={16} />
            <input placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="bc-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`bc-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label} {counts[t.key]}
              </button>
            ))}
          </div>
          <div className="bc-conv-list">
            {filtered.length === 0 && <div className="bc-empty">No conversations here.</div>}
            {filtered.map((c) => (
              <button key={c.id} className={`bc-conv-row${c.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(c.id)}>
                <Avatar name={c.name} />
                <div className="bc-conv-row-body">
                  <div className="bc-conv-row-top">
                    <span className="bc-conv-row-name">{c.name || c.phone}</span>
                    <span className="bc-conv-row-date">{fmtDate(c.lastAt)}</span>
                  </div>
                  <div className="bc-conv-row-preview">{c.lastText}</div>
                  <div className="bc-conv-row-badges">
                    {c.unread > 0 && <span className="bc-unread-dot">{c.unread}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bc-thread-col">
          {!active ? (
            <div className="bc-empty">Select a conversation</div>
          ) : (
            <>
              <div className="bc-thread-head">
                <Avatar name={active.name} />
                <div>
                  <div className="bc-thread-head-name">{active.name || active.phone}</div>
                  <div className="bc-thread-head-phone">{active.phone}</div>
                </div>
                <div className="bc-thread-head-right">
                  <button className={`bc-pill ${active.botOn ? 'bc-pill-on' : 'bc-pill-off'}`} onClick={() => patchActive({ botOn: !active.botOn })}>
                    <span className="bc-pill-dot" /> {active.botOn ? 'Bot on' : 'Bot off'}
                  </button>
                  <button className="bc-pill bc-pill-template" onClick={openTemplates}>Template</button>
                  <select className="bc-status-select" value={active.status} onChange={(e) => patchActive({ status: e.target.value })}>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="bc-messages">
                {messages.map((m) => {
                  const failed = m.direction === 'out' && m.status === 'failed';
                  return (
                    <div key={m.id} className={`bc-bubble ${m.direction === 'out' ? 'bc-out' : 'bc-in'}${failed ? ' bc-bubble-failed' : ''}`}>
                      {m.direction === 'out' && m.sender && m.sender !== 'bot' && <div className="bc-bubble-sender">{m.sender}</div>}
                      <div>{m.body}</div>
                      <div className="bc-bubble-meta">{fmtTime(m.ts)}</div>
                      {failed && (
                        <div className="bc-bubble-failed-note">
                          ⚠ Not delivered{m.error ? ` — ${m.error}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>


              {tplOpen && (
                <div className="bc-tpl-overlay" onClick={(e) => e.target === e.currentTarget && setTplOpen(false)}>
                  <div className="bc-tpl-card">
                    <div className="bc-tpl-head">
                      <div className="bc-tpl-title">{tplSel ? tplSel.name : 'Send a template'}</div>
                      <button className="bc-tpl-x" onClick={() => setTplOpen(false)} aria-label="Close">×</button>
                    </div>
                    {!tplSel ? (
                      <div className="bc-tpl-body">
                        <div className="bc-tpl-sub">Templates can be sent any time — even when the customer last wrote more than 24 hours ago.</div>
                        {tplNote && <div className="bc-tpl-note">{tplNote}</div>}
                        {tplList === null && <div className="bc-empty">Loading templates…</div>}
                        {tplList && tplList.length === 0 && <div className="bc-empty">No templates found.</div>}
                        {(tplList || []).map((t) => (
                          <button key={`${t.name}_${t.language}`} className="bc-tpl-row" disabled={!t.sendable} onClick={() => pickTemplate(t)}>
                            <div className="bc-tpl-row-top"><span className="bc-tpl-row-name">{t.name}</span><span className="bc-tpl-row-lang">{t.language}</span></div>
                            <div className="bc-tpl-row-text">{t.body}</div>
                            {!t.sendable && <div className="bc-tpl-row-warn">Can't send from here{t.reason ? ` — ${t.reason}` : ''}</div>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="bc-tpl-body">
                        {tplSel.params > 0 && <div className="bc-tpl-sub">Fill in the variables:</div>}
                        {tplParams.map((v, i) => (
                          <div key={i} className="bc-tpl-field">
                            <label>{(tplSel.hints && tplSel.hints[i]) || `Variable {{${i + 1}}}`}</label>
                            <input value={v} onChange={(e) => setTplParams((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`{{${i + 1}}}`} />
                          </div>
                        ))}
                        <div className="bc-tpl-sub" style={{ marginTop: 10 }}>Preview</div>
                        <div className="bc-tpl-preview">{renderTemplate(tplSel.body, tplParams)}{tplSel.bookingButton ? `\n\n[ ${tplSel.buttonLabel || 'Book installation'} ]` : ''}</div>
                        {tplSel.bookingButton && (
                          <div className="bc-tpl-sub" style={{ marginTop: 8 }}>
                            {tplCtx?.blocked ? `Can't send: ${tplCtx.blocked}` : `The button opens this customer's booking page for order ${tplParams[1] || tplCtx?.orderId || ''} — the link is added automatically.`}
                          </div>
                        )}
                        {tplError && <div className="bc-tpl-error">{tplError}</div>}
                        <div className="bc-tpl-actions">
                          <button className="bc-btn bc-btn-outline bc-btn-sm" onClick={() => setTplSel(null)} disabled={tplSending}>Back</button>
                          <button className="bc-btn bc-btn-primary bc-btn-sm" onClick={sendTemplate} disabled={tplSending || tplParams.some((p) => !String(p).trim()) || (tplSel.bookingButton && !!tplCtx?.blocked)}>{tplSending ? 'Sending…' : 'Send template'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="bc-composer">
                <input placeholder="Type your message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                <button className="bc-send-btn" onClick={send} disabled={sending || !text.trim()} aria-label="Send"><IconSend size={17} /></button>
              </div>
            </>
          )}
        </div>

        {active && (
          <div className="bc-info-col">
            <div className="bc-info-avatar-wrap">
              <Avatar name={active.name} size="lg" />
              <div className="bc-info-name">{active.name || active.phone}</div>
              <div className="bc-info-phone">{active.phone}</div>
            </div>
            <div className="bc-info-label">Conversation Info</div>
            <div className="bc-info-row"><span className="bc-info-row-key">Channel</span><span className="bc-info-row-val">WhatsApp</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">City</span><span className="bc-info-row-val">{active.city || '—'}</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">Assigned to</span><span className="bc-info-row-val">{active.assignedTo || 'Unassigned'}</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">Status</span><span className="bc-info-row-val">{active.status === 'resolved' ? 'Resolved' : 'Open'}</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">First Message</span><span className="bc-info-row-val">{fmtDate(active.firstMessageAt)}</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">Last Message</span><span className="bc-info-row-val">{fmtDate(active.lastAt)}</span></div>
            <div className="bc-info-row"><span className="bc-info-row-key">Lead</span><span className="bc-info-row-val">{active.lead ? active.lead.status : 'Not yet'}</span></div>
            {active.assignedTo ? (
              <button className="bc-info-btn bc-info-btn-ghost" onClick={() => patchActive({ unassign: true })}>Unassign conversation</button>
            ) : (
              <button className="bc-info-btn" onClick={() => patchActive({ assign: true })}>Assign conversation</button>
            )}
            {/* Resets the bot's conversation state (which question it's on, what it's collected
                so far) so the next "hi" from this same test number restarts the flow from the
                top — handy while testing in Flow Builder. Never touches the message history or
                any lead already linked to this chat — see app/api/bot/chats/[id]/route.js. */}
            <button
              className="bc-info-btn bc-info-btn-ghost"
              onClick={() => { if (window.confirm('Reset this conversation\'s bot state? The next message from them will restart the flow from the beginning. Message history and any linked lead are kept.')) patchActive({ resetBot: true }); }}
            >
              Reset bot conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
