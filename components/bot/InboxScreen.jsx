'use client';
// The Heseos Bot console's Inbox — the "MARG-like WhatsApp inbox" ask. Conversation list (with
// search + status tabs) + chat thread (bot on/off, Template, Open/Resolved) + a contact info
// panel with an Assign action, mirroring the reference screenshots. Talks to
// app/api/bot/chats*, scoped to the signed-in tenant via the heseos_bot_tenant cookie.
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { fmtDate } from '@/lib/date';
import { Avatar, fmtTime } from './ui';
import { IconSearch, IconSend, IconPaperclip } from './icons';
import { renderTemplate } from '@/lib/botTemplates';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_agent', label: 'Needs Agent' },
  { key: 'unread', label: 'Unread' },
  { key: 'resolved', label: 'Resolved' },
];

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const PLACEHOLDER_BODY = new Set(['[image]', '[document]', '[sticker]']);

function fmtSize(n) {
  if (!n) return '';
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Photos straight off a phone are often 5-10 MB — shrink them to a sensible size (long side 1600px,
// JPEG) in the browser so they clear the 4 MB upload limit and send quickly. PDFs are sent as-is.
async function prepareImage(file) {
  if (file.size <= 900 * 1024 && file.type === 'image/jpeg') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size <= 3.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}

function MediaBlock({ m }) {
  const md = m.media;
  if (!md) return null;
  const src = md.id ? `/api/bot/media/${encodeURIComponent(md.id)}` : null;
  if (!src) {
    return <div className="bc-media-missing">{md.type === 'image' ? '🖼 Image' : `📄 ${md.filename || 'File'}`} — {md.unavailable === 'too_large' ? 'file too large to preview' : 'could not be downloaded'}</div>;
  }
  if (md.type === 'image') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="bc-media-img-link">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={md.filename || 'Image'} className="bc-media-img" loading="lazy" />
      </a>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="bc-media-doc">
      <span className="bc-media-doc-ico">📄</span>
      <span className="bc-media-doc-txt"><span className="bc-media-doc-name">{md.filename || 'Document'}</span><span className="bc-media-doc-size">{fmtSize(md.size)} · Open</span></span>
    </a>
  );
}

export default function InboxScreen({ tenant }) {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const bottomRef = useRef(null);

  // Attach a file (paperclip): picks a JPG/PNG or PDF, shows a preview with an optional caption, then sends it.
  const fileRef = useRef(null);
  const [attach, setAttach] = useState(null); // { file, previewUrl }
  const [attachCaption, setAttachCaption] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState('');

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

  async function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setAttachError(''); setAttachCaption('');
    const isImg = /^image\/(jpeg|png)$/i.test(f.type);
    const isPdf = f.type === 'application/pdf';
    if (!isImg && !isPdf) { setAttach({ file: null, previewUrl: '' }); setAttachError('Only JPG / PNG images and PDF files can be sent.'); return; }
    setAttachBusy(true);
    setAttach({ file: null, previewUrl: '' });
    const ready = isImg ? await prepareImage(f) : f;
    setAttachBusy(false);
    if (ready.size > MAX_FILE_BYTES) { setAttachError(`That file is ${fmtSize(ready.size)} — the limit is 4 MB. Please send a smaller one.`); return; }
    setAttach({ file: ready, previewUrl: isImg ? URL.createObjectURL(ready) : '' });
  }

  function closeAttach() {
    if (attachBusy) return;
    if (attach?.previewUrl) URL.revokeObjectURL(attach.previewUrl);
    setAttach(null); setAttachCaption(''); setAttachError('');
  }

  async function sendAttach() {
    if (!attach?.file || !activeId) return;
    setAttachBusy(true); setAttachError('');
    try {
      const fd = new FormData();
      fd.append('file', attach.file, attach.file.name);
      if (attachCaption.trim()) fd.append('caption', attachCaption.trim());
      const res = await fetch(`/api/bot/chats/${encodeURIComponent(activeId)}/messages`, { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setAttachError(d.error || 'Could not send the file'); return; }
      if (d.delivered === false) { setAttachError(d.error || 'WhatsApp did not accept this file'); fetchMessages(activeId); fetchChats(); return; }
      if (attach.previewUrl) URL.revokeObjectURL(attach.previewUrl);
      setAttach(null); setAttachCaption('');
      fetchMessages(activeId); fetchChats();
    } catch { setAttachError('Could not send the file — check your connection and try again.'); }
    finally { setAttachBusy(false); }
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
                      <MediaBlock m={m} />
                      {!(m.media && PLACEHOLDER_BODY.has(m.body)) && <div>{m.body}</div>}
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
              {attach && (
                <div className="bc-tpl-overlay" onClick={(e) => e.target === e.currentTarget && closeAttach()}>
                  <div className="bc-tpl-card">
                    <div className="bc-tpl-head">
                      <div className="bc-tpl-title">Send a file</div>
                      <button className="bc-tpl-x" onClick={closeAttach} aria-label="Close">×</button>
                    </div>
                    <div className="bc-tpl-body">
                      {attachBusy && !attach.file && <div className="bc-empty">Preparing…</div>}
                      {attach.file && attach.previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attach.previewUrl} alt="Preview" className="bc-attach-preview" />
                      )}
                      {attach.file && !attach.previewUrl && (
                        <div className="bc-media-doc bc-attach-doc"><span className="bc-media-doc-ico">📄</span><span className="bc-media-doc-txt"><span className="bc-media-doc-name">{attach.file.name}</span><span className="bc-media-doc-size">{fmtSize(attach.file.size)}</span></span></div>
                      )}
                      {attach.file && (
                        <div className="bc-tpl-field" style={{ marginTop: 10 }}>
                          <label>Caption (optional)</label>
                          <input value={attachCaption} maxLength={1000} onChange={(e) => setAttachCaption(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !attachBusy && sendAttach()} placeholder="Add a message with the file…" />
                        </div>
                      )}
                      <div className="bc-tpl-sub" style={{ marginTop: 8 }}>Files can only be sent while the customer has messaged in the last 24 hours. JPG / PNG / PDF, up to 4 MB.</div>
                      {attachError && <div className="bc-tpl-error">{attachError}</div>}
                      <div className="bc-tpl-actions">
                        <button className="bc-btn bc-btn-outline bc-btn-sm" onClick={closeAttach} disabled={attachBusy}>Cancel</button>
                        <button className="bc-btn bc-btn-primary bc-btn-sm" onClick={sendAttach} disabled={attachBusy || !attach.file}>{attachBusy && attach.file ? 'Sending…' : 'Send file'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="bc-composer">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={onPickFile} style={{ display: 'none' }} />
                <button className="bc-attach-btn" onClick={() => fileRef.current?.click()} aria-label="Attach a file" title="Attach a PDF or image"><IconPaperclip size={19} /></button>
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
