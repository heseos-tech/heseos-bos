'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { fmtDateTime } from '@/lib/date';

export default function InboxView({ employee }) {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const fetchChats = useCallback(async () => {
    const res = await fetch('/api/whatsapp/chats');
    if (res.ok) {
      const data = await res.json();
      setChats(data);
      if (!activeId && data.length) setActiveId(data[0].id);
    }
  }, [activeId]);

  const fetchMessages = useCallback(async (id) => {
    if (!id) return;
    const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(id)}/messages`);
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => {
    fetchChats();
    const t = setInterval(fetchChats, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    fetchMessages(activeId);
    fetch(`/api/whatsapp/chats/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markRead: true }),
    }).then(fetchChats);
    const t = setInterval(() => fetchMessages(activeId), 8000);
    return () => clearInterval(t);
  }, [activeId, fetchMessages, fetchChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function logout() {
    await fetch('/api/auth/employee', { method: 'DELETE' });
    router.push('/employee/login');
    router.refresh();
  }

  async function send() {
    if (!text.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: activeId, text }),
      });
      if (res.ok) { setText(''); fetchMessages(activeId); }
    } finally {
      setSending(false);
    }
  }

  async function claim() {
    if (!activeId) return;
    await fetch(`/api/whatsapp/chats/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: true }),
    });
    fetchChats();
  }

  const active = chats.find((c) => c.id === activeId);

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div className="dash-topbar-inner">
          <div className="dash-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 24, width: 'auto' }} /> <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>Team Inbox</span></div>
          <div className="dash-user">
            <Link href="/employee" className="chip-btn">← Leads</Link>
            <span className="dash-user-name">{employee.name || employee.email}</span>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>

      <div className="inbox-shell">
        <div className="inbox-list">
          {chats.length === 0 && <div className="empty-state">No WhatsApp conversations yet.</div>}
          {chats.map((c) => (
            <button key={c.id} className={`inbox-row${c.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(c.id)}>
              <div className="inbox-row-top">
                <span className="inbox-row-name">{c.name || c.phone}</span>
                {c.unread > 0 && <span className="inbox-unread">{c.unread}</span>}
              </div>
              <div className="inbox-row-preview">{c.lastText}</div>
              <div className="inbox-row-meta">{fmtDateTime(c.lastAt)} {c.partnerId ? `· ref:${c.partnerId}` : ''}</div>
            </button>
          ))}
        </div>

        <div className="inbox-thread">
          {!active ? (
            <div className="empty-state">Select a conversation</div>
          ) : (
            <>
              <div className="inbox-thread-head">
                <div>
                  <div className="inbox-row-name">{active.name || active.phone}</div>
                  <div className="inbox-row-meta">{active.phone} {active.assignedToName ? `· assigned to ${active.assignedToName}` : ''}</div>
                </div>
                {!active.assignedTo && <button className="chip-btn primary" onClick={claim}>Claim chat</button>}
                {active.leadId && <Link href="/employee" className="chip-btn">View lead</Link>}
              </div>

              <div className="inbox-messages">
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.direction === 'out' ? 'out' : 'in'}`}>
                    <div className="bubble-text">{m.body}</div>
                    <div className="bubble-meta">{fmtDateTime(m.ts)}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="inbox-composer">
                <input className="lf-input" placeholder="Type a reply…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                <button className="btn-primary btn-sm" onClick={send} disabled={sending || !text.trim()}>{sending ? '…' : 'Send'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
