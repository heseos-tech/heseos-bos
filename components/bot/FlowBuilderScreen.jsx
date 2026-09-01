'use client';
// Flow Builder — the self-service, drag-and-drop way for a tenant to build their own bot
// conversations instead of (or beyond) the fixed Welcome Message + Quick Menu in Bot
// Configuration. A tenant can build several flows (see FlowListScreen, the screen that opens
// before this one); each is just a graph of nodes + edges plus a set of trigger conditions,
// saved via PUT /api/bot/flow/[id]. lib/botFlowEngine.js's pickFlow() decides which flow (if
// any) a brand-new chat enters — QR scan, referral link, a keyword in the first message, or the
// one flow a tenant has marked as their fallback — and then walks that flow's graph turn by
// turn once it's switched on. Nothing here is Heseos-specific.
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Topbar } from './ConsoleShell';
import { Switch } from './ui';
import { IconMessageNode, IconMenuNode, IconHandoffNode, IconHelp, IconFlow, IconPlus, IconMinus, IconX, IconCheck, IconArrowLeft, IconTrash } from './icons';

const NODE_W = 240;
const HEAD_H = 44;
const TEXT_PREVIEW_H = 40; // menu node's fixed message-preview strip — must match the CSS
const OPTION_ROW_H = 34;   // menu node's per-option row height — must match the CSS
const PORT_Y = 22;         // header-level port y for start/message/question/handoff nodes
const MAX_OPTIONS = 9;     // keeps the numbered-emoji menu (1️⃣–9️⃣) unambiguous
const MAX_KEYWORDS = 20;

const NODE_META = {
  start: { title: 'Flow Start', icon: IconFlow },
  message: { title: 'Send Message', icon: IconMessageNode },
  menu: { title: 'Menu / Options', icon: IconMenuNode },
  question: { title: 'Collect Answer', icon: IconHelp },
  handoff: { title: 'Hand to Team', icon: IconHandoffNode },
};

const PALETTE = [
  { type: 'message', label: 'Send Message', hint: 'One outgoing text message', icon: IconMessageNode },
  { type: 'menu', label: 'Menu / Options', hint: 'A message with numbered choices', icon: IconMenuNode },
  { type: 'question', label: 'Collect Answer', hint: 'Ask something, save the reply', icon: IconHelp },
  { type: 'handoff', label: 'Hand to Team', hint: 'End the bot, notify your team', icon: IconHandoffNode },
];

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultDataFor(type) {
  if (type === 'message') return { text: '' };
  if (type === 'menu') return { text: '', fieldKey: '', options: [{ id: uid('opt'), label: 'Option 1' }, { id: uid('opt'), label: 'Option 2' }] };
  if (type === 'question') return { text: '', fieldKey: '' };
  if (type === 'handoff') return { text: '' };
  return {};
}

// Local (unscaled, unpanned) coordinates of a node's connection points — shared by the SVG edge
// renderer and the temp connect-drag line. Kept in sync with the CSS pixel heights above by
// construction: change one, change the other.
function outputPos(node, handle) {
  if (node.type === 'menu' && handle !== 'default') {
    const options = node.data?.options || [];
    const idx = options.findIndex((o) => o.id === handle);
    const i = idx === -1 ? 0 : idx;
    return { x: node.x + NODE_W, y: node.y + HEAD_H + TEXT_PREVIEW_H + i * OPTION_ROW_H + OPTION_ROW_H / 2 };
  }
  return { x: node.x + NODE_W, y: node.y + PORT_Y };
}
function inputPos(node) {
  return { x: node.x, y: node.y + PORT_Y };
}

