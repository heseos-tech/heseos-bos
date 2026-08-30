'use client';
import { useEffect, useState } from 'react';
import { Topbar } from './ConsoleShell';
import { Avatar, Badge } from './ui';
import { fmtDate } from '@/lib/date';

export default function ContactsScreen() {
  const [chats, setChats] = useState(null);

  useEffect(() => {
    fetch('/api/bot/chats').then((r) => r.json()).then(setChats);
  }, []);

  return (
    <>
      <Topbar title="Contacts" />
      <div className="bc-page">
        <div className="bc-card" style={{ padding: 0 }}>
          <table className="bc-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>City</th><th>Last Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(chats || []).map((c) => (
                <tr key={c.id}>
                  <td><div className="bc-table-name"><Avatar name={c.name} /> {c.name || '—'}</div></td>
                  <td>{c.phone}</td>
                  <td>{c.city || '—'}</td>
                  <td>{fmtDate(c.lastAt)}</td>
                  <td><Badge tone={c.status === 'resolved' ? 'gray' : 'teal'}>{c.status === 'resolved' ? 'Resolved' : 'Open'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {chats && chats.length === 0 && <div className="bc-empty">No contacts yet — they'll show up here as your bot talks to people.</div>}
          {!chats && <div className="bc-empty">Loading…</div>}
        </div>
      </div>
    </>
  );
}
