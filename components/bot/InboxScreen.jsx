'use client';
// The Heseos Bot console's Inbox — the "MARG-like WhatsApp inbox" ask. Conversation list (with
// search + status tabs) + chat thread (bot on/off, Template, Open/Resolved) + a contact info
// panel with an Assign action, mirroring the reference screenshots. Talks to
// app/api/bot/chats*, scoped to the signed-in tenant via the heseos_bot_tenant cookie.
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { fmtDate } from '@/lib/date';
import { Avatar, fmtTime } from './ui';
import { IconSearch, IconSend } from './icons';

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
                  <button className="bc-pill bc-pill-template">Template</button>
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
