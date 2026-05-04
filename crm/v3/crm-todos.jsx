// crm-todos.jsx — Key's todo list. 36×36 icon button + downward popover.
// Lives in the LEFT panel header (Contacts) alongside PermitPortalsButton.
//
// Key 2026-05-03: "i need a todo list in my crm, just something simple,
// next to the jurisdiction button on the left section. i want you to add
// to update and add to it every morning at 5 am based on all aspects of
// my busness and i want to be able to add things as well."
//
// Backed by Supabase bpp_todos table:
//   - source='ai' rows come from morning-todos edge function (5am ET cron)
//   - source='manual' rows come from Key typing into the input
//   - Realtime via Supabase channel so AI rows pop in without reload

function TodosButton() {
  const [open, setOpen] = React.useState(false);
  const [todos, setTodos] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const wrapRef = React.useRef(null);

  // Realtime subscribe — AI cron, manual adds from other tabs, completion toggles
  React.useEffect(() => {
    if (!window.db) return;
    const ch = window.db
      .channel('bpp_todos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpp_todos' }, () => setTick(n => n + 1))
      .subscribe();
    return () => { window.db.removeChannel(ch); };
  }, []);

  // Load (and reload on tick or open)
  React.useEffect(() => {
    if (!window.db) return;
    let alive = true;
    (async () => {
      const { data } = await window.db
        .from('bpp_todos')
        .select('id, title, notes, source, priority, related_contact_id, completed, completed_at, created_at')
        .order('completed', { ascending: true })
        .order('priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(60);
      if (!alive) return;
      setTodos(data || []);
    })();
    return () => { alive = false; };
  }, [tick]);

  // Outside-click + Escape close
  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const addTodo = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    const { error } = await window.db
      .from('bpp_todos')
      .insert({ title, source: 'manual' });
    if (!error) setDraft('');
    setAdding(false);
  };

  const toggle = async (t) => {
    if (t.completed) {
      await window.db
        .from('bpp_todos')
        .update({ completed: false, completed_at: null })
        .eq('id', t.id);
    } else {
      await window.db
        .from('bpp_todos')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', t.id);
    }
  };

  const remove = async (t) => {
    await window.db.from('bpp_todos').delete().eq('id', t.id);
  };

  // Hide completed older than 6 hours so the list stays clean
  const sixHrsAgo = Date.now() - 6 * 3600 * 1000;
  const visible = todos.filter(t => !t.completed || (t.completed_at && new Date(t.completed_at).getTime() > sixHrsAgo));
  const openCount = visible.filter(t => !t.completed).length;

  // Checklist icon — three lines with check marks. Navy stroke, 1.5
  const todosIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4 L4 5.5 L6.5 3" />
      <line x1="8.5" y1="4.25" x2="13.5" y2="4.25" />
      <path d="M2.5 8 L4 9.5 L6.5 7" />
      <line x1="8.5" y1="8.25" x2="13.5" y2="8.25" />
      <line x1="2.5" y1="12" x2="6.5" y2="12" />
      <line x1="8.5" y1="12" x2="13.5" y2="12" />
    </svg>
  );

  // v10.1.16 mobile fix: phone width detection so the popover can clamp to
  // viewport. Was overflowing left edge on iPhone (340px popover, ~390pt
  // viewport, anchored right:0 of button positioned mid-screen).
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Todos"
        title="Todos"
        style={{
          width:36, height:36, borderRadius:8,
          background: open ? '#F0F4FF' : 'white',
          border:'1px solid rgba(11,31,59,0.12)',
          cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:0,
          position:'relative',
        }}
      >
        {todosIcon}
        {openCount > 0 && (
          <span style={{
            position:'absolute', top:-3, right:-3,
            minWidth:16, height:16, padding:'0 4px',
            borderRadius:8, background: GOLD, color: NAVY,
            fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'inherit',
          }}>{openCount > 9 ? '9+' : openCount}</span>
        )}
      </button>

      {open && (
        <>
          {/* v10.1.16 backdrop — prevents tap-through to the contact list
              underneath. Mobile users were tapping outside the popover to
              dismiss and accidentally opening contacts. */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position:'fixed', top:0, left:0, right:0, bottom:0,
              zIndex:49,
              background: isMobile ? 'rgba(11,31,59,0.18)' : 'transparent',
            }}
          />
        <div style={isMobile ? {
          // Mobile: full-screen-width drawer pinned below the panel header,
          // safe-area aware so the home indicator doesn't eat content.
          // CRITICAL: the mobile-panel ancestor has `transform` which makes
          // it the containing block for position:fixed (CSS spec). So we
          // can't use right:N — that anchors to the 200%-wide swiping
          // parent, not the viewport. Use vw for width + left for position
          // so the popover stays viewport-locked.
          position:'fixed',
          top:'calc(env(safe-area-inset-top) + 96px)',
          left:8,
          width:'calc(100vw - 16px)',
          background:'white',
          border:'1px solid rgba(27,43,75,0.12)',
          borderRadius:12,
          boxShadow:'0 12px 32px rgba(27,43,75,0.22)',
          padding:14, zIndex:50,
          maxHeight:'calc(100vh - 96px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)',
          display:'flex', flexDirection:'column',
        } : {
          // Desktop: original anchored popover
          position:'absolute', right:0, top:'calc(100% + 6px)',
          width:340,
          background:'white',
          border:'1px solid rgba(27,43,75,0.12)',
          borderRadius:12,
          boxShadow:'0 8px 24px rgba(27,43,75,0.16)',
          padding:14, zIndex:50,
          maxHeight:'70vh',
          display:'flex', flexDirection:'column',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:NAVY }}>
              Todos {openCount > 0 ? `(${openCount})` : ''}
            </span>
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:10, color:'#999' }}>
              AI refresh 5am ET
            </span>
          </div>

          {/* Quick add */}
          <div style={{ display:'flex', gap:6, marginBottom: visible.length > 0 ? 10 : 0 }}>
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
              placeholder="Add a todo and press Enter…"
              style={{
                flex:1,
                padding:'8px 10px',
                background:'white',
                color:NAVY,
                border:'1px solid rgba(27,43,75,0.15)',
                borderRadius:6,
                fontFamily:'inherit', fontSize:13,
                outline:'none',
              }}
            />
            <button
              onClick={addTodo}
              disabled={!draft.trim() || adding}
              style={{
                padding:'6px 12px', background:GOLD, color:NAVY, border:'none',
                borderRadius:6, fontSize:12, fontWeight:600, fontFamily:'inherit',
                cursor: draft.trim() && !adding ? 'pointer' : 'not-allowed',
                opacity: draft.trim() && !adding ? 1 : 0.5,
              }}
            >Add</button>
          </div>

          {/* Empty state */}
          {visible.length === 0 && (
            <div style={{
              padding:'18px 6px', textAlign:'center',
              fontSize:12, color:'#999', fontStyle:'italic',
              fontFamily:'inherit',
            }}>
              No todos yet. Type one above, or check back at 5am for the AI list.
            </div>
          )}

          {/* List — scroll container so popover doesn't grow unbounded */}
          {visible.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, overflowY:'auto', flex:1 }}>
              {visible.map(t => (
                <div key={t.id} style={{
                  display:'flex', alignItems:'flex-start', gap:8,
                  padding:'7px 8px',
                  background: t.completed ? 'transparent' : '#F8F9FB',
                  borderRadius:6,
                  opacity: t.completed ? 0.55 : 1,
                  transition:'opacity 150ms ease',
                }}>
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggle(t)}
                    style={{ marginTop:2, cursor:'pointer', flexShrink:0 }}
                  />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontFamily:'inherit', fontSize:13,
                      color:NAVY,
                      textDecoration: t.completed ? 'line-through' : 'none',
                      wordBreak:'break-word', lineHeight:1.4,
                    }}>
                      {t.source === 'ai' ? <span title="AI-generated" style={{ marginRight:6, fontSize:11 }}>🤖</span> : null}
                      {t.title}
                    </div>
                    {t.notes && (
                      <div style={{
                        fontFamily:'inherit', fontSize:11,
                        color:'#777', marginTop:3,
                        wordBreak:'break-word', lineHeight:1.35,
                      }}>{t.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(t)}
                    title="Delete"
                    style={{
                      padding:'2px 6px', background:'transparent',
                      border:'none', cursor:'pointer',
                      color:'#999', fontSize:14, lineHeight:1, flexShrink:0,
                      fontFamily:'inherit',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { TodosButton });
