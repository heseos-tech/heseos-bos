'use client';

// The unlocked view: a slim confidentiality bar (carries the reader's name as a deterrent) over
// the proposal, loaded from the cookie-protected API route.
export default function ProposalViewer({ name }) {
  const signOut = async () => {
    try { await fetch('/api/investors/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <div className="inv-viewer">
      <div className="inv-bar">
        <span className="inv-bar-mark">Confidential</span>
        <span className="inv-bar-who">Shared with {name}</span>
        <button type="button" className="inv-bar-out" onClick={signOut}>Sign out</button>
      </div>
      <iframe className="inv-frame" src="/api/investors/proposal" title="Heseos Investment Proposal" />
    </div>
  );
}
