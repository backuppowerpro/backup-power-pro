// crm-left.jsx — Left panel: 5 fully-featured list views
// All lenses consume the canonical DB-shape arrays directly. Views are derived
// inline via filter/sort. No legacy adapters.

// Today's date in YYYY-MM-DD form, evaluated at module load. Local
// timezone — toISOString() emits UTC, which silently flips to "tomorrow"
// after 8 PM EDT every day, breaking calendar today-highlights and
// NextJobCard countdowns for the evening hours. Build the YYYY-MM-DD
// from the local-clock components.
const _bppToday = new Date();
const TODAY = `${_bppToday.getFullYear()}-${String(_bppToday.getMonth()+1).padStart(2,'0')}-${String(_bppToday.getDate()).padStart(2,'0')}`;

function LeftPanel({ tab, onOpen, dncSet = new Set(), activeContactId }) {
  const { contacts, events, proposals, invoices, messages, calls } = CRM;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background: BG, minHeight:0 }}>
      {tab === 'contacts' && <ContactsList contacts={contacts} messages={messages} calls={calls} proposals={proposals} invoices={invoices} events={events} onOpen={onOpen} dncSet={dncSet} activeContactId={activeContactId} />}
      {tab === 'calendar' && <CalendarList events={events} contacts={contacts} onOpen={onOpen} activeContactId={activeContactId} />}
      {tab === 'finance'  && <FinanceList proposals={proposals} invoices={invoices} contacts={contacts} events={events} onOpen={onOpen} activeContactId={activeContactId} />}
      {tab === 'messages' && <MessagesList messages={messages} calls={calls} contacts={contacts} onOpen={onOpen} activeContactId={activeContactId} />}
      {tab === 'calls'    && <CallsList calls={calls} contacts={contacts} onOpen={onOpen} activeContactId={activeContactId} />}
    </div>
  );
}

// ── Contact name resolver ────────────────────────────────────────
const contactName = c => c?.name || (c?.ref_id ? '#'+c.ref_id : '—');