function NodeCard({ node, selected, onMouseDownHead, onStartConnect, onSelect, onDelete }) {
  const meta = NODE_META[node.type] || NODE_META.message;
  const Icon = meta.icon;
  const isStart = node.type === 'start';
  const options = node.type === 'menu' ? (node.data?.options || []) : [];

  return (
    <div
      className={`fb-node fb-node-${node.type}${selected ? ' selected' : ''}`}
      data-node-id={node.id}
      style={{ left: node.x, top: node.y, width: NODE_W }}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
    >
      <div className="fb-node-head" onMouseDown={(e) => onMouseDownHead(e, node)}>
        <span className="fb-node-icon"><Icon size={14} /></span>
        <span className="fb-node-title">{meta.title}</span>
        {!isStart && (
          <button type="button" className="fb-node-del" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} aria-label="Delete step">
            <IconX size={12} />
          </button>
        )}
      </div>

      {isStart && <div className="fb-node-caption">Every new WhatsApp chat begins here</div>}

      {node.type === 'message' && (
        <div className="fb-node-text">{node.data?.text ? node.data.text : <em>Click to write a message…</em>}</div>
      )}

      {node.type === 'menu' && (
        <>
          <div className="fb-node-textprev">{node.data?.text ? node.data.text : <em>Click to write a message…</em>}</div>
          {options.map((o) => (
            <div key={o.id} className="fb-node-option"><span>{o.label || 'Option'}</span></div>
          ))}
          {node.data?.fieldKey && <div className="fb-node-savemeta">saves as "{node.data.fieldKey}"</div>}
        </>
      )}

      {node.type === 'question' && (
        <div className="fb-node-text">
          {node.data?.text ? node.data.text : <em>Click to write a question…</em>}
          <div className="fb-node-savemeta">saves as "{node.data?.fieldKey || 'answer'}"</div>
        </div>
      )}

      {node.type === 'handoff' && (
        <div className="fb-node-text">{node.data?.text ? node.data.text : <em>No closing message</em>}</div>
      )}

      {!isStart && <div className="fb-port fb-port-in" />}
      {node.type !== 'handoff' && node.type !== 'menu' && (
        <div className="fb-port fb-port-out" onMouseDown={(e) => onStartConnect(e, node.id, 'default')} />
      )}
      {node.type === 'menu' && options.map((o, i) => (
        <div
          key={o.id}
          className="fb-port fb-port-out"
          style={{ top: HEAD_H + TEXT_PREVIEW_H + i * OPTION_ROW_H + OPTION_ROW_H / 2 - 6 }}
          onMouseDown={(e) => onStartConnect(e, node.id, o.id)}
        />
      ))}
    </div>
  );
}