// Hover preview — desktop-only peek card. Compact (200px), positioned to
// the right of the contact ROW (not the avatar), connected by a small
// arrow. Skipped on touch devices and when the contact has no real address.
function ContactAvatarHoverPreview({ contact, unread, dncSet, onOpen }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ left: 0, top: 0, arrowSide: 'left' });
  const wrapRef = React.useRef(null);
  const popupRef = React.useRef(null);
  const openTimerRef = React.useRef(null);
  const closeTimerRef = React.useRef(null);
  const isPremium = contact.pricing_tier === 'premium' || contact.pricing_tier === 'premium_plus';

  const startOpen = () => {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      // Anchor to the parent row so the popup peeks out to the right of
      // the row rather than out of the tiny avatar. The row was a
      // <button> originally; Round 4 swapped it to <div role="button">
      // to fix a button-in-button warning, so we look for either.
      const row = wrapRef.current?.closest('[role="button"]') || wrapRef.current?.closest('button');
      const rect = (row || wrapRef.current)?.getBoundingClientRect();
      if (!rect) return;
      const popupW = 220;
      const popupH = 220;
      const margin = 12;
      const overflowsRight = rect.right + popupW + margin > window.innerWidth - 8;
      const left = overflowsRight ? rect.left - popupW - margin : rect.right + margin;
      // Default: align popup TOP with the row's top so the popup sits next
      // to the contact you're actually hovering. Clamp into the viewport
      // only when near the very top or bottom edges.
      const safePadding = 8;
      const wantTop = rect.top - 4; // small upward offset for visual balance
      const maxTop = window.innerHeight - popupH - safePadding;
      const top = Math.max(safePadding, Math.min(maxTop, wantTop));
      // Track where the row's vertical center is relative to the popup, so
      // the connector arrow points back at the actual hovered avatar even
      // when the popup got clamped near the viewport edge.
      const arrowTop = Math.max(12, Math.min(popupH - 12, (rect.top + rect.height/2) - top));
      setPos({ left, top, arrowSide: overflowsRight ? 'right' : 'left', arrowTop });
      setOpen(true);
    }, 450);
  };
  // Don't close instantly — give the cursor 120ms to bridge from the avatar
  // to the popup so the user can interact with it without it disappearing.
  const cancelOpen = () => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };
  const keepOpen = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  };

  // Clean up pending timers on unmount so we don't fire setOpen() on a dead
  // component when a row scrolls out of the virtualized list mid-delay. Also
  // close the popup on Escape so keyboard users have an exit.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (openTimerRef.current)  clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  const heroAddress = contact.address;
  // Only show the hero image when we have a real street — fake test contacts
  // would otherwise pull a generic Google "no imagery" placeholder that
  // doesn't match the contact at all. Falls back to a name/info card.
  const heroUrl = isAddressableStreet(heroAddress)
    ? `https://maps.googleapis.com/maps/api/streetview?size=640x640&scale=2&location=${encodeURIComponent(heroAddress.trim())}&fov=80&pitch=2&source=outdoor&key=${SV_KEY}`
    : null;

  const handleOpenContact = (tab) => (e) => { e.stopPropagation(); cancelOpen(); onOpen(contact.id, tab); };

  return (
    <div
      ref={wrapRef}
      style={{ position:'relative', flexShrink:0 }}
      onMouseEnter={startOpen}
      onMouseLeave={cancelOpen}
    >
      <ContactAvatar contact={contact} size={40} />
      {unread && <div style={{ position:'absolute', top:0, right:0, width:9, height:9, borderRadius:'50%', background:'#E53E3E', border:'2px solid white' }} />}
      {/* Portal the popup out of the row's button to avoid invalid
          button-inside-button nesting and to keep it on top of any
          stacking-context the row creates. */}
      {open && ReactDOM.createPortal(
        <div
          ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={keepOpen}
          onMouseLeave={cancelOpen}
          style={{
            position:'fixed', left:pos.left, top:pos.top, zIndex:9999,
            width:220, background:'white', border:'1px solid rgba(11,31,59,0.12)',
            borderRadius:8, boxShadow:'0 8px 24px rgba(11,31,59,0.16)',
            overflow:'hidden',
            animation: 'bpp-fade-up 180ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
          }}
        >
          {/* Connector arrow — points back at the hovered avatar's actual
              vertical position, even when the popup got clamped near a
              viewport edge. */}
          <div style={{
            position:'absolute', top:pos.arrowTop, marginTop:-6,
            ...(pos.arrowSide === 'left'
              ? { left:-6, borderRight:'6px solid white', borderTop:'6px solid transparent', borderBottom:'6px solid transparent' }
              : { right:-6, borderLeft:'6px solid white', borderTop:'6px solid transparent', borderBottom:'6px solid transparent' }),
            width:0, height:0, filter:'drop-shadow(0 0 0.5px rgba(11,31,59,0.12))',
          }} />
          {heroUrl && (
            <div style={{ position:'relative', height:100, background:'#EBEBEA' }}>
              <img src={heroUrl} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'50% 30%', filter:'saturate(1.18) contrast(1.04)', display:'block' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.72) 100%)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', left:10, right:10, bottom:6, color:'white', fontSize:13, fontWeight:700, textShadow:'0 1px 2px rgba(0,0,0,0.6)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(contact)}</div>
            </div>
          )}
          <div style={{ padding: heroUrl ? '8px 12px 10px' : '12px 12px 10px' }}>
            {!heroUrl && (
              <div style={{ fontSize:14, fontWeight:700, color:NAVY, marginBottom:5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(contact)}</div>
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
              {isPremium && <span style={{ fontSize:9, fontWeight:700, color:NAVY, background:GOLD, padding:'1px 6px', borderRadius:20, letterSpacing:'0.04em' }}>{contact.pricing_tier === 'premium_plus' ? 'PREMIUM+' : 'PREMIUM'}</span>}
              <span style={{ fontSize:9, fontWeight:700, color:'#5B21B6', background:'#F5F3FF', padding:'1px 6px', borderRadius:20, letterSpacing:'0.04em' }}>{(window.CRM?.STAGE_LABELS?.[contact.stage] || '').toUpperCase()}</span>
              {dncSet.has(contact.id) && <span style={{ fontSize:9, fontWeight:700, color:'#991B1B', background:'#FEF2F2', padding:'1px 6px', borderRadius:20 }}>DNC</span>}
            </div>
            {heroAddress && (
              <div style={{ fontSize:11, color:'#666', marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{heroAddress}</div>
            )}
            <div style={{ marginBottom:8, minHeight:14 }}>
              <DriveTimeBadgeFromList address={heroAddress} contactId={contact.id} />
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  onClick={(e)=>{ e.stopPropagation(); cancelOpen(); }}
                  style={{
                    flex:1, minHeight:36, borderRadius:6, background: GOLD,
                    color:NAVY, textDecoration:'none', fontSize:12, fontWeight:600,
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                  }}
                >Call</a>
              ) : (
                // Disabled <button> not <a href={undefined}> — proper a11y
                // (no keyboard focus, no aria-confusing element).
                <button disabled aria-label="No phone number on file" style={{
                  flex:1, minHeight:36, borderRadius:6, background:'#EBEBEA',
                  color:NAVY, opacity:0.5, fontSize:12, fontWeight:600,
                  border:'none', cursor:'not-allowed', fontFamily:'inherit',
                }}>Call</button>
              )}
              <button
                onClick={handleOpenContact('messages')}
                style={{
                  flex:1, minHeight:36, borderRadius:6, background:'white', color:NAVY,
                  border:'1px solid rgba(11,31,59,0.15)', fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                }}
              >Text</button>
              <button
                onClick={handleOpenContact('contacts')}
                style={{
                  flex:1, minHeight:36, borderRadius:6, background:'white', color:NAVY,
                  border:'1px solid rgba(11,31,59,0.15)', fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                }}
              >Open</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Lightweight wrapper — DriveTimeBadge lives in crm-right.jsx; in left list
// hover preview we re-implement a bare version to avoid the import dance.
function DriveTimeBadgeFromList({ address, contactId }) {
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    setInfo(null);
    setLoading(true);
    if (!isAddressableStreet(address) || typeof driveTimeToContactAddress !== 'function') {
      setLoading(false);
      return () => { alive = false; };
    }
    driveTimeToContactAddress(address, contactId).then(r => {
      if (alive) { setInfo(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, [contactId, address]);
  if (loading || !info) return null;
  const txt = info.minutes < 60 ? `≈${info.minutes} min` : `≈${Math.floor(info.minutes/60)}h ${info.minutes%60}m`;
  return <span style={{ fontSize:11, fontWeight:600, color:'#666' }}>🚗 {txt} · {info.miles.toFixed(1)} mi</span>;
}
// Local short-form variant — returns the second comma-segment unparsed
// (e.g. "Greenville SC 29615"). Renamed from cityFromAddress because it
// was shadowing the smarter version exported from crm-data.js, which the
// proposal modal relied on for its jurisdiction display.
const cityFromAddrShort = a => (a||'').split(',').slice(1,2).join('').trim();

// ── Panel Header ──────────────────────────────────────────────────
function PanelHeader({ title, action, onAction, count, right }) {
  return (
    // Fixed 60px height so the bottom border aligns with the right-pane
    // ContactStrip's bottom border across the desktop panel divider.
    // Vertical padding is 0 — content centers via alignItems:center.
    <div style={{ height:60, padding:'0 18px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #EBEBEA', background:'white', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:17, fontWeight:700, color: NAVY }}>{title}</span>
        {count != null && <span style={{ fontSize:12, color: MUTED }}>{count}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {right}
        {action && (
          <button onClick={onAction} style={{ background: NAVY, color:'white', border:'none', borderRadius:8, padding:'6px 12px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
            <div style={{width:13,height:13}}>{Icons.plus}</div>{action}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChips({ options, value, onChange }) {
  const scrollRef = React.useRef(null);
  const handleClick = (optValue, el) => {
    onChange(optValue);
    if (el && scrollRef.current) {
      const c = scrollRef.current;
      const cRect = c.getBoundingClientRect();
      const bRect = el.getBoundingClientRect();
      const target = c.scrollLeft + bRect.left - cRect.left - (cRect.width / 2) + (bRect.width / 2);
      c.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  };
  return (
    <div ref={scrollRef} className="chip-row" style={{ display:'flex', gap:8, padding:'11px 18px 10px', background:'white', borderBottom:'1px solid #EBEBEA', overflowX:'auto', flexShrink:0, scrollbarWidth:'none', msOverflowStyle:'none', scrollSnapType:'x mandatory' }}>
      {options.map(o => {
        const active = value === (o.value||o);
        return (
          <button key={o.value||o} onClick={e => handleClick(o.value||o, e.currentTarget)} style={{
            height:36, padding:'0 14px', borderRadius:8, border: active ? 'none' : '1px solid rgba(11,31,59,0.15)',
            background: active ? NAVY : 'white', color: active ? 'white' : '#666',
            fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0,
            scrollSnapAlign:'start',
            transition:'background 0.15s, color 0.15s',
          }}>{o.label||o}{o.count != null && <span style={{marginLeft:5,opacity:0.7,fontWeight:500}}>({o.count})</span>}</button>
        );
      })}
    </div>
  );
}

// ── Contacts List ─────────────────────────────────────────────────
// String stage → display palette
const STAGE_COLORS = {
  new:              { color:'#1E40AF', bg:'#EFF6FF', label:'New' },
  quoted:           { color:'#92400E', bg:'#FFF7ED', label:'Quoted' },
  booked:           { color:'#065F46', bg:'#ECFDF5', label:'Booked' },
  permit_submit:    { color:'#9A3412', bg:'#FFF7ED', label:'Permit submit' },
  permit_waiting:   { color:'#1E3A8A', bg:'#EFF6FF', label:'Permit waiting' },
  permit_approved:  { color:'#0E7490', bg:'#ECFEFF', label:'Permit approved' },
  install:          { color:'#5B21B6', bg:'#F5F3FF', label:'Install' },
  done:             { color:'#374151', bg:'#F3F4F6', label:'Done' },
};

function ContactsList({ contacts, messages, calls, onOpen, dncSet = new Set(), activeContactId, proposals = [], invoices = [], events = [] }) {
  const [search, setSearch] = React.useState('');
  const [stage, setStage] = React.useState('all');
  const [newContactOpen, setNewContactOpen] = React.useState(false);
  // Recently-viewed contacts (max 5 chips). Stored by handleOpen in
  // crm-app.jsx — re-render when that fires crm-recent-changed.
  const RECENT_KEY = 'bpp_v3_recent_contacts';
  const [recentIds, setRecentIds] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
  });
  React.useEffect(() => {
    const refresh = () => {
      try { setRecentIds(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); }
      catch {}
    };
    window.addEventListener('crm-recent-changed', refresh);
    return () => window.removeEventListener('crm-recent-changed', refresh);
  }, []);
  // Invalidate the tag-map cache when tags change so the search filter
  // re-reads localStorage on the next keystroke.
  React.useEffect(() => {
    const onTags = () => { window.__tagMapCache = null; };
    window.addEventListener('crm-tags-changed', onTags);
    return () => window.removeEventListener('crm-tags-changed', onTags);
  }, []);
  const recentContacts = recentIds
    .map(id => contacts.find(c => c.id === id && !c.archived))
    .filter(Boolean)
    .slice(0, 5);
  // Pinned contacts persist in localStorage (per-browser, single-user app).
  // The contacts table has no pinned column, so this is the right place.
  const PIN_KEY = 'bpp_v3_pinned_contacts';
  const [pinned, setPinned] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
      return new Set([...stored, ...contacts.filter(c=>c.pinned).map(c=>c.id)]);
    } catch { return new Set(contacts.filter(c=>c.pinned).map(c=>c.id)); }
  });

  // Counts for filter chips — every stage in the canonical order (excludes archived)
  const visibleContacts = contacts.filter(c => !c.archived);
  const stageCounts = CRM.STAGE_ORDER.reduce((acc,s) => ({ ...acc, [s]: visibleContacts.filter(c=>c.stage===s).length }), {});

  // "Needs reply" filter: an inbound message older than the most recent
  // outbound (or no outbound at all). One-glance answer to "who's
  // waiting on me?" — the highest-leverage filter for a solo pipeline.
  const needsReplySet = React.useMemo(() => {
    const set = new Set();
    const byContact = new Map();
    for (const m of messages) {
      if (!byContact.has(m.contact_id)) byContact.set(m.contact_id, []);
      byContact.get(m.contact_id).push(m);
    }
    for (const [cid, msgs] of byContact.entries()) {
      msgs.sort((a,b) => (a.sent_at||'').localeCompare(b.sent_at||''));
      const last = msgs[msgs.length - 1];
      if (last && last.direction === 'in') set.add(cid);
    }
    return set;
  }, [messages]);

  // Recently-called: any call started in the last 24h (in/out/missed)
  const recentCallSet = React.useMemo(() => {
    const set = new Set();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const c of calls) {
      if (c.started_at && new Date(c.started_at).getTime() > cutoff) set.add(c.contact_id);
    }
    return set;
  }, [calls]);

  // Per-contact rot signals (stale quote, $owed, days-since-touch, etc.)
  const signalMap = React.useMemo(
    () => buildContactSignals({ contacts, messages, calls, proposals, invoices, events }),
    [contacts, messages, calls, proposals, invoices, events]
  );

  // "Rotting" — anything Key should chase: stale quote, $owed, or
  // 7+ days since last touch with an active stage.
  const rottingSet = React.useMemo(() => {
    const s = new Set();
    for (const [id, sig] of signalMap.entries()) {
      const c = contacts.find(x => x.id === id);
      if (!c || c.archived) continue;
      const isActiveStage = c.stage !== 'archived' && c.stage !== 'paid';
      const hasRot = sig.stale || sig.outstandingCents > 0 || (isActiveStage && sig.daysSinceTouch != null && sig.daysSinceTouch >= 7);
      if (hasRot) s.add(id);
    }
    return s;
  }, [signalMap, contacts]);

  const stageOpts = [
    { value:'all',        label:'All',          count: visibleContacts.length },
    { value:'rotting',    label:'Rotting',     count: rottingSet.size },
    { value:'needs_reply', label:'Needs reply', count: needsReplySet.size },
    ...CRM.STAGE_ORDER.map(s => ({ value:s, label: STAGE_COLORS[s].label, count: stageCounts[s] }))
  ];

  // A contact has unread if they have an unread inbound message
  const hasUnread = cid => messages.some(m => m.contact_id === cid && m.direction === 'in' && m.read_at == null);
  // Or a missed call we haven't responded to (treat missed as unread signal)
  const hasMissedCall = cid => calls.some(c => c.contact_id === cid && c.direction === 'missed');

  const filtered = contacts
    .filter(c => !c.archived)
    .filter(c => stage === 'all' ? true : stage === 'needs_reply' ? needsReplySet.has(c.id) : stage === 'rotting' ? rottingSet.has(c.id) : c.stage === stage)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      // Tag match — `bpp_v3_tags` is the source of truth for custom
      // labels. Read once per filter loop via lazy memoization on the
      // window so we don't parse JSON 112 times per keystroke.
      if (!window.__tagMapCache) window.__tagMapCache = (function(){ try { return JSON.parse(localStorage.getItem('bpp_v3_tags')||'{}'); } catch { return {}; } })();
      const tags = window.__tagMapCache[c.id] || [];
      return contactName(c).toLowerCase().includes(q)
        || (c.phone || '').includes(search)
        || (c.address || '').toLowerCase().includes(q)
        || tags.some(t => t.toLowerCase().includes(q));
    })
    .sort((a,b) => (pinned.has(b.id)?1:0) - (pinned.has(a.id)?1:0));

  const togglePin = (e, id) => {
    e.stopPropagation();
    const wasOn = pinned.has(id);
    setPinned(p => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      window.safeSetItem?.(PIN_KEY, JSON.stringify([...n]));
      // Notify ContactStrip (right pane) so its pin star re-syncs.
      window.dispatchEvent(new CustomEvent('crm-pin-changed'));
      return n;
    });
    window.showToast?.(wasOn ? 'Unpinned' : 'Pinned to top');
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <PanelHeader title="Contacts" action="Add" onAction={() => setNewContactOpen(true)} right={<PermitPortalsButton />} />
      {newContactOpen && (
        <NewContactModal
          onClose={() => setNewContactOpen(false)}
          onCreated={(id) => { setNewContactOpen(false); onOpen(id, 'contacts'); }}
        />
      )}
      <div style={{ padding:'11px 18px 8px', background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
        <div style={{ position:'relative' }}>
          <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:14,height:14, color:MUTED, pointerEvents:'none' }}>{Icons.search}</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, address…"
            style={{ width:'100%', height:40, borderRadius:8, border:'1.5px solid #EBEBEA', padding:'0 12px 0 30px', fontSize:16, background:BG, outline:'none', fontFamily:'inherit', color:NAVY, boxSizing:'border-box' }} />
        </div>
        {/* Recently-viewed chip row — last 5 opened contacts. Daily
            "I just had them open, where'd they go" loop for a one-man shop
            juggling 3 active jobs. Hidden when a search is active or no
            history yet. */}
        {!search && recentContacts.length > 0 && (
          <div className="hide-scrollbar" style={{ display:'flex', gap:6, overflowX:'auto', marginTop:8, paddingBottom:2 }}>
            <div style={{ fontSize:10, fontWeight:700, color:MUTED, alignSelf:'center', whiteSpace:'nowrap', letterSpacing:'0.05em' }}>RECENT</div>
            {recentContacts.map(c => (
              <button key={c.id} onClick={() => onOpen(c.id, 'contacts')} style={{
                height:26, padding:'0 10px', borderRadius:13, fontFamily:'inherit',
                background: activeContactId === c.id ? NAVY : '#F3F4F6', color: activeContactId === c.id ? 'white' : NAVY,
                border:'none', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
              }}>{contactName(c).split(' ')[0] || formatPhone(c.phone)}</button>
            ))}
          </div>
        )}
      </div>
      <FilterChips options={stageOpts} value={stage} onChange={setStage} />
      {/* Clear-filters affordance — easy to leave a stage filter on, miss
          new leads landing in 'new'. Only renders when a non-default
          filter is active. */}
      {stage !== 'all' && (
        <div style={{ padding:'6px 18px 0', flexShrink:0 }}>
          <button onClick={() => setStage('all')} style={{
            height:24, padding:'0 10px', borderRadius:12, background:'#FEF3C7', color:'#92400E',
            border:'none', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
            <span>Clear filter</span>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>
      )}
      <PullToRefreshList style={{ flex:1, overflowY:'auto', minHeight:0 }} onRefresh={() => window.CRM?.__refetch?.()}>
        {filtered.length === 0 && <EmptyState icon="contacts" text="No contacts match" />}
        {filtered.map(c => {
          const sc = STAGE_COLORS[c.stage];
          const unread = hasUnread(c.id) || hasMissedCall(c.id);
          const isPinned = pinned.has(c.id);
          const isPremium = c.pricing_tier === 'premium' || c.pricing_tier === 'premium_plus';
          const sig = signalMap.get(c.id) || {};
          // Last-message preview: prefer most recent inbound, else outbound.
          // Truncated; relative time. Hidden when DNC pill or other signals
          // would already overflow the row.
          const last = sig.lastMsg;
          const lastPreview = last && last.body
            ? `${last.direction === 'out' ? 'You: ' : ''}${last.body.slice(0, 48)}${last.body.length > 48 ? '…' : ''}`
            : null;
          return (
            // div role=button (not <button>) — the hover preview portals
            // action buttons (Call/Text/Open), and React's validateDOMNesting
            // walks the React tree (not the DOM tree), so portaled buttons
            // inside a <button> still warn. Switching to a div skips the
            // warning while keeping click + keyboard activation intact.
            <div key={c.id} role="button" tabIndex={0}
              onClick={() => onOpen(c.id,'contacts')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(c.id,'contacts'); } }}
              style={{
                width:'100%', background: activeContactId===c.id?'#FFFBEB':'white', border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:10, padding:'13px 18px',
                borderBottom:'1px solid #F5F5F3', textAlign:'left',
                boxShadow: activeContactId===c.id?'inset 2px 0 0 '+GOLD:'none',
                transition:'background 0.15s',
                outline:'none',
            }}>
              <ContactAvatarHoverPreview contact={c} unread={unread} dncSet={dncSet} onOpen={onOpen} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                  {isPremium && window.tweaksGlobal?.premiumDots !== false && <GoldDot />}
                  <span style={{ fontWeight:600, fontSize:14, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>{contactName(c)}</span>
                  {dncSet.has(c.id) && <span style={{ fontSize:9, fontWeight:700, color:'#991B1B', background:'#FEF2F2', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>DNC</span>}
                  {/* Rot pills — at most one renders so the row doesn't bloat.
                      Priority: $owed > stale-quote > needs-reply. Each comes
                      from buildContactSignals so the source of truth is
                      shared with Money + filter logic. */}
                  {sig.outstandingCents > 0 ? (
                    <span title={`Owed${sig.outstandingOldestDays != null ? ` · ${sig.outstandingOldestDays}d` : ''}`} style={{ fontSize:9, fontWeight:700, color:'#9A3412', background:'#FFEDD5', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>
                      {formatMoneyCents(sig.outstandingCents)} OWED
                    </span>
                  ) : sig.veryStale ? (
                    <span title={`Quote sent ${sig.proposalAgeDays}d ago, no response`} style={{ fontSize:9, fontWeight:700, color:'#991B1B', background:'#FEE2E2', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>
                      QUOTE {sig.proposalAgeDays}d
                    </span>
                  ) : sig.stale ? (
                    <span title={`Quote sent ${sig.proposalAgeDays}d ago`} style={{ fontSize:9, fontWeight:700, color:'#92400E', background:'#FEF3C7', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>
                      QUOTE {sig.proposalAgeDays}d
                    </span>
                  ) : needsReplySet.has(c.id) ? (
                    <span style={{ fontSize:9, fontWeight:700, color:'#92400E', background:'#FEF3C7', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>NEEDS REPLY</span>
                  ) : null}
                  {sig.recentlyViewedProposal && !sig.outstandingCents && (
                    <span title="Customer viewed your proposal recently" style={{ fontSize:9, fontWeight:700, color:'#1E40AF', background:'#DBEAFE', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>VIEWED</span>
                  )}
                  {recentCallSet.has(c.id) && <span title="Called within 24h" style={{ fontSize:9, fontWeight:700, color:'#065F46', background:'#D1FAE5', padding:'1px 5px', borderRadius:20, flexShrink:0 }}>📞 24h</span>}
                  {sc && <span style={{ fontSize:10, fontWeight:700, color:sc.color, background:sc.bg, padding:'1px 6px', borderRadius:20, flexShrink:0 }}>{sc.label}</span>}
                </div>
                <div style={{ fontSize:12, color:MUTED, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {formatPhone(c.phone)}{c.address ? ` · ${cityFromAddrShort(c.address)}` : ''}
                  {sig.daysSinceTouch != null && sig.daysSinceTouch >= 7 && (
                    <span title={`Last contact ${sig.daysSinceTouch}d ago`} style={{ marginLeft:6, color: sig.daysSinceTouch >= 14 ? '#DC2626' : '#92400E', fontWeight:600 }}>
                      · {sig.daysSinceTouch}d ago
                    </span>
                  )}
                </div>
                {lastPreview && (
                  <div style={{ fontSize:11, color:'#999', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontStyle:'italic' }}>
                    {lastPreview}
                  </div>
                )}
              </div>
              <div onClick={e=>togglePin(e,c.id)} role="button" tabIndex={0}
                aria-label={isPinned ? 'Unpin contact' : 'Pin contact'}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePin(e, c.id); } }}
                style={{
                  // 44×44 hit area meets iOS HIG even though the visible icon
                  // stays a 14px pixel-art star. Centered via flex.
                  background:'none', cursor:'pointer', flexShrink:0,
                  width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center',
                  color: isPinned ? GOLD : '#D1D5DB',
                }}>
                <svg viewBox="0 0 24 24" fill={isPinned?'currentColor':'none'} stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
            </div>
          );
        })}
      </PullToRefreshList>
    </div>
  );
}

// Pull-to-refresh wrapper. Detects a downward drag from scroll-top and,
// past a 60px threshold, fires onRefresh and shows a quick spinner banner.
// Only the scroll container is gesture-handled — inner content renders
// untouched. iOS Safari already has overscroll bounce; this layers the
// refresh on top without fighting the native gesture.
function PullToRefreshList({ children, onRefresh, style }) {
  const ref = React.useRef(null);
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef(null);
  const armed = React.useRef(false);

  const onTouchStart = (e) => {
    if (!ref.current) return;
    if (ref.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      armed.current = true;
    } else {
      armed.current = false;
    }
  };
  const onTouchMove = (e) => {
    if (!armed.current || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPull(Math.min(80, dy * 0.5));
      // Don't preventDefault — that breaks normal scroll on a slight drag.
    }
  };
  const onTouchEnd = async () => {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= 50 && !refreshing) {
      setRefreshing(true);
      try { await onRefresh?.(); } catch {}
      // Brief settle so the spinner is perceptible before snap-back.
      setTimeout(() => { setRefreshing(false); setPull(0); }, 600);
    } else {
      setPull(0);
    }
  };

  return (
    <div ref={ref} style={style} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={{
        height: refreshing ? 36 : pull, transition: refreshing ? 'none' : 'height 180ms ease-out',
        display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
        color: MUTED, fontSize:11, fontWeight:600, fontFamily:'inherit',
      }}>
        {refreshing ? (
          <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: 'pulse 1s ease-in-out infinite' }}><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 10 15 10"/></svg>
            Refreshing…
          </span>
        ) : pull >= 50 ? 'Release to refresh' : pull > 0 ? 'Pull to refresh' : ''}
      </div>
      {children}
    </div>
  );
}

// ── Calendar List ─────────────────────────────────────────────────
// Event kinds → display palette
const KIND_COLORS = {
  install:   { accent:'#16A34A', bg:'#F0FDF4', label:'Install' },
  inspect:   { accent:'#7C3AED', bg:'#F5F3FF', label:'Inspect' },
  follow_up: { accent:'#EA580C', bg:'#FFF7ED', label:'Follow-up' },
  pickup:    { accent:'#16A34A', bg:'#F0FDF4', label:'Pickup' },
  meeting:   { accent:'#7C3AED', bg:'#F5F3FF', label:'Meeting' },
};

function CalendarList({ events, contacts, onOpen, activeContactId }) {
  const getContact = id => contacts.find(c=>c.id===id);
  const [view, setView] = React.useState('today');
  const [addOpen, setAddOpen] = React.useState(false);
  // Per-event "needs invoice" flag — derived from the global signal map
  // so the rule matches what shows on contact rows + Money tab.
  const invoices = window.CRM?.invoices || [];
  const installNeedsInvoiceContactIds = React.useMemo(() => {
    const s = new Set();
    const sig = buildContactSignals({ contacts, messages: [], calls: [], proposals: [], invoices, events });
    for (const [id, signal] of sig.entries()) if (signal.installNeedsInvoice) s.add(id);
    return s;
  }, [events, invoices, contacts]);

  // Filter to scheduled (canonical: status === 'scheduled'), then sort by start_at.
  const scheduled = events
    .filter(e => e.status === 'scheduled')
    .sort((a,b) => (a.start_at||'').localeCompare(b.start_at||''));

  const todayEvents = scheduled.filter(e => dayKey(e.start_at) === TODAY);
  const upcoming    = scheduled.filter(e => dayKey(e.start_at) >  TODAY);
  const allEvents   = scheduled;

  // 60-min default when end_at is null (most install events have no end_at
  // set yet) so the row never renders "NaNmin".
  const durMin = ev => {
    if (!ev.end_at || !ev.start_at) return 60;
    const m = Math.round((new Date(ev.end_at) - new Date(ev.start_at)) / 60000);
    return Number.isFinite(m) && m > 0 ? m : 60;
  };

  // Real conflict = time overlap with another event on the same day.
  // A.end > B.start && B.end > A.start. Useful in practice; the prior
  // "any event same day" heuristic flagged every install of a busy day
  // as a conflict, which is noise.
  const hasConflict = (ev, all) => {
    const aStart = new Date(ev.start_at).getTime();
    const aEnd = aStart + durMin(ev) * 60000;
    return all.some(o => {
      if (o.id === ev.id || dayKey(o.start_at) !== dayKey(ev.start_at)) return false;
      const bStart = new Date(o.start_at).getTime();
      const bEnd = bStart + durMin(o) * 60000;
      return aEnd > bStart && bEnd > aStart;
    });
  };

  // Group upcoming by day
  const byDate = upcoming.reduce((acc,e) => { const k = dayKey(e.start_at); (acc[k] = acc[k] || []).push(e); return acc; }, {});

  const durationMin = durMin;

  // Today's route — for the "Plan in Maps" button. Builds a Google Maps
  // multi-waypoint URL from the addresses of today's events in time order.
  // Google Maps' /dir/ URL works on iOS (opens Apple Maps via universal
  // link), Android, and desktop. Skips events without addresses.
  const todayWithAddr = todayEvents
    .map(ev => ({ ev, contact: getContact(ev.contact_id) }))
    .filter(({ contact }) => contact && (contact.address || '').trim().length > 5);
  const planRouteUrl = todayWithAddr.length > 0
    ? `https://www.google.com/maps/dir/${todayWithAddr.map(({ contact }) => encodeURIComponent(contact.address)).join('/')}`
    : null;

  const EventCard = ({ ev, highlight }) => {
    const c = getContact(ev.contact_id);
    const col = KIND_COLORS[ev.kind] || KIND_COLORS.meeting;
    const conflict = hasConflict(ev, scheduled);
    // "Needs invoice" — install event is past start_at and no invoice
    // exists for that contact dated after the install. Drives the
    // end-of-day "did you bill them?" prompt.
    const isPastInstall = ev.kind === 'install' && new Date(ev.start_at).getTime() < Date.now();
    const needsInvoice = isPastInstall && installNeedsInvoiceContactIds.has(ev.contact_id);
    return (
      <button onClick={()=>onOpen(ev.contact_id,'calendar',ev.id)} style={{
        width:'100%', background: highlight?'#FFFBEB':(activeContactId===ev.contact_id?'#FFFBEB':'white'), border:'none', cursor:'pointer',
        display:'flex', alignItems:'stretch', borderBottom:'1px solid #F5F5F3', textAlign:'left', padding:0,
        boxShadow: activeContactId===ev.contact_id?'inset 2px 0 0 '+GOLD:'none',
      }}>
        <div style={{ width:3, background: conflict?'#E53E3E':col.accent, margin:'6px 10px 6px 14px', borderRadius:4, flexShrink:0 }} />
        <div style={{ flex:1, padding:'13px 14px 13px 0', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color:NAVY }}>{formatTime(ev.start_at)}</span>
            <span style={{ fontSize:10, fontWeight:700, color:col.accent, background:col.bg, padding:'1px 6px', borderRadius:20 }}>{col.label}</span>
            {conflict && <span style={{ fontSize:10, fontWeight:700, color:'#991B1B', background:'#FEF2F2', padding:'1px 6px', borderRadius:20 }}>⚠ Conflict</span>}
            {needsInvoice && <span title="No invoice yet — bill before this slips" style={{ fontSize:10, fontWeight:700, color:'#9A3412', background:'#FFEDD5', padding:'1px 6px', borderRadius:20 }}>Needs invoice</span>}
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(c)}</div>
          <div style={{ fontSize:11, color:MUTED, marginTop:1 }}>{ev.title} · {durationMin(ev)}min</div>
        </div>
      </button>
    );
  };

  // Filter view options + counts.
  const filterOpts = [
    { value:'today',    label: `Today (${todayEvents.length})` },
    { value:'upcoming', label: `Upcoming (${upcoming.length})` },
    { value:'all',      label: `All (${allEvents.length})` },
  ];

  const visible = view === 'today' ? todayEvents
                : view === 'upcoming' ? upcoming
                : allEvents;
  const visibleByDate = visible.reduce((acc,e) => { const k = dayKey(e.start_at); (acc[k] = acc[k] || []).push(e); return acc; }, {});

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <PanelHeader title="Calendar" action="Add" onAction={() => setAddOpen(true)} />
      {addOpen && window.NewEventModal && (
        <window.NewEventModal contacts={contacts} onClose={() => setAddOpen(false)} />
      )}
      <FilterChips options={filterOpts} value={view} onChange={setView} />
      {/* Today's route banner — only on the Today view, only when at least
          one event has an address. Tapping "Plan route" opens Google Maps
          (which iOS deeplinks to Apple Maps) with all stops in time order. */}
      {view === 'today' && todayEvents.length > 0 && (
        <div style={{ padding:'8px 18px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#92400E', letterSpacing:'0.05em', textTransform:'uppercase' }}>Today's route</div>
            <div style={{ fontSize:12, color:NAVY, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {todayEvents.length} stop{todayEvents.length === 1 ? '' : 's'}
              {todayWithAddr.length < todayEvents.length && <span style={{ color:MUTED, fontWeight:500 }}> · {todayEvents.length - todayWithAddr.length} no address</span>}
            </div>
          </div>
          {planRouteUrl ? (
            <a href={planRouteUrl} target="_blank" rel="noopener noreferrer" style={{
              flexShrink:0, height:32, padding:'0 12px', borderRadius:8,
              background:GOLD, color:NAVY, fontWeight:700, fontSize:12, fontFamily:'inherit',
              textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5,
            }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Plan in Maps
            </a>
          ) : (
            <span style={{ fontSize:11, color:MUTED, flexShrink:0 }}>No addresses yet</span>
          )}
        </div>
      )}
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        {visible.length === 0 && (
          <EmptyState icon="calendar" text={
            view === 'today' ? 'No installs today — open day'
            : view === 'upcoming' ? 'Nothing else scheduled'
            : 'No events on the calendar'
          } />
        )}
        {Object.entries(visibleByDate).map(([date, dayEvents]) => (
          <div key={date}>
            <SectionHeader label={date === TODAY ? `Today — ${formatDate(date, { month:'short', day:'numeric' })}` : formatDate(date)} />
            {dayEvents.map(e => <EventCard key={e.id} ev={e} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Finance List ──────────────────────────────────────────────────
// Mixed list of proposals + invoices, sorted by sent_at desc.
function FinanceList({ proposals, invoices, contacts, events = [], onOpen, activeContactId }) {
  const [view, setView] = React.useState('all'); // 'all' | 'invoices' | 'proposals'
  const getContact = id => contacts.find(c=>c.id===id);

  // Per Key's billing rule: don't count an invoice as Outstanding/Overdue
  // until the contact has actually had their install. Pre-install sent
  // invoices are "Pending install" and shown separately.
  const installedSet = new Set(
    contacts.filter(c => contactHasInstalled(c, events)).map(c => c.id)
  );

  // KPI cards — split by post-install status.
  const sumByStatus = (arr, statuses, filter = () => true) => arr
    .filter(i => statuses.includes(i.status) && filter(i))
    .reduce((s,i) => s + i.amount_cents, 0);

  const outstanding   = sumByStatus(invoices, ['sent','viewed'], i => installedSet.has(i.contact_id));
  const overdue       = sumByStatus(invoices, ['overdue'],       i => installedSet.has(i.contact_id));
  const paidWeek      = sumByStatus(invoices, ['paid']);
  const pendingInstall = sumByStatus(invoices, ['sent','viewed'], i => !installedSet.has(i.contact_id));

  // Top owed — only contacts past install. Pre-install contacts go in
  // the "Pending install" pile, not Top Owed.
  const owedByContact = invoices
    .filter(i => (i.status === 'sent' || i.status === 'overdue') && installedSet.has(i.contact_id))
    .reduce((m, i) => {
      m.set(i.contact_id, (m.get(i.contact_id) || 0) + (i.amount_cents || 0));
      return m;
    }, new Map());
  const topOwed = [...owedByContact.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Aged receivables — bucket outstanding (post-install) invoices by
  // age in days. 90+ day items signal write-off risk.
  const aged = invoices
    .filter(i => (i.status === 'sent' || i.status === 'overdue') && installedSet.has(i.contact_id))
    .reduce((acc, i) => {
      const t = i.sent_at || i.created_at;
      if (!t) return acc;
      const days = Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000));
      const bucket = days <= 30 ? '0_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : '90p';
      acc[bucket] = (acc[bucket] || 0) + (i.amount_cents || 0);
      return acc;
    }, {});

  // Counts for sub-tab pills
  const invCounts = invoices.reduce((acc,i)=>({...acc,[i.status]:(acc[i.status]||0)+1}),{});
  const proCounts = proposals.reduce((acc,p)=>({...acc,[p.status]:(acc[p.status]||0)+1}),{});

  // This-month revenue pulse — total of paid invoices this calendar
  // month vs the prior month. Single number; the trend arrow is the
  // signal Key is looking for ("am I trending up?").
  const monthRevenue = React.useMemo(() => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    let curr = 0, last = 0;
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      const t = inv.paid_at || inv.sent_at || inv.created_at;
      if (!t) continue;
      const k = t.slice(0, 7);
      if (k === thisMonthKey) curr += inv.amount_cents || 0;
      else if (k === prevMonthKey) last += inv.amount_cents || 0;
    }
    const pct = last > 0 ? Math.round(((curr - last) / last) * 100) : (curr > 0 ? null : 0);
    const monthLabel = now.toLocaleDateString('en-US', { month:'long' });
    const prevLabel = prev.toLocaleDateString('en-US', { month:'short' });
    return { curr, last, pct, monthLabel, prevLabel };
  }, [invoices]);

  // Build mixed display list
  const tagged = [
    ...proposals.map(p => ({ ...p, _kind:'proposal' })),
    ...invoices.map(i => ({ ...i, _kind:'invoice' })),
  ].sort((a,b) => (b.sent_at||'').localeCompare(a.sent_at||''));

  const visible = view === 'all' ? tagged
                : view === 'invoices' ? tagged.filter(x => x._kind === 'invoice')
                : tagged.filter(x => x._kind === 'proposal');

  const exportCSV = () => {
    const rows = [
      ['Type','Contact','Label','Amount','Status','Sent'],
      ...invoices.map(i => { const c = getContact(i.contact_id); return ['Invoice',contactName(c),capitalize(i.kind)+' invoice',(i.amount_cents/100).toFixed(2),i.status,dayKey(i.sent_at||'')]; }),
      ...proposals.map(p => { const c = getContact(p.contact_id); return ['Proposal',contactName(c),p.label,(p.amount_cents/100).toFixed(2),p.status,dayKey(p.sent_at||'')]; }),
    ];
    // CSV cell escaping: every cell quoted, embedded quotes doubled, and
    // formula-prefix chars (=,+,-,@,tab,CR) get a leading single-quote so
    // Excel/Sheets don't auto-execute "=cmd|/c calc" or split a "Smith,
    // Bob" into two columns.
    const escapeCell = (val) => {
      let s = (val == null ? '' : String(val));
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = rows.map(r => r.map(escapeCell).join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = 'key-finance.csv'; a.click();
  };

  const [quickQuoteOpen, setQuickQuoteOpen] = React.useState(false);

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <PanelHeader title="Money" right={
        <>
          <button onClick={exportCSV} style={{ fontSize:12, fontWeight:600, color:MUTED, background:'none', border:'1px solid #EBEBEA', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit' }}>Export CSV</button>
          <button onClick={()=>setQuickQuoteOpen(true)} style={{
            background:'#ffba00', color:NAVY, border:'none', borderRadius:8,
            padding:'6px 12px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:5,
          }}>Quick quote</button>
        </>
      } />
      {/* This-month revenue pulse — single number with trend arrow vs
          last month. Hidden when both months are $0 (fresh account). */}
      {(monthRevenue.curr > 0 || monthRevenue.last > 0) && (
        <div style={{ background:'#F0FDF4', borderBottom:'1px solid #BBF7D0', padding:'10px 18px', flexShrink:0, display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#065F46', letterSpacing:'0.05em', textTransform:'uppercase' }}>{monthRevenue.monthLabel}</span>
          <span style={{ fontSize:18, fontWeight:700, color:NAVY, letterSpacing:'-0.5px' }}>{formatMoneyCents(monthRevenue.curr)}</span>
          {monthRevenue.pct != null && monthRevenue.last > 0 && (
            <span style={{ fontSize:11, fontWeight:600, color: monthRevenue.pct >= 0 ? '#15803D' : '#991B1B' }}>
              {monthRevenue.pct >= 0 ? '↑' : '↓'} {Math.abs(monthRevenue.pct)}% vs {monthRevenue.prevLabel}
            </span>
          )}
          {monthRevenue.pct == null && monthRevenue.last === 0 && (
            <span style={{ fontSize:11, color:MUTED }}>· first month with sales</span>
          )}
        </div>
      )}
      {/* KPI Cards — Pending install replaces a regular metric since pre-
          install sent invoices aren't "owed" yet per Key's billing rule. */}
      <div style={{ display:'flex', background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
        {[
          { label:'Outstanding', val:outstanding,    color:'#1E40AF', sub:'after install' },
          { label:'Overdue',     val:overdue,        color:'#991B1B' },
          { label:'Pending',     val:pendingInstall, color:'#0F766E', sub:'pre-install' },
          { label:'Paid',        val:paidWeek,       color:'#065F46' },
        ].map((k,i)=>(
          <div key={k.label} style={{ flex:1, padding:'10px 12px', borderRight:i<3?'1px solid #F0F0EE':'none' }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:k.color, letterSpacing:'-0.5px' }}>{formatMoneyCents(k.val)}</div>
            {k.sub && <div style={{ fontSize:9, color:MUTED, marginTop:1, fontWeight:500 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
      {/* Aged receivables — only renders when there's any outstanding
          (post-install) balance. Helps Key prioritize: 90+ days = call
          today, 60-90 = remind, 30-60 = monitor. */}
      {(aged['0_30'] || aged['31_60'] || aged['61_90'] || aged['90p']) && (
        <div style={{ background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0, padding:'10px 18px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Aged receivables</div>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { label:'0-30',  val: aged['0_30']  || 0, color:'#0F766E' },
              { label:'31-60', val: aged['31_60'] || 0, color:'#92400E' },
              { label:'61-90', val: aged['61_90'] || 0, color:'#B45309' },
              { label:'90+',   val: aged['90p']   || 0, color:'#991B1B' },
            ].map(b => (
              <div key={b.label} style={{ flex:1, padding:'6px 8px', background: b.val>0 ? `${b.color}10` : '#F5F5F3', borderRadius:6, textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:b.val>0?b.color:MUTED, letterSpacing:'0.05em' }}>{b.label}d</div>
                <div style={{ fontSize:13, fontWeight:700, color:b.val>0?b.color:MUTED, fontFamily:"'DM Mono', monospace", marginTop:2 }}>{formatMoneyCents(b.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Top owed — only renders when ≥1 contact has unpaid balance.
          Tap a row to jump to that contact's Finance tab to chase. */}
      {topOwed.length > 0 && (
        <div style={{ background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
          <div style={{ padding:'10px 18px 6px', fontSize:10, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.08em' }}>Top owed</div>
          {topOwed.map(([contactId, cents]) => {
            const c = getContact(contactId);
            const isOver = invoices.some(i => i.contact_id === contactId && i.status === 'overdue');
            return (
              <button key={contactId} onClick={() => onOpen(contactId, 'finance')} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'8px 18px', borderTop:'1px solid #F5F5F3',
                background:'white', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left',
              }}>
                <span style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(c)}</span>
                {isOver && <span style={{ fontSize:9, fontWeight:700, color:'#991B1B', background:'#FEF2F2', padding:'1px 6px', borderRadius:20, letterSpacing:'0.04em' }}>OVERDUE</span>}
                <span style={{ fontSize:13, fontWeight:700, color: isOver ? '#991B1B' : NAVY, fontFamily:"'DM Mono', monospace", flexShrink:0 }}>{formatMoneyCents(cents)}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* Sub-tabs */}
      <div style={{ display:'flex', padding:'11px 18px 8px', gap:6, background:BG, borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
        {[
          { v:'all',       label:'All',       counts:{} },
          { v:'invoices',  label:'Invoices',  counts:invCounts },
          { v:'proposals', label:'Proposals', counts:proCounts },
        ].map(({v,label,counts})=>(
          <button key={v} onClick={()=>setView(v)} style={{ height:32, padding:'0 14px', borderRadius:8, border:'none', cursor:'pointer', background:view===v?NAVY:'white', color:view===v?'white':MUTED, fontWeight:600, fontSize:13, fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            {label}
            <div style={{ display:'flex', gap:3 }}>
              {Object.entries(counts).map(([s,n]) => <span key={s} style={{ fontSize:10, fontWeight:700, color:view===v?'rgba(255,255,255,0.7)':MUTED, background:view===v?'rgba(255,255,255,0.15)':'#F0F0EE', borderRadius:20, padding:'0 5px' }}>{n}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        {visible.length === 0 && <EmptyState icon="finance" text="No finance records" />}
        {visible.map(item => {
          const c = getContact(item.contact_id);
          const itemLabel = item._kind === 'proposal' ? item.label : capitalize(item.kind) + ' invoice';
          return (
            <button key={item.id} onClick={()=>onOpen(item.contact_id,'finance',item.id)} style={{ width:'100%', background: activeContactId===item.contact_id?'#FFFBEB':'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid #F5F5F3', textAlign:'left', boxShadow: activeContactId===item.contact_id?'inset 2px 0 0 '+GOLD:'none' }}>
              <ContactAvatar contact={c} size={36} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontWeight:600, fontSize:14, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(c)}</span>
                  <StatusPill status={item.status} />
                  <span style={{ fontSize:9, fontWeight:700, color:MUTED, background:BG, padding:'1px 5px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.04em' }}>{item._kind === 'proposal' ? 'Quote' : 'Invoice'}</span>
                </div>
                <div style={{ fontSize:11, color:MUTED, marginTop:1 }}>{itemLabel}</div>
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:NAVY, flexShrink:0 }}>{formatMoneyCents(item.amount_cents)}</div>
            </button>
          );
        })}
      </div>
      {quickQuoteOpen && <QuickQuoteModal onClose={()=>setQuickQuoteOpen(false)} />}
    </div>
  );
}

// ── Quick Quote Modal (ephemeral price calculator — no save/send/DB) ────
const QQ_BASE = {
  '30A': { standard: 119700, premium: 129700, premium_plus: 139700 },
  '50A': { standard: 129700, premium: 139700, premium_plus: 149700 },
};
const QQ_ADDONS = [
  { id:'cord',          label:'Generator cord',  price:9900  },
  { id:'surge',         label:'Surge protector', price:7900  },
  { id:'peace_of_mind', label:'Peace of mind',   price:0     },
  { id:'permit',        label:'Permit',          price:14500 },
];

function QuickQuoteModal({ onClose }) {
  const [amp, setAmp] = React.useState('30A');
  const [tier, setTier] = React.useState('standard');
  const [addons, setAddons] = React.useState({});

  React.useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reset = () => { setAmp('30A'); setTier('standard'); setAddons({}); };

  const total = QQ_BASE[amp][tier] + QQ_ADDONS.reduce((s,a) => s + (addons[a.id] ? a.price : 0), 0);

  const Eyebrow = ({ children }) => (
    <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{children}</div>
  );

  const segBtn = (active) => ({
    flex:1, height:36, borderRadius:8,
    background: active ? NAVY : 'white',
    color: active ? 'white' : NAVY,
    border: active ? 'none' : '1px solid rgba(27,43,75,0.15)',
    fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
  });

  const chipBtn = (active) => ({
    height:28, padding:'0 12px', borderRadius:12,
    background: active ? '#ffba00' : 'white',
    color: NAVY,
    border: active ? 'none' : '1px solid rgba(27,43,75,0.15)',
    fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:5,
    whiteSpace:'nowrap',
  });

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(11,31,59,0.4)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:200,
      padding:16,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:380, maxWidth:'100%', background:'white',
        border:'1px solid rgba(11,31,59,0.12)', borderRadius:12,
        padding:20, fontFamily:'inherit',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <span style={{ fontSize:18, fontWeight:600, color:NAVY }}>Quick quote</span>
          <button onClick={onClose} aria-label="Close" style={{
            width:28, height:28, borderRadius:6, border:'none', background:'none',
            color:'#666', fontSize:18, cursor:'pointer', fontFamily:'inherit', lineHeight:1,
          }}>×</button>
        </div>

        <Eyebrow>Amp</Eyebrow>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {['30A','50A'].map(a => (
            <button key={a} onClick={()=>setAmp(a)} style={segBtn(amp===a)}>{a}</button>
          ))}
        </div>

        <Eyebrow>Tier</Eyebrow>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[
            { v:'standard',     label:'Standard'  },
            { v:'premium',      label:'Premium'   },
            { v:'premium_plus', label:'Premium+'  },
          ].map(t => (
            <button key={t.v} onClick={()=>setTier(t.v)} style={segBtn(tier===t.v)}>{t.label}</button>
          ))}
        </div>

        <Eyebrow>Add-ons</Eyebrow>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
          {QQ_ADDONS.map(a => {
            const on = !!addons[a.id];
            return (
              <button key={a.id} onClick={()=>setAddons(s => ({...s, [a.id]: !s[a.id]}))} style={chipBtn(on)}>
                <span>{a.label}</span>
                <span style={{ color: on ? NAVY : '#666', fontSize:11, fontFamily:"'DM Mono', monospace" }}>+{formatMoneyCents(a.price)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:16, paddingTop:14, borderTop:'1px solid rgba(11,31,59,0.08)' }}>
          <span style={{ fontSize:13, color:'#666', fontWeight:500 }}>Total</span>
          <span style={{ fontFamily:"'JetBrains Mono', 'DM Mono', monospace", fontSize:28, fontWeight:700, color:NAVY }}>{formatMoneyCents(total)}</span>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={reset} style={{
            flex:1, height:36, borderRadius:8,
            background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)',
            fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>Reset</button>
          <button onClick={onClose} style={{
            flex:1, height:36, borderRadius:8,
            background:'#ffba00', color:NAVY, border:'none',
            fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Messages List ─────────────────────────────────────────────────
// One row per contact = latest message for that contact, sorted by sent_at desc.
function MessagesList({ messages, calls, contacts, onOpen, activeContactId }) {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  // Mark-all-read writes to DB so the next page load doesn't re-light the
  // unread badges. We optimistically stamp every inbound unread message
  // locally, then persist with a single bulk update. Rollback is acceptable
  // given the badge state itself isn't load-bearing — the messages still
  // open the same thread either way.
  const markAllRead = async () => {
    const now = new Date().toISOString();
    const targets = (window.CRM?.messages || []).filter(m => m.direction === 'in' && m.read_at == null);
    if (targets.length === 0) return;
    targets.forEach(m => { m.read_at = now; });
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    if (CRM.__db) {
      const ids = targets.map(m => m.id);
      const { error } = await CRM.__db.from('messages').update({ read_at: now }).in('id', ids);
      if (error) {
        // Roll back local stamps on persistent failure.
        targets.forEach(m => { m.read_at = null; });
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        window.showToast?.(`Mark all read failed: ${error.message}`);
        return;
      }
    }
    window.showToast?.('All marked read');
  };

  // Index messages by contact_id once so building entries is O(messages)
  // instead of O(contacts × messages). Same trick for calls.
  const msgsByContact = React.useMemo(() => {
    const m = new Map();
    for (const x of messages) {
      if (!m.has(x.contact_id)) m.set(x.contact_id, []);
      m.get(x.contact_id).push(x);
    }
    for (const arr of m.values()) arr.sort((a,b) => (a.sent_at||'').localeCompare(b.sent_at||''));
    return m;
  }, [messages]);
  const callsByContact = React.useMemo(() => {
    const m = new Map();
    for (const x of calls) {
      if (!m.has(x.contact_id)) m.set(x.contact_id, []);
      m.get(x.contact_id).push(x);
    }
    return m;
  }, [calls]);

  // Build entries: contacts.map(c => latest message for c.id).filter(present).sort
  const entries = contacts.map(c => {
    const cMsgs = msgsByContact.get(c.id) || [];
    const last = cMsgs[cMsgs.length - 1];
    const cCalls = callsByContact.get(c.id) || [];
    const hasVm = cCalls.some(cl => cl.voicemail_url);
    const unread = cMsgs.filter(m => m.direction === 'in' && m.read_at == null).length;
    return { contact: c, last, cCalls, hasVm, unread };
  })
    .filter(e => e.last || e.cCalls.length > 0)
    .sort((a,b) => (b.last?.sent_at || '').localeCompare(a.last?.sent_at || ''));

  const totalUnread = entries.reduce((s,e) => s + e.unread, 0);

  const filterOpts = [
    { value:'all', label:'All' },
    { value:'waiting', label:'Waiting' },
    { value:'me', label:'From me' },
    { value:'voicemail', label:'Voicemail' },
  ];

  const filtered = entries
    .filter(e => !search || contactName(e.contact).toLowerCase().includes(search.toLowerCase()))
    .filter(e => {
      if (filter === 'waiting')   return e.unread > 0;
      if (filter === 'me')        return e.last?.direction === 'out';
      if (filter === 'voicemail') return e.hasVm;
      return true;
    });

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <PanelHeader title="Inbox" count={totalUnread > 0 ? `${totalUnread} unread` : null}
        right={<button onClick={markAllRead} style={{ fontSize:12, fontWeight:600, color:MUTED, background:'none', border:'1px solid #EBEBEA', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit' }}>Mark all read</button>}
      />
      <div style={{ padding:'11px 18px 8px', background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
        <div style={{ position:'relative' }}>
          <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:13,height:13, color:MUTED, pointerEvents:'none' }}>{Icons.search}</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages…"
            style={{ width:'100%', height:40, borderRadius:8, border:'1.5px solid #EBEBEA', padding:'0 12px 0 28px', fontSize:16, background:BG, outline:'none', fontFamily:'inherit', color:NAVY, boxSizing:'border-box' }} />
        </div>
      </div>
      <FilterChips options={filterOpts} value={filter} onChange={setFilter} />
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        {filtered.length === 0 && (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <div style={{ width:32, height:32, margin:'0 auto 10px', opacity:0.25, color:MUTED }}>{Icons.messages}</div>
            <div style={{ fontSize:13, color:MUTED, fontWeight:500 }}>No threads match</div>
          </div>
        )}
        {filtered.map(({contact, last, hasVm, unread}) => (
          <button key={contact.id} onClick={()=>onOpen(contact.id,'messages')} style={{ width:'100%', background: activeContactId===contact.id?'#FFFBEB':'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid #F5F5F3', textAlign:'left', boxShadow: activeContactId===contact.id?'inset 2px 0 0 '+GOLD:'none' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <ContactAvatar contact={contact} size={42} />
              {hasVm && <div style={{ position:'absolute',bottom:0,right:0,width:14,height:14,borderRadius:'50%',background:'#7C3AED',border:'2px solid white',display:'flex',alignItems:'center',justifyContent:'center',color:'white' }}><div style={{width:7,height:7}}>{Icons.voicemail}</div></div>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ fontWeight:unread > 0 ? 700 : 500, fontSize:14, color:NAVY }}>{contactName(contact)}</span>
                <span style={{ fontSize:11, color:MUTED, flexShrink:0 }}>{last ? formatRelative(last.sent_at) : ''}</span>
              </div>
              <div style={{ fontSize:12, color:unread > 0 ? NAVY : MUTED, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:unread > 0 ? 500 : 400 }}>
                {last ? (last.direction === 'out' ? 'You: ' : '') + last.body : ''}
              </div>
            </div>
            {unread > 0 && <div style={{ minWidth:20,height:20,borderRadius:9999,padding:'0 5px',background:NAVY,color:'white',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{unread}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Calls List ────────────────────────────────────────────────────
const CALL_PALETTE = {
  in:     { color:'#065F46', bg:'#ECFDF5', label:'Incoming' },
  out:    { color:'#1E40AF', bg:'#EFF6FF', label:'Outgoing' },
  missed: { color:'#991B1B', bg:'#FEF2F2', label:'Missed'   },
};

function CallsList({ calls, contacts, onOpen, activeContactId }) {
  const getContact = id => contacts.find(c => c.id === id);

  const sorted = [...calls].sort((a,b) => (b.started_at||'').localeCompare(a.started_at||''));
  const todayCalls   = sorted.filter(c => dayKey(c.started_at) === TODAY);
  const callbackQueue = sorted.filter(c => c.direction === 'missed');
  const voicemails   = sorted.filter(c => c.voicemail_url);

  const [filter, setFilter] = React.useState('all');
  const [dial, setDial] = React.useState('');

  const filterOpts = [
    { value:'all',        label:'All',         count: sorted.length },
    { value:'missed',     label:'Missed',      count: callbackQueue.length },
    { value:'voicemails', label:'Voicemails',  count: voicemails.length },
    { value:'today',      label:'Today',       count: todayCalls.length },
  ];

  const visible = filter === 'missed'     ? callbackQueue
                : filter === 'voicemails' ? voicemails
                : filter === 'today'      ? todayCalls
                : sorted;

  // Allow quick-dial: paste a number, tap to call. Uses tel: handoff
  // through the iPhone dialer (not a Twilio browser-call).
  const dialDigits = (dial || '').replace(/\D/g, '');
  const dialValid = dialDigits.length >= 7;
  const dialHref = dialValid ? `tel:${dial.startsWith('+') ? dial : '+' + dialDigits}` : undefined;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <PanelHeader title="Calls" right={<span style={{ fontSize:12, color:MUTED, fontWeight:500 }}>{todayCalls.length} today</span>} />

      {/* Quick dial — paste a number from caller-ID and tap to call.
          Uses the system dialer (no Twilio browser-call). */}
      <div style={{ padding:'10px 18px', background:'white', borderBottom:'1px solid #EBEBEA', flexShrink:0, display:'flex', gap:8 }}>
        <input
          value={dial}
          onChange={e => setDial(e.target.value)}
          placeholder="Quick dial — paste a phone number"
          type="tel"
          inputMode="tel"
          style={{ flex:1, height:40, borderRadius:8, border:'1.5px solid #EBEBEA', padding:'0 12px', fontSize:16, background:BG, outline:'none', fontFamily:'inherit', color:NAVY, boxSizing:'border-box' }}
        />
        <a
          href={dialHref}
          aria-disabled={!dialValid}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            minWidth:64, height:40, borderRadius:8, padding:'0 14px',
            background: dialValid ? GOLD : '#E5E7EB',
            color: dialValid ? NAVY : MUTED,
            fontSize:13, fontWeight:600, fontFamily:'inherit',
            textDecoration:'none', whiteSpace:'nowrap',
            pointerEvents: dialValid ? 'auto' : 'none',
          }}
        >Call</a>
      </div>

      <FilterChips options={filterOpts.map(o => ({ value:o.value, label: o.count > 0 ? `${o.label} (${o.count})` : o.label }))} value={filter} onChange={setFilter} />
      {callbackQueue.length > 0 && (
        <div style={{ background:'#FEF2F2', borderBottom:'1px solid #FEE2E2', padding:'8px 16px', flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#991B1B', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Callback Queue · {callbackQueue.length}</div>
          {callbackQueue.map(cl => {
            const c = getContact(cl.contact_id);
            return (
              <div key={cl.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#991B1B', flex:1 }}>{contactName(c)} — {formatPhone(c?.phone)}</span>
                <button onClick={()=>onOpen(cl.contact_id,'calls')} style={{ fontSize:11, fontWeight:700, color:'white', background:'#991B1B', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>Call</button>
              </div>
            );
          })}
        </div>
      )}
      {voicemails.length > 0 && (
        <>
          <SectionHeader label={`Voicemails (${voicemails.length})`} badge={voicemails.length} />
          {voicemails.map(cl => {
            const c = getContact(cl.contact_id);
            return (
              <button key={cl.id} onClick={()=>onOpen(cl.contact_id,'calls')} style={{ width:'100%', background: activeContactId===cl.contact_id?'#FFFBEB':'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid #F5F5F3', textAlign:'left', boxShadow: activeContactId===cl.contact_id?'inset 2px 0 0 '+GOLD:'none' }}>
                <div style={{ width:40,height:40,borderRadius:'50%',background:'#EDE9FE',display:'flex',alignItems:'center',justifyContent:'center',color:'#7C3AED',flexShrink:0 }}><div style={{width:18,height:18}}>{Icons.voicemail}</div></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:NAVY }}>{contactName(c)}</span>
                  </div>
                  <div style={{ fontSize:11, color:MUTED, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{cl.voicemail_transcript}"</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:NAVY }}>{formatDuration(cl.duration_sec)}</div>
                  <div style={{ fontSize:10, color:MUTED }}>{formatRelative(cl.started_at)}</div>
                </div>
              </button>
            );
          })}
        </>
      )}
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        <SectionHeader label={filter === 'all' ? 'Recent calls' : filterOpts.find(o => o.value===filter)?.label || ''} />
        {visible.length === 0 && (
          <div style={{ padding:'32px 24px', textAlign:'center', color:MUTED }}>
            <div style={{ width:36, height:36, margin:'0 auto 10px', opacity:0.3 }}>{Icons.calls}</div>
            <div style={{ fontSize:13, fontWeight:600, color:NAVY, marginBottom:4 }}>
              {filter === 'all'        ? 'No call history yet'
              : filter === 'missed'    ? 'No missed calls'
              : filter === 'voicemails'? 'No voicemails'
              : 'No calls today'}
            </div>
            <div style={{ fontSize:12, color:MUTED, lineHeight:1.5, maxWidth:280, margin:'0 auto' }}>
              Customer calls to {formatPhone('8648637800')} land here automatically when the Twilio webhook is wired.
            </div>
          </div>
        )}
        {visible.map(cl => {
          const c = getContact(cl.contact_id);
          const p = CALL_PALETTE[cl.direction] || CALL_PALETTE.out;
          const hasVm = !!cl.voicemail_url;
          return (
            <button key={cl.id} onClick={()=>onOpen(cl.contact_id,'calls')} style={{ width:'100%', background: activeContactId===cl.contact_id?'#FFFBEB':'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid #F5F5F3', textAlign:'left' }}>
              <div style={{ width:40,height:40,borderRadius:'50%',background: hasVm?'#EDE9FE':p.bg,display:'flex',alignItems:'center',justifyContent:'center',color: hasVm?'#7C3AED':p.color,flexShrink:0 }}>
                <div style={{width:18,height:18}}>{hasVm ? Icons.voicemail : Icons.calls}</div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontWeight:600, fontSize:13, color:NAVY }}>{contactName(c)}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:p.color, background:p.bg, padding:'1px 6px', borderRadius:20 }}>{p.label}</span>
                </div>
                <div style={{ fontSize:11, color:MUTED, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {hasVm ? `"${cl.voicemail_transcript || 'voicemail'}"` : `${formatPhone(c?.phone)} · ${formatRelative(cl.started_at)}`}
                </div>
              </div>
              {cl.direction !== 'missed' && <div style={{ fontSize:12, color:MUTED, flexShrink:0 }}>{formatDuration(cl.duration_sec)}</div>}
            </button>
          );
        })}

        {/* Voicemail / number setup card — always visible at bottom of the
            Calls tab. Honest copy: settings live in Twilio (we don't store
            a custom greeting locally), so the button opens the Twilio
            console for the BPP number. */}
        <div style={{ padding:'18px 18px 24px', borderTop:'1px solid #EBEBEA', marginTop:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Voicemail & numbers</div>
          <div style={{ background:'white', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Main line</div>
                <div style={{ fontSize:15, fontWeight:700, color:NAVY, fontFamily:"'DM Mono', monospace", marginTop:2 }}>(864) 863-7800</div>
              </div>
              <a href={`tel:+18648637800`} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', height:36, padding:'0 14px', borderRadius:8, background:GOLD, color:NAVY, fontSize:12, fontWeight:600, fontFamily:'inherit', textDecoration:'none' }}>Call</a>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Auto-response (Quo)</div>
                <div style={{ fontSize:15, fontWeight:700, color:NAVY, fontFamily:"'DM Mono', monospace", marginTop:2 }}>(864) 400-5302</div>
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:MUTED }}>Porting to Twilio</span>
            </div>
            <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" target="_blank" rel="noopener noreferrer"
               style={{ display:'flex', alignItems:'center', justifyContent:'center', height:40, marginTop:6, borderRadius:8, background:'white', color:NAVY, border:'1px solid rgba(11,31,59,0.15)', fontSize:13, fontWeight:600, fontFamily:'inherit', textDecoration:'none', gap:6 }}>
              Manage greeting + routing in Twilio ↗
            </a>
            <div style={{ fontSize:11, color:MUTED, marginTop:8, lineHeight:1.5 }}>
              Greeting, business-hours routing, and the answering-machine detection live in the Twilio console. Edit there; missed calls + transcripts land back here automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────
function SectionHeader({ label, badge }) {
  return (
    <div style={{ padding:'10px 18px 6px', fontSize:10, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.08em', background:BG, display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid #EBEBEA', flexShrink:0 }}>
      {label}
      {badge>0 && <span style={{ background:NAVY, color:'white', borderRadius:20, fontSize:9, fontWeight:700, padding:'1px 5px' }}>{badge}</span>}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ padding:'36px 24px', textAlign:'center', color:MUTED }}>
      <div style={{ width:28,height:28,margin:'0 auto 10px',opacity:0.25 }}>{Icons[icon]||Icons.contacts}</div>
      <div style={{ fontSize:13 }}>{text}</div>
    </div>
  );
}

// Note: cityFromAddrShort is intentionally NOT exported — the smarter
// cityFromAddress lives in crm-data.js and stays the global one.
Object.assign(window, { LeftPanel, SectionHeader, EmptyState, PanelHeader, KIND_COLORS, FilterChips, contactName, TODAY });