export default function FlowBuilderScreen({ tenant, flow }) {
  const router = useRouter();
  const seedNodes = flow?.nodes && flow.nodes.length ? flow.nodes : [{ id: 'start', type: 'start', x: 60, y: 180, data: {} }];
  const [nodes, setNodes] = useState(seedNodes);
  const [edges, setEdges] = useState(flow?.edges || []);
  const [name, setName] = useState(flow?.name || 'Untitled Flow');
  const [enabled, setEnabled] = useState(!!flow?.enabled);
  const [keywords, setKeywords] = useState(flow?.triggers?.keywords || []);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [attrQr, setAttrQr] = useState((flow?.triggers?.attribution || []).includes('qr'));
  const [attrReferral, setAttrReferral] = useState((flow?.triggers?.attribution || []).includes('referral'));
  const [isDefault, setIsDefault] = useState(!!flow?.triggers?.isDefault);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [tempLine, setTempLine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  function touch() { setDirty(true); setSaved(false); }

  function toLocal(clientX, clientY) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      if (d.type === 'pan') {
        setPan({ x: d.startPan.x + (e.clientX - d.startX), y: d.startPan.y + (e.clientY - d.startY) });
      } else if (d.type === 'node') {
        const z = zoomRef.current;
        const dx = (e.clientX - d.startX) / z;
        const dy = (e.clientY - d.startY) / z;
        setNodes((ns) => ns.map((n) => (n.id === d.nodeId ? { ...n, x: d.startNodeX + dx, y: d.startNodeY + dy } : n)));
      } else if (d.type === 'connect') {
        const to = toLocal(e.clientX, e.clientY);
        setTempLine((t) => (t ? { ...t, to } : t));
      }
    }
    function onUp(e) {
      const d = dragRef.current;
      if (d && d.type === 'connect') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetEl = el && el.closest ? el.closest('[data-node-id]') : null;
        const targetId = targetEl?.dataset?.nodeId;
        if (targetId && targetId !== d.fromNode) {
          setEdges((es) => {
            const exists = es.some((ed) => ed.source === d.fromNode && (ed.sourceHandle || 'default') === d.fromHandle && ed.target === targetId);
            return exists ? es : [...es, { id: uid('e'), source: d.fromNode, sourceHandle: d.fromHandle, target: targetId }];
          });
          touch();
        }
        setTempLine(null);
      } else if (d && d.type === 'node') {
        touch();
      }
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addNode(type) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const center = rect ? toLocal(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 320, y: 200 };
    const jitter = (nodes.length * 22) % 160;
    const id = uid('n');
    setNodes((ns) => [...ns, { id, type, x: Math.max(0, center.x - NODE_W / 2 + jitter), y: Math.max(0, center.y - 30 + jitter), data: defaultDataFor(type) }]);
    setSelectedId(id);
    touch();
  }

  function deleteNode(id) {
    if (id === 'start') return;
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId((s) => (s === id ? null : s));
    touch();
  }

  function deleteEdge(id) {
    setEdges((es) => es.filter((e) => e.id !== id));
    touch();
  }

  function updateNodeData(id, patch) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    touch();
  }

  function addOption(nodeId) {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId) return n;
      const options = n.data?.options || [];
      if (options.length >= MAX_OPTIONS) return n;
      return { ...n, data: { ...n.data, options: [...options, { id: uid('opt'), label: `Option ${options.length + 1}` }] } };
    }));
    touch();
  }
  function updateOption(nodeId, optId, label) {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, options: (n.data.options || []).map((o) => (o.id === optId ? { ...o, label } : o)) } } : n)));
    touch();
  }
  function removeOption(nodeId, optId) {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, options: (n.data.options || []).filter((o) => o.id !== optId) } } : n)));
    setEdges((es) => es.filter((e) => !(e.source === nodeId && e.sourceHandle === optId)));
    touch();
  }

  function addKeyword() {
    const val = keywordDraft.trim();
    if (!val || keywords.length >= MAX_KEYWORDS) { setKeywordDraft(''); return; }
    if (keywords.some((k) => k.toLowerCase() === val.toLowerCase())) { setKeywordDraft(''); return; }
    setKeywords((ks) => [...ks, val]);
    setKeywordDraft('');
    touch();
  }
  function removeKeyword(val) {
    setKeywords((ks) => ks.filter((k) => k !== val));
    touch();
  }

  function startNodeDrag(e, node) {
    if (e.button !== 0) return;
    e.preventDefault();
    setSelectedId(node.id);
    dragRef.current = { type: 'node', nodeId: node.id, startX: e.clientX, startY: e.clientY, startNodeX: node.x, startNodeY: node.y };
  }
  function startConnect(e, nodeId, handle) {
    e.preventDefault();
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragRef.current = { type: 'connect', fromNode: nodeId, fromHandle: handle };
    setTempLine({ from: outputPos(node, handle), to: toLocal(e.clientX, e.clientY) });
  }
  function startPan(e) {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    setSelectedId(null);
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPan: { ...pan } };
  }

  function zoomBy(delta) {
    setZoom((z) => Math.min(1.6, Math.max(0.4, +(z + delta).toFixed(2))));
  }
  function resetView() {
    setZoom(1);
    setPan({ x: 40, y: 20 });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/bot/flow/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, enabled, nodes, edges,
          triggers: { keywords, attribution: [...(attrQr ? ['qr'] : []), ...(attrReferral ? ['referral'] : [])], isDefault },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save this flow.'); return; }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFlow() {
    if (!deleteArmed) { setDeleteArmed(true); setTimeout(() => setDeleteArmed(false), 3500); return; }
    setDeleting(true);
    try {
      await fetch(`/api/bot/flow/${flow.id}`, { method: 'DELETE' });
      router.push('/bot/console/flow-builder');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

  return (
    <>
      <Topbar title="Flow Builder" />
      <div className="fb-shell">
        <div className="fb-toolbar">
          <Link href="/bot/console/flow-builder" className="fb-back"><IconArrowLeft size={16} /></Link>
          <input className="fb-name-input" value={name} onChange={(e) => { setName(e.target.value); touch(); }} placeholder="Untitled Flow" />
          <div className={`fb-status-pill ${enabled ? 'on' : 'off'}`}>{enabled ? 'Live' : 'Draft'}</div>
          <div style={{ flex: 1 }} />
          <div className="fb-zoom">
            <button type="button" className="bc-icon-btn" onClick={() => zoomBy(-0.15)} aria-label="Zoom out"><IconMinus size={14} /></button>
            <span className="fb-zoom-val">{Math.round(zoom * 100)}%</span>
            <button type="button" className="bc-icon-btn" onClick={() => zoomBy(0.15)} aria-label="Zoom in"><IconPlus size={14} /></button>
          </div>
          <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={resetView}>Reset view</button>
          <Switch checked={enabled} onChange={(v) => { setEnabled(v); touch(); }} label="Use this flow" />
          <span className="fb-switch-label">Use this flow</span>
          <button type="button" className={`bc-icon-btn${deleteArmed ? ' fb-danger' : ''}`} onClick={deleteFlow} disabled={deleting} aria-label="Delete flow" title={deleteArmed ? 'Click again to confirm delete' : 'Delete flow'}>
            <IconTrash size={15} />
          </button>
          {error && <span className="fb-error">{error}</span>}
          <button type="button" className="bc-btn bc-btn-primary bc-btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Save'}</button>
          {saved && <span className="fb-saved"><IconCheck size={14} /> Saved</span>}
        </div>

        <div className="fb-body">
          <aside className="fb-palette">
            <div className="fb-palette-title">Triggers</div>
            <div className="fb-trigger-hint">When should this flow start?</div>
            <div className="fb-tags">
              {keywords.map((k) => (
                <span key={k} className="fb-tag">{k}<button type="button" onClick={() => removeKeyword(k)} aria-label={`Remove ${k}`}><IconX size={10} /></button></span>
              ))}
            </div>
            <input
              className="bc-input fb-tag-input"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(); } }}
              onBlur={addKeyword}
              placeholder="Keyword, then Enter"
              disabled={keywords.length >= MAX_KEYWORDS}
            />
            <label className="fb-check"><input type="checkbox" checked={attrQr} onChange={(e) => { setAttrQr(e.target.checked); touch(); }} /> Customer scanned a QR code</label>
            <label className="fb-check"><input type="checkbox" checked={attrReferral} onChange={(e) => { setAttrReferral(e.target.checked); touch(); }} /> Customer came via a referral link</label>
            <label className="fb-check"><input type="checkbox" checked={isDefault} onChange={(e) => { setIsDefault(e.target.checked); touch(); }} /> Use as fallback when nothing else matches</label>

            <div className="fb-palette-title" style={{ marginTop: 18 }}>Add a step</div>
            {PALETTE.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.type} type="button" className="fb-palette-item" onClick={() => addNode(p.type)}>
                  <span className={`fb-palette-icon fb-palette-icon-${p.type}`}><Icon size={15} /></span>
                  <span>
                    <div className="fb-palette-label">{p.label}</div>
                    <div className="fb-palette-hint">{p.hint}</div>
                  </span>
                </button>
              );
            })}
            <div className="fb-palette-tip">Drag a step by its header to move it. Drag from the dot on its right edge to connect it to the next step — click a connection to remove it.</div>
          </aside>

          <div className="fb-canvas-viewport" ref={viewportRef}>
            <div className="fb-canvas-surface" onMouseDown={startPan} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <svg className="fb-edges">
                <defs>
                  <marker id="fb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10Z" style={{ fill: 'var(--bc-accent)' }} />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const source = nodes.find((n) => n.id === edge.source);
                  const target = nodes.find((n) => n.id === edge.target);
                  if (!source || !target) return null;
                  const from = outputPos(source, edge.sourceHandle || 'default');
                  const to = inputPos(target);
                  const bend = Math.max(60, Math.abs(to.x - from.x) / 2);
                  const path = `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
                  return (
                    <path
                      key={edge.id}
                      className="fb-edge"
                      d={path}
                      fill="none"
                      strokeWidth="2"
                      markerEnd="url(#fb-arrow)"
                      style={{ stroke: 'var(--bc-accent)' }}
                      onClick={() => deleteEdge(edge.id)}
                    />
                  );
                })}
                {tempLine && (
                  <path
                    d={`M ${tempLine.from.x} ${tempLine.from.y} L ${tempLine.to.x} ${tempLine.to.y}`}
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    style={{ stroke: 'var(--bc-ink-faint)', pointerEvents: 'none' }}
                  />
                )}
              </svg>

              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  onMouseDownHead={startNodeDrag}
                  onStartConnect={startConnect}
                  onSelect={setSelectedId}
                  onDelete={deleteNode}
                />
              ))}
            </div>
          </div>

          <aside className="fb-inspector">
            {!selectedNode && (
              <div className="fb-inspector-empty">
                <div className="fb-inspector-empty-title">No step selected</div>
                <div className="fb-inspector-empty-sub">Click a step on the canvas to edit it, or add a new one from the left.</div>
              </div>
            )}
            {selectedNode && selectedNode.type === 'start' && (
              <div className="fb-inspector-empty">
                <div className="fb-inspector-empty-title">Flow Start</div>
                <div className="fb-inspector-empty-sub">Every chat that enters this flow begins here (see Triggers on the left for when that happens). Drag a line from its dot to the first step you want the bot to take.</div>
              </div>
            )}
            {selectedNode && selectedNode.type === 'message' && (
              <div className="fb-inspector-body">
                <div className="bc-card-title">Send Message</div>
                <label className="fb-label">Message text</label>
                <textarea className="bc-textarea" rows={6} value={selectedNode.data?.text || ''} onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })} placeholder="What should the bot say here?" />
              </div>
            )}
            {selectedNode && selectedNode.type === 'menu' && (
              <div className="fb-inspector-body">
                <div className="bc-card-title">Menu / Options</div>
                <label className="fb-label">Message text</label>
                <textarea className="bc-textarea" rows={3} value={selectedNode.data?.text || ''} onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })} placeholder="What should the bot say before listing the options?" />
                <label className="fb-label" style={{ marginTop: 16 }}>Options</label>
                {(selectedNode.data?.options || []).map((o, i) => (
                  <div key={o.id} className="fb-option-edit">
                    <span className="fb-option-num">{i + 1}</span>
                    <input className="bc-input" value={o.label} onChange={(e) => updateOption(selectedNode.id, o.id, e.target.value)} />
                    <button type="button" className="fb-option-del" onClick={() => removeOption(selectedNode.id, o.id)} aria-label="Remove option"><IconX size={12} /></button>
                  </div>
                ))}
                {(selectedNode.data?.options || []).length < MAX_OPTIONS && (
                  <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" style={{ marginTop: 6 }} onClick={() => addOption(selectedNode.id)}><IconPlus size={13} /> Add option</button>
                )}
                <div className="bc-hint" style={{ marginTop: 12 }}>Drag from the dot beside an option to send that reply down its own path.</div>
                <label className="fb-label" style={{ marginTop: 16 }}>Save the picked option as (optional)</label>
                <input className="bc-input" value={selectedNode.data?.fieldKey || ''} onChange={(e) => updateNodeData(selectedNode.id, { fieldKey: e.target.value.replace(/[^a-zA-Z0-9_ ]/g, '') })} placeholder="e.g. propertyType, budget" />
                <div className="bc-hint">Whichever option the customer picks gets stored under this name on their chat, same as a Collect Answer step.</div>
              </div>
            )}
            {selectedNode && selectedNode.type === 'question' && (
              <div className="fb-inspector-body">
                <div className="bc-card-title">Collect Answer</div>
                <label className="fb-label">Message text</label>
                <textarea className="bc-textarea" rows={4} value={selectedNode.data?.text || ''} onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })} placeholder="What should the bot ask?" />
                <label className="fb-label" style={{ marginTop: 16 }}>Save the reply as</label>
                <input className="bc-input" value={selectedNode.data?.fieldKey || ''} onChange={(e) => updateNodeData(selectedNode.id, { fieldKey: e.target.value.replace(/[^a-zA-Z0-9_ ]/g, '') })} placeholder="e.g. city, email, budget" />
                <div className="bc-hint">Whatever the customer replies gets stored under this name on their chat.</div>
              </div>
            )}
            {selectedNode && selectedNode.type === 'handoff' && (
              <div className="fb-inspector-body">
                <div className="bc-card-title">Hand to Team</div>
                <label className="fb-label">Closing message (optional)</label>
                <textarea className="bc-textarea" rows={4} value={selectedNode.data?.text || ''} onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })} placeholder="e.g. Thanks! Our team will reach out shortly." />
                <div className="bc-hint">The bot goes quiet after this and the chat shows up under Needs Agent in your Inbox.</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
