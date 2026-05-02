// crm-right.jsx — Right panel: contact detail, 5 fully-featured tabs.
// Consumes canonical DB-shape arrays directly. Each tab filters by contact_id inline.

function RightPanel({ contactId, tab, dncSet = new Set(), toggleDnc = () => {}, highlightId, bumpData, onOpenTab }) {
  const { contacts, events, proposals, invoices, messages, calls, permits, materials } = CRM;
  const contact = contacts.find(c => c.id === contactId);

  if (!contact) return <EmptyHero />;

  // Per-tab filtered slices (derived inline)
  const cEvents    = events.filter(e => e.contact_id === contactId);
  const cProposals = proposals.filter(p => p.contact_id === contactId);
  const cInvoices  = invoices.filter(i => i.contact_id === contactId);
  const cMessages  = messages.filter(m => m.contact_id === contactId);
  const cCalls     = calls.filter(cl => cl.contact_id === contactId);
  const cPermits   = permits.filter(p => p.contact_id === contactId);
  const cMaterials = (materials || []).filter(m => m.contact_id === contactId);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:BG, minHeight:0 }}>
      <ContactStrip contact={contact} isDnc={dncSet.has(contactId)} toggleDnc={() => toggleDnc(contactId)} bumpData={bumpData} />
      {tab==='contacts' && <ContactOverview contact={contact} events={cEvents} permits={cPermits} proposals={cProposals} invoices={cInvoices} materials={cMaterials} bumpData={bumpData} onOpenTab={onOpenTab} />}
      {tab==='calendar' && <ContactCalendar contact={contact} events={cEvents} highlightId={highlightId} bumpData={bumpData} />}
      {tab==='finance'  && <ContactFinance  contact={contact} proposals={cProposals} invoices={cInvoices} highlightId={highlightId} />}
      {tab==='messages' && <ContactMessages contact={contact} thread={cMessages} isDnc={dncSet.has(contactId)} />}
      {tab==='calls'    && <ContactCalls    contact={contact} calls={cCalls} isDnc={dncSet.has(contactId)} />}
    </div>
  );
}

// ── Contact Strip ─────────────────────────────────────────────────
// Compact strip — keeps the navigation context (name + ••• menu) sticky at
// the top of the right pane. The richer hero (with house image, big name
// overlay, status pill) lives inside ContactInfoSection on the Contact tab.
function ContactStrip({ contact, isDnc, toggleDnc, bumpData }) {
  const isPremium = contact.pricing_tier === 'premium' || contact.pricing_tier === 'premium_plus';
  return (
    <div style={{ height:60, background:'white', borderBottom:'1px solid #EBEBEA', padding:'0 18px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
      <ContactAvatar contact={contact} size={32} />
      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
        {isPremium && window.tweaksGlobal?.premiumDots !== false && <GoldDot />}
        <span style={{ fontSize:14, fontWeight:700, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(contact)}</span>
        {isDnc && <span style={{ fontSize:9,fontWeight:700,color:'#991B1B',background:'#FEF2F2',padding:'1px 6px',borderRadius:20, flexShrink:0 }}>DO NOT CONTACT</span>}
      </div>
      <ContactOverflowMenu contact={contact} isDnc={isDnc} toggleDnc={toggleDnc} bumpData={bumpData} />
    </div>
  );
}

// ── Overflow Menu (right-aligned dropdown anchored to the 3-dots button) ─
function ContactOverflowMenu({ contact, isDnc, toggleDnc, bumpData }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

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

  const close = () => setOpen(false);

  const editContact = () => {
    close();
    window.dispatchEvent(new CustomEvent('crm-edit-contact', { detail: { contactId: contact.id } }));
  };

  const openInMaps = () => {
    close();
    window.open(`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`, '_blank', 'noopener');
  };

  const copyPhone = async () => {
    close();
    try {
      await navigator.clipboard.writeText(contact.phone);
      window.showToast?.('Phone copied');
    } catch {
      window.showToast?.('Copy failed');
    }
  };

  // Sweep all per-contact local caches so an archive doesn't leak its
  // drive-time, geocode, job-photos, or pinned status forward indefinitely.
  // Wrapped here so archive + delete share the cleanup.
  const sweepContactLocal = (contactId) => {
    try {
      localStorage.removeItem('bpp_v3_drive:' + contactId);
      localStorage.removeItem('bpp_v3_job_photos:' + contactId);
      // Drop the message-compose draft for this contact too — otherwise
      // a soft-archived contact can resurface their old draft if the
      // status flips back to Active.
      sessionStorage.removeItem('draft:' + contactId);
      const pinRaw = localStorage.getItem('bpp_v3_pinned_contacts');
      if (pinRaw) {
        const pinned = JSON.parse(pinRaw).filter(id => id !== contactId);
        localStorage.setItem('bpp_v3_pinned_contacts', JSON.stringify(pinned));
      }
    } catch {}
  };

  const archiveJob = async () => {
    close();
    const ok = await window.confirmAction?.({
      title: 'Archive ' + contactName(contact) + '?',
      body: 'Moves this contact out of the active list. Use Undo within 5 seconds if it was a mistake.',
      confirmLabel: 'Archive',
      destructive: false,
    });
    if (!ok) return;
    contact.archived = true;
    bumpData?.();
    window.showToast?.('Job archived', {
      undo: () => {
        // Realtime can swap CRM.contacts in the 5s undo window — re-resolve
        // the live row by id so we mutate something still in the array.
        const live = (CRM.contacts || []).find(x => x.id === contact.id) || contact;
        live.archived = false;
        bumpData?.();
        if (CRM.__db) CRM.__db.from('contacts').update({ status: 'Active' }).eq('id', contact.id);
      },
      duration: 5000,
    });
    sweepContactLocal(contact.id);
    if (CRM.__db) CRM.__db.from('contacts').update({ status: 'Archived' }).eq('id', contact.id);
  };

  const markDnc = async () => {
    close();
    if (isDnc) return;
    const ok = await window.confirmAction?.({
      title: 'Stop all comms with ' + contactName(contact) + '?',
      body: 'Messages and calls will be disabled until the flag is removed.',
      confirmLabel: 'Mark do not contact',
      destructive: true,
    });
    if (ok) {
      contact.do_not_contact = true;
      // Pass the contact id so dncSet picks up the change — without the arg,
      // toggleDnc tries to add `undefined` and the compose-bar lock breaks.
      toggleDnc?.(contact.id);
      if (CRM.__db) CRM.__db.from('contacts').update({ do_not_contact: true }).eq('id', contact.id);
    }
  };

  const deleteContact = async () => {
    close();
    const ok = await window.confirmAction?.({
      title: 'Delete ' + contactName(contact) + '?',
      // Honest copy: there's no archive view in v3 yet, so the contact is
      // effectively gone from the UI. Restoration requires direct Supabase
      // access — say so plainly so Key knows.
      body: 'Hides this contact from the list. There\'s no archive view yet — to restore, flip status back in Supabase.',
      confirmLabel: 'Delete contact',
      destructive: true,
    });
    if (ok) {
      const i = CRM.contacts.findIndex(c => c.id === contact.id);
      if (i >= 0) CRM.contacts.splice(i, 1);
      bumpData?.();
      sweepContactLocal(contact.id);
      window.showToast?.('Contact deleted');
      // Soft delete: archive in DB rather than hard-delete the row.
      if (CRM.__db) CRM.__db.from('contacts').update({ status: 'Archived' }).eq('id', contact.id);
    }
  };

  // Overflow menu — pruned to actions you can't already do inline. Open in
  // Maps and Copy phone live on their own rows in CONTACT INFO; duplicating
  // them here makes the menu noisy for no benefit. Delete copy now reflects
  // the actual behavior (soft-archive — recoverable, no orphaned records).
  const items = [
    { kind:'item', icon:OFI.pencil, label:'Edit contact', onClick: editContact },
    { kind:'divider' },
    { kind:'item', icon:OFI.archive, label:'Archive job', sub:'Move out of active list', onClick: archiveJob },
    { kind:'item', icon:OFI.ban,    label:'Mark do not contact', danger:true, onClick: markDnc, disabled: isDnc },
    { kind:'divider' },
    { kind:'item', icon:OFI.trash,  label:'Delete contact', sub:'Hides from the list. Restore from Supabase.', danger:true, onClick: deleteContact },
  ];

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="More"
        aria-label="More actions"
        style={{
          // 44×44 hit area meets iOS HIG; visual icon stays small.
          width:44, height:44, borderRadius:6,
          background: open ? '#F0F4FF' : 'transparent',
          border:'none',
          color:MUTED, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}
      >
        <div style={{width:14,height:14}}>{Icons.more}</div>
      </button>

      {open && (
        <div style={{
          position:'absolute', right:0, top:'calc(100% + 6px)',
          width:200,
          background:'white',
          border:'1px solid rgba(27,43,75,0.12)',
          borderRadius:12,
          boxShadow:'0 8px 24px rgba(27,43,75,0.16)',
          padding:6, zIndex:60,
        }}>
          {items.map((it, i) => {
            if (it.kind === 'divider') {
              return <div key={'d'+i} style={{ height:1, background:'rgba(27,43,75,0.08)', margin:'4px 4px' }} />;
            }
            const color = it.danger ? '#dc2626' : NAVY;
            return (
              <button
                key={it.label}
                onClick={it.onClick}
                disabled={it.disabled}
                style={{
                  width:'100%', display:'flex', alignItems:'flex-start', gap:10,
                  padding:'8px 10px', borderRadius:8,
                  background:'none', border:'none', textAlign:'left',
                  cursor: it.disabled ? 'not-allowed' : 'pointer',
                  fontFamily:'inherit', color, opacity: it.disabled ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!it.disabled) e.currentTarget.style.background = '#F8F8F6'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ width:14, height:14, flexShrink:0, marginTop:1, color }}>{it.icon}</span>
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:'block', fontSize:13, fontWeight:500, lineHeight:1.3 }}>{it.label}</span>
                  {it.sub && <span style={{ display:'block', fontSize:11, color: it.danger ? 'rgba(220,38,38,0.75)' : '#666', marginTop:1, lineHeight:1.3 }}>{it.sub}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Overflow icons (matched to Icons.* style: 1.5 stroke, currentColor)
const OFI = {
  pencil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>,
  pin:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  copy:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  archive:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>,
  ban:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>,
  trash:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
};

// ── Contact Overview ──────────────────────────────────────────────
function ContactOverview({ contact, events, permits = [], proposals = [], materials = [], invoices = [], bumpData, onOpenTab }) {
  const [note, setNote] = React.useState(contact.notes || '');
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [noteSaved, setNoteSaved] = React.useState(false);
  // Reset local state when the active contact changes.
  React.useEffect(() => {
    setNote(contact.notes || '');
    setNoteSaved(false);
  }, [contact.id]);
  // Debounced auto-save: 800ms after the last keystroke, persist to contacts.notes.
  React.useEffect(() => {
    if (note === (contact.notes || '')) return;
    const timer = setTimeout(async () => {
      if (!CRM.__db) return;
      setNoteSaving(true);
      const { error } = await CRM.__db.from('contacts').update({ notes: note }).eq('id', contact.id);
      setNoteSaving(false);
      if (error) { window.showToast?.(`Notes save failed: ${error.message}`); return; }
      contact.notes = note;
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    }, 800);
    return () => clearTimeout(timer);
  }, [note, contact.id]);
  const sortedEvents = [...events].filter(e => e.status === 'scheduled').sort((a,b) => (a.start_at||'').localeCompare(b.start_at||''));
  const todayEvent = sortedEvents.find(e => dayKey(e.start_at) === TODAY);
  const nextEvent  = sortedEvents.find(e => dayKey(e.start_at) >  TODAY);

  // Install spec ALWAYS comes from the latest signed proposal — sorting by
  // signed-at (mapped to approved_at) descending. If the freshest signed
  // proposal has no amp_spec, the InstallSpec card shows "—" rather than
  // falling back to a stale older proposal's amp.
  const latestSigned = proposals
    .filter(p => p.status === 'approved')
    .sort((a,b) => (b.approved_at || '').localeCompare(a.approved_at || ''))[0];
  const ampSpec = latestSigned?.amp_spec || null;

  const cPermit = permits[0] || null;

  // Money status — what does Key need to know about money on this contact
  // RIGHT NOW? Surfaces unpaid invoices and signed-but-unsent proposals so
  // payment-chase moments aren't buried one tab away. The single most
  // valuable line of data on a Booked-or-later contact.
  // Key's billing rule: customers don't owe anything until after the
  // install. Pre-install sent invoices are "Pending install" (blue,
  // quiet); post-install sent invoices are "Awaiting payment" (amber).
  // Overdue stays red regardless.
  const installed = contactHasInstalled(contact, events);
  const unpaidInvoices = invoices.filter(i => i.status === 'sent');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const moneyOwed = [...overdueInvoices, ...unpaidInvoices].reduce((s,i) => s + (i.amount_cents || 0), 0);
  const hasOverdue = overdueInvoices.length > 0;
  const moneyStatus = moneyOwed > 0 ? (
    installed
      ? {
          cents: moneyOwed,
          label: hasOverdue ? 'Owed (overdue)' : 'Awaiting payment',
          color: hasOverdue ? '#991B1B' : '#92400E',
          bg:    hasOverdue ? '#FEF2F2' : '#FFFBEB',
          border:hasOverdue ? '#FECACA' : '#FDE68A',
        }
      : {
          cents: moneyOwed,
          label: 'Pending install',
          color: '#1E40AF',
          bg: '#EFF6FF',
          border: '#BFDBFE',
        }
  ) : null;

  return (
    <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'0 16px 16px' }}>
      {/* Today banner */}
      {todayEvent && (
        <div style={{ marginTop:12, background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'9px 13px', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:'#D97706',flexShrink:0,animation:'pulse 2s infinite' }} />
          <span style={{ fontSize:12, color:'#92400E', fontWeight:600 }}>{capitalize(todayEvent.kind)} today · {formatTime(todayEvent.start_at)}</span>
        </div>
      )}
      {/* Money status — only renders when there's an actual unpaid balance.
          Tap → switches to the Finance tab to chase payment. */}
      {moneyStatus && (
        <button
          onClick={() => onOpenTab?.('finance')}
          style={{
            marginTop:12, width:'100%', textAlign:'left',
            background: moneyStatus.bg, border: `1px solid ${moneyStatus.border}`, borderRadius:8,
            padding:'10px 13px', display:'flex', alignItems:'center', gap:10, cursor:'pointer',
            fontFamily:'inherit',
          }}
        >
          <span style={{ fontSize:18 }}>💰</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color: moneyStatus.color, letterSpacing:'0.04em', textTransform:'uppercase' }}>{moneyStatus.label}</div>
            <div style={{ fontSize:15, fontWeight:700, color: moneyStatus.color, fontFamily:"'JetBrains Mono', 'DM Mono', monospace" }}>{formatMoneyCents(moneyStatus.cents)}</div>
          </div>
          <span style={{ fontSize:11, color: moneyStatus.color, fontWeight:600 }}>View →</span>
        </button>
      )}
      <ContactInfoSection contact={contact} bumpData={bumpData} onOpenTab={onOpenTab} />
      <InstallSpecCard ampSpec={ampSpec} contact={contact} materials={materials} bumpData={bumpData} />
      {nextEvent && (
        <NextJobCard contact={contact} event={nextEvent} permit={cPermit} materials={materials} onOpenTab={onOpenTab} />
      )}
      <PhotosSection contact={contact} />
      <StageHistoryCard contact={contact} />
      <PermitsCard permits={permits} contact={contact} bumpData={bumpData} />
      <InfoSection title="Notes" editAction={null}>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Internal notes (auto-saves)…"
          style={{ width:'100%',minHeight:68,border:'1.5px solid #EBEBEA',borderRadius:8,background:BG,padding:'10px 12px',fontSize:16,color:NAVY,resize:'vertical',outline:'none',fontFamily:'inherit',lineHeight:1.5,boxSizing:'border-box' }} />
        <div style={{ marginTop:6, fontSize:11, color:'#999', minHeight:14 }}>
          {noteSaving ? 'Saving…' : noteSaved ? 'Saved' : ' '}
        </div>
      </InfoSection>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── InfoSection (unified card shell) ──────────────────────────────────
function InfoSection({ title, editAction, children }) {
  return (
    <div style={{
      background:'white', marginTop:12, padding:'14px 16px',
      border:'1px solid rgba(11,31,59,0.08)', borderRadius:8,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:'0.06em' }}>{title}</span>
        {editAction && (
          <button onClick={editAction} style={{ fontSize:12,color:'#666',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:'2px 4px' }}>Edit</button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Contact Info Rows (Phone / Address / Stage / Tier) ──────────
const SMALL_COPY_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

function GoldActionBtn({ onClick, href, target, children }) {
  const style = {
    height:32, padding:'0 14px', borderRadius:8,
    background:'#ffba00', color:NAVY, border:'none',
    fontSize:13, fontWeight:600, fontFamily:'inherit',
    cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
    textDecoration:'none', whiteSpace:'nowrap',
  };
  // target=_blank without rel=noopener leaks window.opener to the new tab.
  // Always pair them defensively — even though current callers are tel: links.
  if (href) return <a href={href} target={target} rel={target ? 'noopener noreferrer' : undefined} style={style}>{children}</a>;
  return <button onClick={onClick} style={style}>{children}</button>;
}

function CopyBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      height:32, padding:'0 12px', borderRadius:8,
      background:'white', color:NAVY,
      border:'1px solid rgba(27,43,75,0.15)',
      fontSize:13, fontWeight:600, fontFamily:'inherit',
      cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
    }}>
      {SMALL_COPY_ICON}
      <span>Copy</span>
    </button>
  );
}

function InfoLineRow({ label, value, valueColor, actions }) {
  return (
    // Two-row layout that holds at every viewport: row 1 is "label · value"
    // (value left-aligned next to its label so they read as one phrase),
    // row 2 is the action buttons RIGHT-aligned underneath. No flex-wrap
    // ambiguity — explicit grid keeps the right edge consistent on
    // mobile (390px) and desktop alike.
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:6 }}>
        <span style={{ width:64, flexShrink:0, fontSize:12, fontWeight:500, color:'#999' }}>{label}</span>
        <span style={{ flex:1, minWidth:0, fontSize:14, fontWeight:500, color: valueColor || NAVY, lineHeight:1.35, wordBreak:'break-word' }}>{value}</span>
      </div>
      {actions && (
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingLeft:74 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// HouseHero — wide Street View image of the contact's address. Helps Key
// recognize jobs visually ("oh, the white ranch with the carport"). Falls
// back gracefully when no address is set. Click → Maps + Street View link.
// DriveTimeBadge — async OSRM lookup, shows minutes + miles from Key's home
// to the contact's address. Cached in localStorage for 24h per contact.
// Renders nothing if address can't be geocoded.
function DriveTimeBadge({ contact, dark }) {
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setInfo(null);
    if (!isAddressableStreet(contact.address) || typeof driveTimeToContactAddress !== 'function') {
      setLoading(false);
      return () => { alive = false; };
    }
    driveTimeToContactAddress(contact.address, contact.id).then(r => {
      if (alive) { setInfo(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, [contact.id, contact.address]);
  if (loading) return null;
  if (!info) return null;
  const txt = info.minutes < 60
    ? `≈${info.minutes} min from home`
    : `≈${Math.floor(info.minutes/60)} hr ${info.minutes%60} min from home`;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      fontSize:11, fontWeight:600,
      color: dark ? 'white' : '#666',
      textShadow: dark ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
    }}>
      <span style={{ fontSize:13, lineHeight:1 }}>🚗</span>
      <span>{txt} · {info.miles.toFixed(1)} mi</span>
    </span>
  );
}

function HouseHero({ contact }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [contact.id]);
  const address = contact.address;
  if (!address || failed) return null;
  // Hero: wide rectangular Street View. Larger dim + scale=2 = sharp.
  // Use a wider FOV to capture more of the front of the house.
  // Reuses streetViewUrlFor's address validity check via early return.
  if (!isAddressableStreet(address)) return null;
  const url = `https://maps.googleapis.com/maps/api/streetview?size=640x240&scale=2` +
              `&location=${encodeURIComponent(address.trim())}` +
              `&fov=90&pitch=2&source=outdoor&key=${SV_KEY}`;
  const mapsLink = `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}`;
  return (
    <a
      href={mapsLink}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
      style={{
        display:'block', marginTop:12, borderRadius:8, overflow:'hidden',
        border:'1px solid rgba(11,31,59,0.08)', background:'#EBEBEA',
        aspectRatio:'8 / 3', position:'relative',
      }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          width:'100%', height:'100%', objectFit:'cover',
          // Crop bottom-left a hair to push Google's watermark off the rendered
          // box without losing the house. Combined with a soft gradient overlay
          // below, the watermark is effectively invisible.
          objectPosition:'50% 30%',
          filter: 'saturate(1.2) contrast(1.05)',
          display:'block',
        }}
      />
      {/* Bottom gradient covers Google's watermarks (bottom-left + bottom-
          right) and gives the address overlay legibility. Heavier at the
          bottom 18% to fully hide both attribution corners. */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0.78) 100%)',
        pointerEvents:'none',
      }} />
      <div style={{
        position:'absolute', left:12, right:12, bottom:10,
        color:'white', fontSize:12, fontWeight:600, letterSpacing:'0.01em',
        textShadow:'0 1px 2px rgba(0,0,0,0.6)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      }}>{address}</div>
    </a>
  );
}

// Photos section — combined gallery of:
//   1. Photos auto-extracted from this contact's SMS thread (Twilio MMS)
//   2. Job photos Key uploads directly (stored in Supabase Storage,
//      indexed in localStorage per contact)
// Job photos are PRIVATE — they never go to the customer. Click [Upload]
// to add — opens a file picker, uploads to the message-media bucket,
// thumbnail appears immediately.
function PhotosSection({ contact }) {
  // URL allowlist: parse the URL and check the actual hostname rather than a
  // regex (which can be bypassed by `https://attacker.com/.twilio.com/x.png`
  // because `.*` doesn't anchor at a host boundary). hostname.endsWith()
  // requires the dot to make `xtwilio.com` not match `twilio.com`.
  const isTrustedMediaUrl = (raw) => {
    if (!raw || typeof raw !== 'string') return false;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:') return false;
      const h = u.hostname.toLowerCase();
      return h === 'api.twilio.com' || h.endsWith('.twilio.com') || h.endsWith('.supabase.co');
    } catch { return false; }
  };
  const STORAGE_KEY = `bpp_v3_job_photos:${contact.id}`;
  const [jobPhotos, setJobPhotos] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef(null);

  // Reset on contact change.
  React.useEffect(() => {
    try { setJobPhotos(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { setJobPhotos([]); }
  }, [contact.id]);

  const smsPhotos = React.useMemo(() => {
    const out = [];
    for (const m of CRM.messages) {
      if (m.contact_id !== contact.id) continue;
      const match = /^\[media:([^\]]+)\]\s*(.*)$/s.exec(m.body || '');
      if (!match) continue;
      const url = match[1];
      if (isTrustedMediaUrl(url)) {
        out.push({ id: m.id, url, caption: match[2] || '', sent_at: m.sent_at, source: 'sms' });
      }
    }
    return out;
    // Use the array reference itself in deps — realtime replaces the whole
    // array on any change, so reference equality catches body edits that
    // wouldn't move .length. Cheap (one ref check vs filtering all messages).
  }, [contact.id, CRM.messages]);

  // Newest first across both sources. Re-validate job photo URLs on read —
  // localStorage is attacker-influenceable in principle, so render-time
  // allowlist matches what we'd enforce on first upload.
  const allPhotos = React.useMemo(() => {
    const safeJobs = jobPhotos.filter(p => isTrustedMediaUrl(p.url));
    const tagged = [
      ...safeJobs.map(p => ({ ...p, source: 'job', sent_at: p.uploaded_at })),
      ...smsPhotos,
    ];
    return tagged.sort((a,b) => (b.sent_at||'').localeCompare(a.sent_at||'')).slice(0, 48);
  }, [jobPhotos, smsPhotos]);

  const onPick = () => fileInputRef.current?.click();
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { window.showToast?.('Only image files'); return; }
    if (file.size > 10 * 1024 * 1024) { window.showToast?.('Photo too large (10 MB max)'); return; }
    if (!CRM.__db) { window.showToast?.('Supabase not loaded'); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]/g, '_').slice(0, 60);
      const path = `crm-job-photos/${contact.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await CRM.__db.storage.from('message-media').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = CRM.__db.storage.from('message-media').getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('No public URL returned');
      const next = [...jobPhotos, { id: 'job-' + Date.now(), url, uploaded_at: new Date().toISOString() }];
      setJobPhotos(next);
      window.safeSetItem?.(STORAGE_KEY, JSON.stringify(next));
      window.showToast?.('Photo added');
    } catch (err) {
      window.showToast?.(`Upload failed: ${err.message || 'unknown'}`);
    } finally {
      setUploading(false);
    }
  };

  const removeJobPhoto = (id) => {
    const next = jobPhotos.filter(p => p.id !== id);
    setJobPhotos(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    window.showToast?.('Photo removed');
  };

  return (
    <InfoSection title="Photos" editAction={null}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display:'none' }} />
      {allPhotos.length === 0 ? (
        <div style={{ fontSize:13, color:MUTED, padding:'4px 0', marginBottom:8 }}>
          Add job photos (private — only you see them) or send/receive photos in the SMS thread.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(84px, 1fr))', gap:8, marginBottom:10 }}>
          {allPhotos.map(p => (
            <div key={p.id} style={{ position:'relative' }}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{
                aspectRatio:'1 / 1', borderRadius:8, overflow:'hidden', display:'block',
                background:'#EBEBEA',
              }} title={p.source === 'job' ? 'Job photo (private)' : (p.caption || 'From SMS')}>
                <img src={p.url} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              </a>
              {p.source === 'job' && (
                <button onClick={() => removeJobPhoto(p.id)} title="Remove photo" style={{
                  position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%',
                  background:'rgba(11,31,59,0.7)', color:'white', border:'none', fontSize:12,
                  cursor:'pointer', lineHeight:1,
                }}>×</button>
              )}
              {p.source === 'sms' && (
                <span title="From SMS" style={{
                  position:'absolute', bottom:4, left:4, padding:'1px 5px', borderRadius:4,
                  background:'rgba(11,31,59,0.7)', color:'white', fontSize:9, fontWeight:600,
                }}>SMS</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={onPick} disabled={uploading} style={{
          height:32, padding:'0 14px', borderRadius:8,
          background:'#ffba00', color:NAVY, border:'none',
          fontSize:13, fontWeight:600, fontFamily:'inherit',
          cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1,
          display:'inline-flex', alignItems:'center', gap:6,
        }}>
          {uploading ? 'Uploading…' : <><span style={{ fontSize:15, lineHeight:1 }}>＋</span> Add photo</>}
        </button>
      </div>
    </InfoSection>
  );
}

// Wraps ContactInfoRows with a real edit form. Click "Edit" → inline form
// with name + phone + address fields. Submit → updates contacts table.
function ContactInfoSection({ contact, bumpData, onOpenTab }) {
  const [editing, setEditing] = React.useState(false);
  // Listen for the overflow menu's "Edit contact" action.
  React.useEffect(() => {
    const onEdit = (e) => { if (e.detail?.contactId === contact.id) setEditing(true); };
    window.addEventListener('crm-edit-contact', onEdit);
    return () => window.removeEventListener('crm-edit-contact', onEdit);
  }, [contact.id]);
  const [name, setName] = React.useState(contact.name || '');
  const [phone, setPhone] = React.useState(contact.phone || '');
  const [address, setAddress] = React.useState(contact.address || '');
  const [saving, setSaving] = React.useState(false);
  // Reset state AND exit edit mode whenever the contact changes — otherwise
  // a half-edited form for contact A leaks the typed name into contact B's
  // form when Key bounces between contacts mid-edit.
  React.useEffect(() => {
    setEditing(false);
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setAddress(contact.address || '');
  }, [contact.id]);

  const save = async () => {
    if (!CRM.__db) { window.showToast?.('Supabase not loaded'); return; }
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (trimmedPhone && !/^\+?[\d\s().-]{7,}$/.test(trimmedPhone)) {
      window.showToast?.('Phone looks invalid');
      return;
    }
    setSaving(true);
    const corePatch = { name: trimmedName || null, phone: trimmedPhone, address: trimmedAddress };
    const { error } = await CRM.__db.from('contacts').update(corePatch).eq('id', contact.id);
    if (error) { setSaving(false); window.showToast?.(`Save failed: ${error.message}`); return; }

    // Propagate to denormalized contact_* fields on proposals + invoices.
    // proposal.html and invoice.html render the customer-facing Street
    // View image from contact_address — without this, an address edit
    // never reaches the customer's open proposal link.
    const denormPatch = {
      contact_name: corePatch.name || '',
      contact_phone: corePatch.phone || '',
      contact_address: corePatch.address || '',
    };
    const propagate = await Promise.allSettled([
      CRM.__db.from('proposals').update(denormPatch).eq('contact_id', contact.id),
      CRM.__db.from('invoices').update(denormPatch).eq('contact_id', contact.id),
    ]);
    const failed = propagate.filter(r => r.status === 'rejected' || r.value?.error);
    if (failed.length) {
      console.warn('[CRM] propagate to proposals/invoices partially failed:', failed);
    }

    contact.name = corePatch.name;
    contact.phone = corePatch.phone;
    contact.address = corePatch.address;
    setSaving(false);
    setEditing(false);
    bumpData?.();
    window.showToast?.('Contact updated');
  };

  if (!editing) {
    // Combined hero + contact info card. Image at top with name overlay
    // (large + bold) + Copy button. Below: phone/address/stage/tier rows.
    const hasHero = isAddressableStreet(contact.address);
    const heroUrl = hasHero
      ? `https://maps.googleapis.com/maps/api/streetview?size=640x200&scale=2&location=${encodeURIComponent(contact.address.trim())}&fov=90&pitch=2&source=outdoor&key=${SV_KEY}`
      : null;
    const isPremium = contact.pricing_tier === 'premium' || contact.pricing_tier === 'premium_plus';
    const stageLabel = CRM.STAGE_LABELS[contact.stage] || '';

    const copyName = async () => {
      try { await navigator.clipboard.writeText(contactName(contact)); window.showToast?.('Name copied'); }
      catch { window.showToast?.('Copy failed'); }
    };

    return (
      <div style={{ background:'white', marginTop:12, border:'1px solid rgba(11,31,59,0.08)', borderRadius:8, overflow:'hidden' }}>
        {heroUrl && (
          <div style={{ position:'relative', aspectRatio:'5 / 2', background:'#EBEBEA' }}>
            <img src={heroUrl} alt="" loading="lazy" decoding="async" style={{
              width:'100%', height:'100%', objectFit:'cover', objectPosition:'50% 30%',
              filter:'saturate(1.2) contrast(1.05)', display:'block',
            }} />
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.85) 100%)',
              pointerEvents:'none',
            }} />
            <div style={{
              position:'absolute', left:16, right:16, bottom:14, display:'flex', alignItems:'flex-end', gap:10,
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                  {stageLabel && <span style={{ fontSize:10, fontWeight:700, color:'white', background:'rgba(255,255,255,0.18)', backdropFilter:'blur(6px)', padding:'2px 8px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.06em' }}>{stageLabel}</span>}
                  {isPremium && <span style={{ fontSize:10, fontWeight:700, color:NAVY, background:GOLD, padding:'2px 8px', borderRadius:20, letterSpacing:'0.05em' }}>{contact.pricing_tier === 'premium_plus' ? 'PREMIUM+' : 'PREMIUM'}</span>}
                </div>
                <div style={{
                  fontSize:24, fontWeight:700, color:'white', lineHeight:1.1,
                  textShadow:'0 1px 4px rgba(0,0,0,0.5)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{contactName(contact)}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:2, textShadow:'0 1px 2px rgba(0,0,0,0.5)' }}>{contact.address}</div>
                <div style={{ marginTop:6 }}>
                  <DriveTimeBadge contact={contact} dark />
                </div>
              </div>
              <button onClick={copyName} title="Copy name" style={{
                height:32, padding:'0 12px', borderRadius:8,
                background:'rgba(255,255,255,0.95)', color:NAVY, border:'none',
                fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:5, flexShrink:0,
                boxShadow:'0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {SMALL_COPY_ICON}<span>Copy</span>
              </button>
            </div>
          </div>
        )}
        <div style={{ padding:'14px 16px' }}>
          {!heroUrl && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', minWidth:0 }}>
                <span style={{ fontSize:20, fontWeight:700, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contactName(contact)}</span>
                {stageLabel && <span style={{ fontSize:10, fontWeight:700, color:'#5B21B6', background:'#F5F3FF', padding:'2px 8px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.05em' }}>{stageLabel}</span>}
                {isPremium && <span style={{ fontSize:10, fontWeight:700, color:NAVY, background:GOLD, padding:'2px 8px', borderRadius:20, letterSpacing:'0.05em' }}>{contact.pricing_tier === 'premium_plus' ? 'PREMIUM+' : 'PREMIUM'}</span>}
              </div>
              <button onClick={copyName} title="Copy name" style={{
                height:30, padding:'0 10px', borderRadius:6,
                background:'white', color:NAVY, border:'1px solid rgba(11,31,59,0.15)',
                fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:5, flexShrink:0,
              }}>{SMALL_COPY_ICON}<span>Copy</span></button>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em' }}>Contact info</span>
            <button onClick={() => setEditing(true)} style={{ background:'none', border:'none', color:'#666', fontSize:12, cursor:'pointer', padding:0, fontFamily:'inherit' }}>Edit</button>
          </div>
          <ContactInfoRows contact={contact} bumpData={bumpData} onOpenTab={onOpenTab} />
        </div>
      </div>
    );
  }

  // fontSize 16 prevents iOS Safari auto-zoom on focus.
  const inputStyle = { width:'100%', padding:'10px 12px', fontSize:16, fontFamily:'inherit', border:'1px solid rgba(11,31,59,0.15)', borderRadius:6, background:'white', color:NAVY, boxSizing:'border-box' };
  return (
    <InfoSection title="Contact info">
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 }}>Name</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 }}>Phone</div>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 }}>Address</div>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Spartanburg" style={inputStyle} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <button onClick={() => setEditing(false)} disabled={saving} style={{
            flex:1, height:36, borderRadius:8, background:'white', color:NAVY,
            border:'1px solid rgba(27,43,75,0.15)', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            flex:1, height:36, borderRadius:8, background:'#ffba00', color:NAVY, border:'none',
            fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', opacity:saving?0.6:1,
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </InfoSection>
  );
}

// Stage-action verbs in tradesman language, not Salesforce-speak. Each verb
// describes the literal physical action that moves the deal forward.
function stageActionVerbFor(stage) {
  return {
    new:              'Send quote',
    quoted:           'Mark booked',
    booked:           'Pull permit',
    permit_submit:    'Mark waiting',
    permit_waiting:   'Mark approved',
    permit_approved:  'Schedule install',
    install:          'Mark done',
  }[stage] || 'Move forward';
}

function ContactInfoRows({ contact, bumpData, onOpenTab }) {
  const phoneFmt = formatPhone(contact.phone);
  const street = (contact.address || '').split(',')[0].trim();
  const jurisdiction = contact.jurisdiction || '';
  const addressDisplay = jurisdiction ? `${street} · ${jurisdiction}` : street;
  const addressForCopy = addressDisplay;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(contact.address || addressDisplay)}`;

  // Stage advance
  const stageIdx = CRM.STAGE_ORDER.indexOf(contact.stage);
  const nextStage = stageIdx >= 0 && stageIdx < CRM.STAGE_ORDER.length - 1
    ? CRM.STAGE_ORDER[stageIdx + 1] : null;
  const nextStageLabel = nextStage ? CRM.STAGE_LABELS[nextStage] : null;
  const advancingRef = React.useRef(false);
  const advanceStage = async () => {
    if (!nextStage) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const previous = contact.stage;
    contact.stage = nextStage;
    bumpData?.();
    window.showToast?.(`Advanced to ${nextStageLabel}`);
    const numericStage = CRM.STAGE_STR_TO_NUM?.[nextStage];
    try {
      if (CRM.__db && numericStage != null) {
        const { error } = await CRM.__db.from('contacts').update({ stage: numericStage }).eq('id', contact.id);
        if (error) {
          contact.stage = previous;
          bumpData?.();
          window.showToast?.(`Couldn't save: ${error.message}`);
        }
      }
    } finally {
      advancingRef.current = false;
    }
  };

  // Some stage verbs are an actual feature, not just a stage flip:
  // - "Send quote" should open the New Proposal modal (and the modal will
  //   bump stage 1→2 on insert anyway, so don't double-bump here).
  // - "Schedule install" should jump to Schedule tab + open Add Event.
  // - "Pull permit" jumps to Permits affordance.
  // Anything else (Mark booked / waiting / approved / done) is a pure stage
  // bump and goes through advanceStage as before.
  const handleStageAction = () => {
    if (contact.stage === 'new') {
      onOpenTab?.('finance');
      // The destination tab needs to mount before its useEffect listener
      // registers. 50ms wasn't enough on slow machines / cold mounts;
      // 300ms is safe and still feels instant.
      setTimeout(() => window.dispatchEvent(new CustomEvent('crm-open-new-proposal', { detail: { contactId: contact.id } })), 300);
      return;
    }
    if (contact.stage === 'permit_approved') {
      onOpenTab?.('calendar');
      setTimeout(() => window.dispatchEvent(new CustomEvent('crm-open-add-event', { detail: { contactId: contact.id } })), 300);
      return;
    }
    advanceStage();
  };

  const tier = contact.pricing_tier;
  const tierLabel = tier === 'premium_plus' ? '★ Premium+' : tier === 'premium' ? '★ Premium' : 'Standard';
  const tierColor = tier !== 'standard' ? GOLD : NAVY;

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); window.showToast?.(label + ' copied'); }
    catch { window.showToast?.('Copy failed'); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <InfoLineRow
        label="Phone"
        value={phoneFmt}
        actions={<>
          <GoldActionBtn href={`tel:${contact.phone}`}>Call</GoldActionBtn>
          <CopyBtn onClick={() => copy(contact.phone, 'Phone')} />
        </>}
      />
      <InfoLineRow
        label="Address"
        value={addressDisplay}
        actions={<>
          <GoldActionBtn onClick={() => window.open(mapsUrl, '_blank', 'noopener')}>Map</GoldActionBtn>
          <CopyBtn onClick={() => copy(addressForCopy, 'Address')} />
        </>}
      />
      <InfoLineRow
        label="Stage"
        value={CRM.STAGE_LABELS[contact.stage]}
        actions={nextStageLabel ? <GoldActionBtn onClick={handleStageAction}>{stageActionVerbFor(contact.stage)}</GoldActionBtn> : null}
      />
      {/* Tier row dropped — the Premium / Premium+ pill already sits in the
          hero overlay, so a duplicate row here is redundant. */}
    </div>
  );
}

// ── Permits Card ──────────────────────────────────────────────────
const PERMIT_PILL = {
  approved:    { bg:'#16a34a', color:'white', label:'Approved' },
  submitted:   { bg:'#f59e0b', color:'white', label:'Submitted' },
  waiting:     { bg:'#2563eb', color:'white', label:'Waiting' },
  blocked:     { bg:'#dc2626', color:'white', label:'Blocked' },
  not_started: { bg:'#999',    color:'white', label:'Not started' },
};

function CardShell({ eyebrow, children }) {
  return (
    <div style={{ background:'white', marginTop:12, padding:'14px 16px', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>{eyebrow}</div>
      {children}
    </div>
  );
}

function PermitPill({ status }) {
  const p = PERMIT_PILL[status] || PERMIT_PILL.not_started;
  return <span style={{ background:p.bg, color:p.color, padding:'4px 8px', borderRadius:4, fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{p.label}</span>;
}

function GoldPillButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ background:GOLD, color:NAVY, border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>{children}</button>
  );
}

const BPP_JURISDICTIONS = ['Spartanburg County', 'Greenville County', 'Pickens County', 'City of Greenville'];

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  );
}

function JurisdictionEditor({ permit, bumpData }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (name) => {
    setOpen(false);
    if (permit.jurisdiction === name) return;
    permit.jurisdiction = name;
    bumpData?.();
    window.showToast?.('Jurisdiction updated');
  };

  return (
    <span ref={wrapRef} style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
      <span style={{ fontSize:15, fontWeight:600, color:NAVY, minWidth:0 }}>{permit.jurisdiction}</span>
      <button onClick={()=>setOpen(o=>!o)} aria-label="Edit jurisdiction" style={{
        background:'none', border:'none', padding:2, cursor:'pointer',
        color:'#999', display:'inline-flex', alignItems:'center', justifyContent:'center',
      }}><PencilIcon /></button>
      {open && (
        <div style={{
          position:'absolute', left:0, top:'calc(100% + 4px)', zIndex:50,
          width:200, background:'white', border:'1px solid rgba(27,43,75,0.12)',
          borderRadius:8, boxShadow:'0 8px 24px rgba(27,43,75,0.16)', padding:4,
        }}>
          {BPP_JURISDICTIONS.map(name => (
            <button key={name} onClick={()=>pick(name)} style={{
              width:'100%', textAlign:'left', padding:'7px 10px',
              background: permit.jurisdiction===name ? '#F0F4FF' : 'none',
              border:'none', borderRadius:6, color:NAVY,
              fontSize:13, fontWeight:500, fontFamily:'inherit', cursor:'pointer',
            }}
              onMouseEnter={e=>{ if (permit.jurisdiction!==name) e.currentTarget.style.background='#F8F8F6'; }}
              onMouseLeave={e=>{ if (permit.jurisdiction!==name) e.currentTarget.style.background='none'; }}
            >{name}</button>
          ))}
        </div>
      )}
    </span>
  );
}

function PermitStatusActions({ permit, bumpData }) {
  const advance = (toStatus, stamps = {}) => {
    permit.status = toStatus;
    Object.assign(permit, stamps);
    bumpData?.();
    window.showToast?.(`Permit: ${capitalize(toStatus)}`);
  };
  const today = TODAY;

  const baseBtn = {
    height:32, borderRadius:8, padding:'0 12px',
    fontSize:12, fontWeight:600, fontFamily:'inherit',
    cursor:'pointer', whiteSpace:'nowrap',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
  };
  const goldBtn   = { ...baseBtn, background:'#ffba00', color:NAVY, border:'none', flex:1 };
  const ghostBtn  = { ...baseBtn, background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)', flex:1 };
  const dangerBtn = { ...baseBtn, background:'white', color:'#dc2626', border:'1px solid rgba(220,38,38,0.3)', flex:1 };
  const dangerSolidBtn = { ...baseBtn, background:'#dc2626', color:'white', border:'none', flex:1 };

  if (permit.status === 'not_started') {
    return (
      <button onClick={()=>advance('submitted', { submitted_at: today })} style={{ ...goldBtn, width:'100%' }}>Submit permit</button>
    );
  }
  if (permit.status === 'submitted') {
    return (
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>advance('waiting')} style={ghostBtn}>Mark waiting</button>
        <button onClick={()=>advance('approved', { approved_at: today })} style={goldBtn}>Mark approved</button>
      </div>
    );
  }
  if (permit.status === 'waiting') {
    return (
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>advance('approved', { approved_at: today })} style={goldBtn}>Mark approved</button>
        <button onClick={()=>advance('blocked', { blocker_note: permit.blocker_note || 'Awaiting reviewer feedback' })} style={dangerBtn}>Mark blocked</button>
      </div>
    );
  }
  if (permit.status === 'approved') {
    // Approved permits don't need an inline action — the row already shows
    // the approved date. The actual letter PDF lives in the jurisdiction
    // portal (use the Permit portals popover at the top of the contacts list
    // to log in and download). Showing a button here would be a stub.
    return null;
  }
  if (permit.status === 'blocked') {
    return (
      <div>
        <button onClick={()=>advance('waiting', { blocker_note: null })} style={{ ...dangerSolidBtn, width:'100%' }}>Resolve blocker</button>
        {permit.blocker_note && (
          <div style={{ fontSize:12, color:'#666', marginTop:6 }}>{permit.blocker_note}</div>
        )}
      </div>
    );
  }
  return null;
}

function PermitsCard({ permits, contact, bumpData }) {
  const fmtDay = iso => iso ? formatDate(iso, { month:'short', day:'numeric' }) : null;

  const addPermit = () => {
    if (!contact) return;
    const j = contact.jurisdiction
      ? BPP_JURISDICTIONS.find(n => n.toLowerCase().includes(contact.jurisdiction.toLowerCase())) || BPP_JURISDICTIONS[0]
      : BPP_JURISDICTIONS[0];
    CRM.permits.push({
      id:'pm-'+Date.now(),
      contact_id: contact.id,
      jurisdiction: j,
      status:'not_started',
      permit_number: 'PENDING',
      submitted_at: null,
      approved_at: null,
      cost_cents: 0,
      blocker_note: null,
    });
    bumpData?.();
    window.showToast?.('Permit added');
  };

  return (
    <CardShell eyebrow="Permits">
      {permits.length === 0 ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <span style={{ color:'#999', fontSize:13 }}>No permit yet</span>
          <GoldPillButton onClick={addPermit}>Start permit</GoldPillButton>
        </div>
      ) : (
        permits.map((p, i) => {
          const timeline = p.approved_at
            ? `Submitted ${fmtDay(p.submitted_at)} → Approved ${fmtDay(p.approved_at)}`
            : (p.submitted_at ? `Submitted ${fmtDay(p.submitted_at)}` : null);
          return (
            <div key={p.id} style={{ paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0, borderTop: i ? '1px solid rgba(11,31,59,0.06)' : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <JurisdictionEditor permit={p} bumpData={bumpData} />
                <PermitStatusPill status={p.status} />
                <span style={{ fontFamily:'DM Mono, monospace', fontSize:13, color:NAVY, marginLeft:'auto', flexShrink:0 }}>{p.cost_cents > 0 ? formatMoneyCents(p.cost_cents) : '—'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'#666' }}>{p.permit_number}</span>
                {timeline && <span style={{ fontSize:12, color:'#666' }}>· {timeline}</span>}
              </div>
              <PermitStatusActions permit={p} bumpData={bumpData} />
            </div>
          );
        })
      )}
      {permits.length > 0 && (
        <button onClick={addPermit} style={{
          marginTop:12, width:'100%', height:28, borderRadius:6,
          background:'white', border:'1px dashed rgba(27,43,75,0.25)',
          color:NAVY, fontSize:13, fontWeight:500, fontFamily:'inherit', cursor:'pointer',
        }}>+ Add permit</button>
      )}
    </CardShell>
  );
}

// Renamed inline alias to avoid colliding with old PermitPill (still used elsewhere if any)
const PermitStatusPill = PermitPill;

// ── Install Spec Card ─────────────────────────────────────────────
const MAT_STATUS = {
  not_ordered: { icon: '○', color: '#999',    label: 'Not ordered' },
  ordered:     { icon: '◐', color: '#f59e0b', label: 'Ordered' },
  received:    { icon: '●', color: '#2563eb', label: 'Received' },
  installed:   { icon: '✓', color: '#16a34a', label: 'Installed' },
};
const MAT_NEXT = {
  not_ordered: { next:'ordered',   label:'Order',          gold:true,  stamp:'ordered_at' },
  ordered:     { next:'received',  label:'Mark received',  gold:false, stamp:'received_at' },
  received:    { next:'installed', label:'Mark installed', gold:false, stamp:'installed_at' },
  installed:   null,
};
const MAT_KIND_LABEL = k => k.charAt(0).toUpperCase() + k.slice(1);

function MaterialRow({ mat, contact, bumpData, isPlaceholder }) {
  const st = MAT_STATUS[mat.status] || MAT_STATUS.not_ordered;
  const next = MAT_NEXT[mat.status];
  const fmtMmDd = iso => iso ? formatDate(iso, { month:'short', day:'numeric' }) : '';
  const statusText =
    mat.status === 'ordered'   ? `Ordered ${fmtMmDd(mat.ordered_at)}` :
    mat.status === 'received'  ? `Received ${fmtMmDd(mat.received_at)}` :
    mat.status === 'installed' ? 'Installed' :
    'Not ordered';

  const advance = () => {
    if (!next) return;
    if (isPlaceholder) {
      // create real material row
      const realMat = {
        id: 'mat-' + Date.now(),
        contact_id: contact.id,
        kind: mat.kind,
        status: next.next,
        ordered_at: next.stamp === 'ordered_at' ? TODAY : null,
        received_at: next.stamp === 'received_at' ? TODAY : null,
        installed_at: next.stamp === 'installed_at' ? TODAY : null,
      };
      CRM.materials.push(realMat);
    } else {
      mat.status = next.next;
      mat[next.stamp] = TODAY;
    }
    bumpData?.();
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)}: ${next.label.toLowerCase()}`);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
      <span style={{ width:16, fontSize:14, color:st.color, flexShrink:0, textAlign:'center', lineHeight:1, fontWeight:700 }}>{st.icon}</span>
      <span style={{ flex:1, fontSize:14, color:NAVY }}>{MAT_KIND_LABEL(mat.kind)}</span>
      <span style={{ fontSize:12, color:'#666', whiteSpace:'nowrap' }}>{statusText}</span>
      {next && (
        <button onClick={advance} style={{
          height:32, padding:'0 12px', borderRadius:8,
          background: next.gold ? '#ffba00' : 'white',
          color: NAVY,
          border: next.gold ? 'none' : '1px solid rgba(27,43,75,0.15)',
          fontSize:12, fontWeight:600, fontFamily:'inherit',
          cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
        }}>{next.label}</button>
      )}
    </div>
  );
}

function InstallSpecCard({ ampSpec, contact, materials = [], bumpData }) {
  const hasSpec = !!ampSpec;
  const big = hasSpec ? ampSpec : '—';
  const sub = hasSpec ? `${ampSpec.replace(/A$/,'').toLowerCase()} amp installation` : 'Awaiting signed proposal';

  // Ordering rows: inlet + interlock always (placeholders if missing) + extras after
  const inletMat = materials.find(m => m.kind === 'inlet') || { kind:'inlet', status:'not_ordered', contact_id:contact.id, _placeholder:true };
  const interlockMat = materials.find(m => m.kind === 'interlock') || { kind:'interlock', status:'not_ordered', contact_id:contact.id, _placeholder:true };
  const extras = materials.filter(m => m.kind !== 'inlet' && m.kind !== 'interlock');
  const rows = [inletMat, interlockMat, ...extras];

  const [showAddPicker, setShowAddPicker] = React.useState(false);
  const EXTRA_KINDS = ['breaker','cord','whip','surge','other'];

  const addExtra = (kind) => {
    setShowAddPicker(false);
    CRM.materials.push({
      id:'mat-'+Date.now(),
      contact_id: contact.id,
      kind,
      status:'not_ordered',
      ordered_at:null, received_at:null, installed_at:null,
    });
    bumpData?.();
    window.showToast?.(`${MAT_KIND_LABEL(kind)} added`);
  };

  // Tighter header: amp value + subtitle inline on one row, with the
  // ORDERING section's count chip on the right (e.g. "2/3 ordered"). Saves
  // ~40px of vertical space and uses the wide-column whitespace meaningfully.
  const orderedCount = rows.filter(m => m.status === 'ordered' || m.status === 'received' || m.status === 'installed').length;
  const totalCount = rows.length;

  return (
    <div style={{ background:'white', marginTop:12, padding:'14px 16px', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, minWidth:0 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em' }}>Install spec</span>
          <span style={{ fontFamily:'JetBrains Mono, DM Mono, monospace', fontSize:20, fontWeight:700, color:NAVY, lineHeight:1 }}>{big}</span>
          <span style={{ fontSize:13, color:'#666' }}>{sub}</span>
        </div>
        {/* Only show the count chip once ordering has actually started.
            Showing "0/2 ordered" before any work began reads as a debt. */}
        {hasSpec && totalCount > 0 && orderedCount > 0 && (
          <span style={{ fontSize:12, fontWeight:600, color: orderedCount === totalCount ? '#16a34a' : '#999' }}>
            {orderedCount}/{totalCount} ordered
          </span>
        )}
      </div>

      <div>
        {rows.map((m, i) => (
          <MaterialRow key={m.id || ('ph-'+m.kind)} mat={m} contact={contact} bumpData={bumpData} isPlaceholder={!!m._placeholder} />
        ))}
      </div>

      {showAddPicker ? (
        <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
          {EXTRA_KINDS.map(k => (
            <button key={k} onClick={()=>addExtra(k)} style={{
              height:28, padding:'0 10px', borderRadius:6,
              background:'white', border:'1px solid rgba(27,43,75,0.15)',
              color:NAVY, fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
            }}>{MAT_KIND_LABEL(k)}</button>
          ))}
          <button onClick={()=>setShowAddPicker(false)} style={{
            height:28, padding:'0 10px', borderRadius:6,
            background:'none', border:'none', color:'#999', fontSize:12, fontFamily:'inherit', cursor:'pointer',
          }}>Cancel</button>
        </div>
      ) : (
        <button onClick={()=>setShowAddPicker(true)} style={{
          marginTop:8, width:'100%', height:28, borderRadius:6,
          background:'white', border:'1px dashed rgba(27,43,75,0.25)',
          color:NAVY, fontSize:13, fontWeight:500, fontFamily:'inherit', cursor:'pointer',
        }}>+ Add extra</button>
      )}
    </div>
  );
}

// ── Next Job Card (expanded) ──────────────────────────────────────
function NextJobCard({ contact, event, permit, materials = [], onOpenTab }) {
  const startMs = new Date(event.start_at).getTime();
  // Local midnight, NOT UTC midnight — `TODAY` is already a local-TZ date
  // string, so re-parsing it as UTC (the 'Z' suffix did) produces an
  // off-by-one day for early-morning and late-evening hours.
  const nowMs = new Date(TODAY + 'T00:00:00').getTime();
  const dayMs = 24*60*60*1000;
  const diffDays = Math.round((startMs - nowMs) / dayMs);
  const relText = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays > 0 ? `in ${diffDays} days` : `${-diffDays} days ago`;

  const street = (contact.address || '').split(',')[0].trim();
  const jurisdiction = contact.jurisdiction || '';

  const PERMIT_COLORS = { approved:'#16a34a', submitted:'#f59e0b', waiting:'#2563eb', blocked:'#dc2626', not_started:'#999' };

  const total = materials.length;
  const ready = materials.filter(m => m.status === 'received' || m.status === 'installed').length;
  // Always at least 2 (inlet + interlock placeholders)
  const totalForReadiness = Math.max(total, 2);
  const readinessFull = totalForReadiness > 0 && ready === totalForReadiness;

  // Trim before split-or-default so a name of "  " doesn't render
  // "Hey , here's your quote" — guards against whitespace-only DB rows.
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');

  const PinIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13z"/><circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
  const DocIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>
    </svg>
  );
  const PlugIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7V2"/><path d="M15 7V2"/><path d="M6 11V7h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><path d="M12 15v7"/>
    </svg>
  );
  const MapIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  );
  const ChatIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  const ClockIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );

  const openMaps = () => window.open(`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`, '_blank', 'noopener');
  const textCustomer = () => onOpenTab?.('messages');
  // Jump to Schedule tab — the AddEventInline form there is the closest
  // we have to a reschedule UI today (until a per-event edit modal ships).
  const reschedule = () => onOpenTab?.('calendar');

  return (
    <div style={{ background:'white', marginTop:12, padding:'14px 16px', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Next job</div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
        <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{event.title}</div>
        <StatusPill status={event.kind} />
      </div>
      <div style={{ fontSize:12, color:'#666', marginTop:2 }}>
        {formatDate(event.start_at)} · {formatTime(event.start_at)} · {relText}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13, color:NAVY, fontFamily:'inherit', fontWeight:500 }}>
        <span style={{ color:NAVY, display:'inline-flex' }}>{PinIcon}</span>
        <span>{street}{jurisdiction ? ' · ' + jurisdiction : ''}</span>
      </div>

      {permit && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:12, color:'#666' }}>
          <span style={{ color:PERMIT_COLORS[permit.status] || '#666', display:'inline-flex' }}>{DocIcon}</span>
          <span>Permit <span style={{ color:PERMIT_COLORS[permit.status] || '#666', fontWeight:600 }}>{capitalize(permit.status)}</span> · <span style={{ fontFamily:"'DM Mono', monospace" }}>{permit.permit_number}</span></span>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:12, color:'#666' }}>
        <span style={{ color:NAVY, display:'inline-flex' }}>{PlugIcon}</span>
        <span>Parts ready {ready}/{totalForReadiness}</span>
        <span style={{ width:8, height:8, borderRadius:'50%', background: readinessFull ? '#16a34a' : '#f59e0b', display:'inline-block', marginLeft:2 }} />
      </div>

      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={openMaps} style={{
          flex:1, height:32, borderRadius:8,
          background:'#ffba00', color:NAVY, border:'none',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>{MapIcon}<span>Get directions</span></button>
        <button onClick={textCustomer} style={{
          flex:1, height:32, borderRadius:8,
          background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>{ChatIcon}<span>Text {firstName}</span></button>
        <button onClick={reschedule} style={{
          flex:1, height:32, borderRadius:8,
          background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>{ClockIcon}<span>Reschedule</span></button>
      </div>
    </div>
  );
}


// ── Contact Calendar ──────────────────────────────────────────────
function ContactCalendar({ contact, events, highlightId, bumpData }) {
  const sorted = [...events].sort((a,b) => (a.start_at||'').localeCompare(b.start_at||''));
  const upcoming = sorted.filter(e => dayKey(e.start_at) >= TODAY)[0];
  const past = sorted.filter(e => dayKey(e.start_at) < TODAY).slice(-3).reverse();

  const fmtRow = iso => `${formatDate(iso, { month:'short', day:'numeric' })} · ${formatTime(iso)}`;
  // 60-min default when end_at is null so the card never renders "NaN hr".
  const durMin = ev => {
    if (!ev.end_at || !ev.start_at) return 60;
    const m = Math.round((new Date(ev.end_at) - new Date(ev.start_at)) / 60000);
    return Number.isFinite(m) && m > 0 ? m : 60;
  };
  const durLabel = m => m >= 60 ? `${Math.round(m/60*10)/10} hr`.replace('.0','') : `${m} min`;
  const subtitle = ev => ev.kind === 'install'
    ? `${durLabel(durMin(ev))} · ${contactName(contact)}'s residence`
    : durLabel(durMin(ev));

  // Countdown banner — calculates real days-until-install from the next
  // scheduled install event, or null if there's nothing scheduled. No more
  // hardcoded "Day 7 of 14" — that read like a fake demo on day one.
  let dayBanner = null;
  if (upcoming) {
    const ms = new Date(upcoming.start_at).getTime() - Date.now();
    const days = Math.round(ms / 86400000);
    if (!isNaN(days)) {
      if (days === 0) dayBanner = 'Today';
      else if (days === 1) dayBanner = 'Tomorrow';
      else if (days > 1) dayBanner = `In ${days} days`;
    }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'12px 16px 16px' }}>
      {dayBanner && (
        <div style={{
          width:'100%', textAlign:'center',
          background:'white', border:'1px solid #ffba00',
          color:NAVY, fontWeight:600, fontSize:13,
          padding:'8px 14px', borderRadius:8, marginBottom:12,
        }}>{dayBanner}</div>
      )}

      {upcoming && (
        <div style={{
          background:'white', borderRadius:8, marginBottom:10,
          borderLeft:'3px solid #ffba00',
          border:'1px solid rgba(11,31,59,0.08)',
          borderLeftWidth:3, borderLeftColor:'#ffba00',
          padding:'12px 14px',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
        }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{upcoming.title}</div>
            <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{subtitle(upcoming)}</div>
          </div>
          <div style={{ fontSize:12, color:NAVY, fontFamily:"'DM Mono', monospace", whiteSpace:'nowrap', flexShrink:0 }}>
            {fmtRow(upcoming.start_at)}
          </div>
        </div>
      )}

      {past.map(ev => (
        <div key={ev.id} style={{
          background:'white', borderRadius:8, marginBottom:10,
          border:'1px solid rgba(11,31,59,0.08)',
          padding:'12px 14px', opacity:0.7,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
        }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{ev.title}</div>
            <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{durLabel(durMin(ev))}</div>
          </div>
          <div style={{ fontSize:12, color:NAVY, fontFamily:"'DM Mono', monospace", whiteSpace:'nowrap', flexShrink:0 }}>
            {fmtRow(ev.start_at)}
          </div>
        </div>
      ))}

      <AddEventInline contact={contact} bumpData={bumpData} hasUpcoming={!!upcoming} />

      {!upcoming && past.length === 0 && (
        <div style={{ padding:'48px 24px', textAlign:'center', color:MUTED, fontSize:13 }}>No events scheduled yet</div>
      )}
    </div>
  );
}

// Inline event creator. Opens a small form pinned below the event list with
// kind / date / time / title; on save inserts into calendar_events table and
// optimistically pushes the row into CRM.events so the list updates.
function AddEventInline({ contact, bumpData, hasUpcoming }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState('install');
  // Cross-tab trigger: Contact tab's "Schedule install" gold button on
  // stage=permit_approved dispatches `crm-open-add-event` to expand this
  // form without forcing Key to manually tap "+ Add event".
  React.useEffect(() => {
    const onOpen = (e) => {
      if (e.detail?.contactId === contact.id) setOpen(true);
    };
    window.addEventListener('crm-open-add-event', onOpen);
    return () => window.removeEventListener('crm-open-add-event', onOpen);
  }, [contact.id]);
  // Default to tomorrow in LOCAL time. toISOString() returns UTC which
  // ticks to the day-after-tomorrow after 8 PM EDT.
  const [date, setDate] = React.useState(() => {
    const d = new Date(Date.now() + 24*3600*1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [time, setTime] = React.useState('09:00');
  const [title, setTitle] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const KIND_OPTIONS = [
    { v:'install',   label:'Install' },
    { v:'inspect',   label:'Inspection' },
    { v:'follow_up', label:'Follow-up call' },
    { v:'pickup',    label:'Pickup' },
    { v:'meeting',   label:'Meeting' },
  ];

  const defaultTitleFor = (k) => ({ install:'Install', inspect:'Inspection', follow_up:'Follow-up call', pickup:'Pickup', meeting:'Meeting' }[k] || 'Event');

  const save = async () => {
    if (!CRM.__db) { window.showToast?.('Supabase not loaded'); return; }
    if (!date || !time) { window.showToast?.('Pick a date and time'); return; }
    setSaving(true);
    const startIso = new Date(`${date}T${time}:00`).toISOString();
    // Default 1-hour duration; install runs 3 hours.
    const durMin = kind === 'install' ? 180 : kind === 'inspect' ? 30 : 60;
    const endIso = new Date(new Date(startIso).getTime() + durMin*60*1000).toISOString();
    const row = {
      contact_id: contact.id,
      kind,
      title: defaultTitleFor(kind),
      start_at: startIso,
      end_at: endIso,
      status: 'scheduled',
    };
    const { data, error } = await CRM.__db.from('calendar_events').insert(row).select().single();
    if (error) { setSaving(false); window.showToast?.(`Save failed: ${error.message}`); return; }
    CRM.events.push({
      id: data.id, contact_id: data.contact_id, kind: data.kind,
      start_at: data.start_at, end_at: data.end_at, title: data.title, status: data.status || 'scheduled',
    });
    setSaving(false);
    setOpen(false);
    setTitle('');
    bumpData?.();
    window.showToast?.('Event scheduled');
  };

  if (!open) {
    return (
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        {/* Reschedule button removed — it only toasted "coming soon" and
            misled Key into expecting it works. Re-add when the per-event
            edit modal ships. */}
        <button onClick={() => setOpen(true)} style={{
          flex:1, height:36, borderRadius:8, background:'#ffba00', color:NAVY, border:'none',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
        }}>+ Add event</button>
      </div>
    );
  }

  // fontSize 16 prevents iOS Safari auto-zoom on focus.
  const inputStyle = { width:'100%', padding:'10px 10px', fontSize:16, fontFamily:'inherit', border:'1px solid rgba(11,31,59,0.15)', borderRadius:6, background:'white', color:NAVY, boxSizing:'border-box' };
  return (
    <div style={{ marginTop:12, padding:14, background:'white', border:'1px solid rgba(11,31,59,0.12)', borderRadius:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.06em', marginBottom:10 }}>NEW EVENT</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <select value={kind} onChange={e=>setKind(e.target.value)} style={inputStyle}>
          {KIND_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {/* Equal-width date + time. `flex:1 1 0; min-width:0` forces a true
            50/50 split regardless of the date input's intrinsic width
            (which is wider than time on Chrome because of mm/dd/yyyy + the
            calendar picker icon). */}
        <div style={{ display:'flex', gap:8 }}>
          <input
            type="date"
            value={date}
            min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
            max="2099-12-31"
            onChange={e=>setDate(e.target.value)}
            style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }}
          />
          <input
            type="time"
            value={time}
            onChange={e=>setTime(e.target.value)}
            style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }}
          />
        </div>
      </div>
      {/* Equal-width Cancel + Schedule. Same `flex:1 1 0; min-width:0` trick
          since "Saving…" can be wider than "Cancel" and would otherwise
          push the buttons to unequal widths. */}
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button onClick={() => setOpen(false)} disabled={saving} style={{
          flex:'1 1 0', minWidth:0, height:40, borderRadius:8, background:'white', color:NAVY,
          border:'1px solid rgba(27,43,75,0.15)', fontSize:14, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
        }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{
          flex:'1 1 0', minWidth:0, height:40, borderRadius:8, background:'#ffba00', color:NAVY, border:'none',
          fontSize:14, fontWeight:600, fontFamily:'inherit', cursor:'pointer', opacity:saving?0.6:1,
        }}>{saving ? 'Saving…' : 'Schedule'}</button>
      </div>
    </div>
  );
}

// ── Contact Finance ───────────────────────────────────────────────
function ContactFinance({ contact, proposals, invoices, highlightId }) {
  const proposal = [...proposals].sort((a,b) => (b.sent_at||'').localeCompare(a.sent_at||''))[0];
  const sortedInvoices = [...invoices].sort((a,b) => (a.sent_at||'').localeCompare(b.sent_at||''));

  // P1 modals — proposal/invoice builders. State lives at this level so the
  // modals stay open across re-renders from realtime updates.
  const [proposalModalOpen, setProposalModalOpen] = React.useState(false);
  const [invoiceModalOpen,  setInvoiceModalOpen]  = React.useState(false);

  // Cross-tab triggers — Contact tab's "Send quote" gold button on stage=NEW
  // dispatches `crm-open-new-proposal` to skip the user manually navigating
  // to Finance + tapping "+ New proposal".
  React.useEffect(() => {
    const onOpen = (e) => {
      if (e.detail?.contactId === contact.id) setProposalModalOpen(true);
    };
    window.addEventListener('crm-open-new-proposal', onOpen);
    return () => window.removeEventListener('crm-open-new-proposal', onOpen);
  }, [contact.id]);

  // Mark paid — manual override for cash/check payments. Optimistic; rolls
  // back if the DB update fails.
  const markingRef = React.useRef(new Set());
  const markPaid = async (inv) => {
    if (markingRef.current.has(inv.id)) return;
    markingRef.current.add(inv.id);
    try {
      const now = new Date().toISOString();
      // Look up the live invoice by id — `inv` may be a stale closure if
      // realtime swapped the array between when the row rendered and now.
      const live = (CRM.invoices || []).find(x => x.id === inv.id) || inv;
      const prevStatus = live.status;
      const prevPaidAt = live.paid_at;
      // Optimistic update so the pill flips immediately.
      live.status = 'paid'; live.paid_at = now;
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      const { error } = await CRM.__db.from('invoices').update({ status: 'paid', paid_at: now }).eq('id', inv.id);
      if (error) {
        live.status = prevStatus; live.paid_at = prevPaidAt;
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        window.showToast?.(`Mark paid failed: ${error.message}`);
        return;
      }
      // 5-second undo — fat-finger insurance. Pattern matches archiveJob.
      // Re-resolve the live invoice on undo because realtime may have
      // swapped CRM.invoices since the optimistic mutation.
      window.showToast?.('Marked paid', {
        undo: async () => {
          const liveNow = (CRM.invoices || []).find(x => x.id === inv.id) || live;
          liveNow.status = prevStatus; liveNow.paid_at = prevPaidAt;
          window.dispatchEvent(new CustomEvent('crm-data-changed'));
          if (CRM.__db) {
            const { error: undoErr } = await CRM.__db.from('invoices').update({ status: prevStatus, paid_at: prevPaidAt }).eq('id', inv.id);
            if (undoErr) window.showToast?.(`Undo failed: ${undoErr.message}`);
          }
        },
        duration: 5000,
      });
    } finally {
      markingRef.current.delete(inv.id);
    }
  };

  const tierLabel = t => t === 'premium_plus' ? 'Premium+' : t === 'premium' ? 'Premium' : 'Standard';

  const FIN_PILL = {
    paid:     { bg:'#16a34a', color:'white', label:'Paid' },
    sent:     { bg:'#2563eb', color:'white', label:'Sent' },
    viewed:   { bg:'#2563eb', color:'white', label:'Viewed' },
    overdue:  { bg:'#dc2626', color:'white', label:'Overdue' },
    approved: { bg:'#16a34a', color:'white', label:'Approved' },
    declined: { bg:'#dc2626', color:'white', label:'Declined' },
    draft:    { bg:'#999',    color:'white', label:'Draft' },
  };
  const Pill = ({ status }) => {
    const p = FIN_PILL[status] || FIN_PILL.draft;
    return <span style={{ background:p.bg, color:p.color, padding:'4px 10px', borderRadius:4, fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{p.label}</span>;
  };

  const Eyebrow = ({ children }) => (
    <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:14, marginBottom:8 }}>{children}</div>
  );

  const fmtShort = iso => iso ? formatDate(iso, { month:'short', day:'numeric' }) : null;
  // Trim before split-or-default so a name of "  " doesn't render
  // "Hey , here's your quote" — guards against whitespace-only DB rows.
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');

  // Both proposal.html and invoice.html parse `?token=<uuid>` from the query
  // string — verified against proposal.html:403 and invoice.html:189.
  const proposalUrl = (p) => p?.token ? `https://backuppowerpro.com/proposal.html?token=${p.token}` : null;
  const invoiceUrl  = (i) => i?.token ? `https://backuppowerpro.com/invoice.html?token=${i.token}`  : null;

  const propActivity = p => {
    const verbByStatus = { approved:'Approved', declined:'Declined', sent:null, viewed:null, draft:null };
    const respondedVerb = verbByStatus[p.status];
    const parts = [];
    if (p.sent_at)     parts.push(`Sent ${fmtShort(p.sent_at)}`);
    if (p.viewed_at)   parts.push(`Viewed ${fmtShort(p.viewed_at)}`);
    if (respondedVerb && p.approved_at) parts.push(`${respondedVerb} ${fmtShort(p.approved_at)}`);
    return parts.join(' → ');
  };
  const invActivity = i => {
    const parts = [];
    if (i.sent_at)   parts.push(`Sent ${fmtShort(i.sent_at)}`);
    if (i.viewed_at) parts.push(`Viewed ${fmtShort(i.viewed_at)}`);
    if (i.paid_at)   parts.push(`Paid ${fmtShort(i.paid_at)}`);
    return parts.join(' → ');
  };

  const SendIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
  const CopyIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
  const EyeIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  // sendingRef prevents double-fire on rapid taps. The idempotency key uses
  // the linkUrl + contact.id (NOT Date.now()), so even if the click DOES land
  // twice, the server de-dupes the SMS.
  // Lock keyed by contact-id + URL — prevents the rare-but-real case where
  // two contacts share a token (data bug or migration race) from one
  // accidentally suppressing the other's send.
  const sendingRef = React.useRef(new Set());
  const sendLink = async (linkUrl) => {
    const lockKey = `${contact.id}::${linkUrl}`;
    if (contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (!CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    if (sendingRef.current.has(lockKey)) return;
    sendingRef.current.add(lockKey);
    const body = `Here's your update from Backup Power Pro: ${linkUrl}`;
    // Stable idempotency: same key for the same contact+link combo for 60s
    // window. If Key clicks twice within seconds, the server sees the same
    // key and only fires one SMS.
    const minute = Math.floor(Date.now() / 60000);
    // Don't include the linkUrl directly — that base64s the customer-facing
    // proposal/invoice token into edge-fn telemetry. We just need the key
    // to be stable per-contact + per-minute, so a deterministic non-token
    // hash is enough to dedupe rapid double-clicks without leaking entropy.
    const linkKind = linkUrl.includes('/invoice.html') ? 'inv' : linkUrl.includes('/proposal.html') ? 'prop' : 'link';
    const idempotencyKey = `v3-send-${contact.id}-${linkKind}-${minute}`;
    window.showToast?.(`Sending to ${firstName}…`);
    try {
      const { data, error } = await CRM.__invokeFn('send-sms', {
        body: { contactId: contact.id, body, idempotencyKey },
      });
      if (error || (data && data.success === false)) {
        window.showToast?.(`Send failed: ${error?.message || data?.error || 'unknown'}`);
        return;
      }
      window.showToast?.(`SMS sent to ${firstName}`);
    } finally {
      // Release the lock after 2s so a second click within that window
      // is silently ignored.
      setTimeout(() => sendingRef.current.delete(lockKey), 2000);
    }
  };
  const copyLink = async (linkUrl) => {
    try { await navigator.clipboard.writeText(linkUrl); window.showToast?.('Link copied'); }
    catch { window.showToast?.('Copy failed'); }
  };
  const viewAsCustomer = (linkUrl) => {
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  const FinanceRow = ({ left, money, status, activity, linkUrl, onMarkPaid }) => {
    const sharedBtn = {
      height:32, padding:'0 12px', borderRadius:8,
      fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      whiteSpace:'nowrap', flex:1, minWidth:0,
    };
    return (
      <div style={{
        background:'white', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8,
        padding:'12px 14px', marginBottom:8,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{left}</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:14, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace" }}>{money}</span>
            <Pill status={status} />
          </div>
        </div>
        {activity && (
          <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:'#666', marginTop:6 }}>{activity}</div>
        )}
        {/* Compact 3-button row that fits a 358px-content mobile viewport.
            Long labels ("Send to customer") were clipping past the 106px
            button width — switched to icon + short verb so each button
            stays inside its bounds. Aria-label keeps the screenreader
            context. */}
        <div style={{ display:'flex', gap:6, marginTop:10 }}>
          <button onClick={()=>sendLink(linkUrl)} aria-label="Send to customer" style={{ ...sharedBtn, background:'#ffba00', color:NAVY, border:'none' }}>
            {SendIcon}<span>Send</span>
          </button>
          <button onClick={()=>copyLink(linkUrl)} aria-label="Copy link" style={{ ...sharedBtn, background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)' }}>
            {CopyIcon}<span>Copy</span>
          </button>
          <button onClick={()=>viewAsCustomer(linkUrl)} aria-label="View as customer" style={{ ...sharedBtn, background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)' }}>
            {EyeIcon}<span>View</span>
          </button>
        </div>
        {/* Mark paid — only on sent (unpaid) invoices. Manual override
            for cash/check payments. Ghost styling so it doesn't compete
            with the gold "Send to customer" CTA. */}
        {onMarkPaid && (
          <div style={{ display:'flex', marginTop:6 }}>
            <button onClick={onMarkPaid} style={{
              // 40px hits the iOS HIG floor; visually still secondary
              // because of the ghost styling vs the gold Send CTA.
              minHeight:40, padding:'0 14px', borderRadius:8,
              background:'transparent', color:'#16a34a',
              border:'1px solid rgba(22,163,74,0.35)',
              fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
            }}>Mark paid</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'12px 16px 16px' }}>
      {/* LTV display removed per Key's directive — not load-bearing
          without a repeat-client business model. */}
      {proposal && (
        <>
          <Eyebrow>Proposal</Eyebrow>
          <FinanceRow left={tierLabel(proposal.tier)} money={formatMoneyCents(proposal.amount_cents)} status={proposal.status} activity={propActivity(proposal)} linkUrl={proposalUrl(proposal)} />
        </>
      )}

      {sortedInvoices.length > 0 && (
        <>
          <Eyebrow>Invoices</Eyebrow>
          {sortedInvoices.map(inv => (
            <FinanceRow
              key={inv.id}
              left={capitalize(inv.kind)}
              money={formatMoneyCents(inv.amount_cents)}
              status={inv.status}
              activity={invActivity(inv)}
              linkUrl={invoiceUrl(inv)}
              onMarkPaid={inv.status === 'sent' || inv.status === 'overdue' ? () => markPaid(inv) : null}
            />
          ))}
        </>
      )}

      {/* P1 builder modals — open in-place. v1 quote builder is no longer
          the fallback; v3 owns proposal + invoice creation now. */}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={() => setProposalModalOpen(true)} style={{
          flex:1, height:36, borderRadius:8,
          background:'white', color:NAVY, border:'1px solid rgba(11,31,59,0.15)',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>+ New proposal</button>
        <button onClick={() => setInvoiceModalOpen(true)} style={{
          flex:1, height:36, borderRadius:8,
          background:'white', color:NAVY, border:'1px solid rgba(11,31,59,0.15)',
          fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>+ New invoice</button>
      </div>

      {!proposal && sortedInvoices.length === 0 && (
        <div style={{ padding:'48px 24px', textAlign:'center', color:MUTED, fontSize:13 }}>No proposals yet</div>
      )}

      {proposalModalOpen && (
        <NewProposalModal contact={contact} onClose={() => setProposalModalOpen(false)} />
      )}
      {invoiceModalOpen && (
        <NewInvoiceModal contact={contact} latestSignedProposal={proposals.find(p => p.status === 'approved')} invoices={invoices} onClose={() => setInvoiceModalOpen(false)} />
      )}
    </div>
  );
}

// ── Contact Messages ──────────────────────────────────────────────
const SUGGESTIONS = ['Confirm install time', 'Send install reminder', 'Ask for review'];

function ContactMessages({ contact, thread, isDnc }) {
  const draftKey = 'draft:' + contact.id;
  // Sort thread chronologically (DB is unordered)
  const sortedThread = React.useMemo(
    () => [...thread].sort((a,b) => (a.sent_at||'').localeCompare(b.sent_at||'')),
    [thread]
  );

  const [msg, setMsg] = React.useState(() => sessionStorage.getItem(draftKey) || '');
  const [localMsgs, setLocalMsgs] = React.useState([]); // optimistic-sent messages
  const [attachments, setAttachments] = React.useState([]);
  const containerRef = React.useRef(null);
  const imgRef = React.useRef(null);
  const fileRef = React.useRef(null);

  // Track every blob URL we mint so we can revoke on cleanup. Without this,
  // each photo attachment leaks its blob until the page unloads — and Key
  // adds attachments hundreds of times a day.
  const blobUrlsRef = React.useRef(new Set());
  const revokeAndForget = (url) => {
    if (url && blobUrlsRef.current.has(url)) {
      try { URL.revokeObjectURL(url); } catch {}
      blobUrlsRef.current.delete(url);
    }
  };

  // Reset locals when contact changes — also revoke any in-flight blob URLs
  // so switching contacts mid-attachment doesn't leak.
  React.useEffect(() => {
    setMsg(sessionStorage.getItem(draftKey) || '');
    setLocalMsgs([]);
    setAttachments(prev => { prev.forEach(a => revokeAndForget(a.url)); return []; });
  }, [contact.id]);

  // Revoke any remaining blob URLs on unmount.
  React.useEffect(() => () => {
    blobUrlsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    blobUrlsRef.current.clear();
  }, []);

  // Persist draft
  React.useEffect(() => {
    if (msg) sessionStorage.setItem(draftKey, msg);
    else sessionStorage.removeItem(draftKey);
  }, [msg, draftKey]);

  // Combined view = persisted + optimistic
  const allMsgs = React.useMemo(() => [...sortedThread, ...localMsgs], [sortedThread, localMsgs]);

  React.useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [allMsgs]);

  const sendingRef = React.useRef(false);
  const send = async () => {
    const body = msg.trim();
    if (!body && !attachments.length) return;
    if (contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    // Optimistic bubble + clear compose immediately so Key feels the action.
    const tempId = 'n' + Date.now();
    setLocalMsgs(m => [...m, {
      id: tempId,
      contact_id: contact.id,
      direction: 'out',
      sender_role: 'key',
      body,
      attachments: [...attachments],
      sent_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    }]);
    setMsg('');
    // Don't revoke URLs here — the bubble preview still references them. They
    // get cleaned on contact change / unmount via blobUrlsRef.
    setAttachments([]);
    sessionStorage.removeItem(draftKey);
    if (!CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded — message not sent');
      sendingRef.current = false;
      return;
    }
    try {
      // Stable idempotency: contact + minute bucket. Defends against
      // double-click / repeated submit during transient errors. Body
      // included via length+kind so different texts don't collide.
      const idempotencyKey = `v3-msg-${contact.id}-${body.length}-${Math.floor(Date.now() / 60000)}`;
      const { data, error } = await CRM.__invokeFn('send-sms', {
        body: { contactId: contact.id, body, idempotencyKey },
      });
      if (error || (data && data.success === false)) {
        // Rollback the optimistic bubble + restore the compose so Key can
        // retry. Better than silently leaving a phantom "sent" message.
        setLocalMsgs(m => m.filter(x => x.id !== tempId));
        setMsg(body);
        window.showToast?.(`Send failed: ${error?.message || data?.error || 'unknown'}`);
        return;
      }
      window.showToast?.('Sent');
    } catch (e) {
      setLocalMsgs(m => m.filter(x => x.id !== tempId));
      setMsg(body);
      window.showToast?.(`Send failed: ${e.message || e}`);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleFile = e => {
    Array.from(e.target.files).forEach(f => {
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        blobUrlsRef.current.add(url);
        setAttachments(a => [...a, { type:'image', name:f.name, url }]);
      } else {
        setAttachments(a => [...a, { type:'file', name:f.name, size:(f.size/1024).toFixed(0)+'KB' }]);
      }
    });
    e.target.value = '';
  };

  // Group by day for the date dividers
  const grouped = allMsgs.reduce((acc, m) => {
    const d = dayKey(m.sent_at);
    (acc[d] = acc[d] || []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, position:'relative', background:'#F8F8F6' }}>
      <div ref={containerRef} style={{ flex:1, overflowY:'auto', minHeight:0, padding:'12px 16px', display:'flex', flexDirection:'column' }}>
        {Object.entries(grouped).map(([day, dayMsgs]) => (
          <div key={day}>
            <div style={{ textAlign:'center', margin:'8px 0', fontSize:10, color:MUTED, fontWeight:600, letterSpacing:'0.05em' }}>
              {formatDate(day, { weekday:'long', month:'short', day:'numeric' })}
            </div>
            {dayMsgs.map(m => {
              const isOut = m.direction === 'out' || m.sender_role === 'key';
              return (
                <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: isOut ? 'flex-end' : 'flex-start', marginBottom:10 }}>
                  <div style={{
                    maxWidth:'80%', padding: m.attachments?.length ? '7px' : '9px 13px',
                    fontSize:13, lineHeight:1.45,
                    borderRadius: isOut ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: isOut ? '#0b1f3b' : 'white',
                    color: isOut ? 'white' : NAVY,
                    border: isOut ? 'none' : '1px solid rgba(11,31,59,0.12)',
                  }}>
                    {m.attachments?.map((a,i) => a.type==='image'
                      ? <img key={i} src={a.url} alt={a.name} style={{ width:'100%', maxWidth:200, borderRadius:8, display:'block', marginBottom: m.body?5:0 }}/>
                      : <div key={i} style={{ background:'rgba(255,255,255,0.15)', borderRadius:6, padding:'5px 9px', fontSize:11, display:'flex', alignItems:'center', gap:5, marginBottom: m.body?5:0 }}>📎 {a.name} <span style={{opacity:0.6}}>{a.size}</span></div>
                    )}
                    {m.body && <span style={{ padding: m.attachments?.length ? '0 5px' : 0 }}>{m.body}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#999', fontFamily:"'DM Mono', monospace", marginTop:3 }}>{formatTime(m.sent_at)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Reply suggestions */}
      <div className="hide-scrollbar" style={{ padding:'4px 12px 0', display:'flex', gap:8, overflowX:'auto', flexShrink:0 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={()=>setMsg(s)} style={{
            height:30, padding:'0 12px', borderRadius:6,
            border:'1px solid rgba(11,31,59,0.15)', background:'white', color:NAVY,
            fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
            fontFamily:'inherit', flexShrink:0,
          }}>{s}</button>
        ))}
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={{ padding:'6px 12px 0', background:'transparent', display:'flex', gap:5, flexWrap:'wrap', flexShrink:0 }}>
          {attachments.map((a,i) => (
            <div key={i} style={{ position:'relative' }}>
              {a.type==='image'
                ? <img src={a.url} alt={a.name} style={{ width:52, height:52, borderRadius:6, objectFit:'cover' }}/>
                : <div style={{ width:52, height:52, borderRadius:6, background:'white', border:'1px solid rgba(11,31,59,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📎</div>}
              <button onClick={()=>setAttachments(a => a.filter((_,j) => j !== i))} style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:'50%', background:'#E53E3E', border:'2px solid white', color:'white', fontSize:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {isDnc && (
        <div style={{ margin:'8px 16px 12px', padding:'12px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#991B1B', marginBottom:3 }}>Compose disabled</div>
          <div style={{ fontSize:11, color:'#991B1B', lineHeight:1.5 }}>This contact is marked do-not-contact. Remove the flag to message them.</div>
        </div>
      )}

      {/* Compose */}
      {!isDnc && (
        <div style={{ padding:'10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Message…"
            style={{
              flex:1, minHeight:40, maxHeight:120,
              borderRadius:8, border:'1px solid rgba(11,31,59,0.15)',
              padding:'10px 12px', fontSize:16, fontFamily:'inherit', resize:'none', outline:'none',
              color:NAVY, lineHeight:1.4, boxSizing:'border-box', background:'white',
            }}
          />
          <button onClick={send} aria-label="Send" style={{
            width:36, height:36, borderRadius:8,
            background:'#ffba00', color:NAVY, border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      )}

      {allMsgs.length === 0 && !isDnc && (
        <div style={{ position:'absolute', top:'40%', left:0, right:0, textAlign:'center', color:MUTED, pointerEvents:'none' }}>
          <div style={{ fontSize:13, fontWeight:500 }}>Quiet thread.</div>
          <div style={{ fontSize:12, marginTop:2 }}>{contactName(contact)} hasn't messaged yet.</div>
        </div>
      )}
    </div>
  );
}

// ── Contact Calls ─────────────────────────────────────────────────
function ContactCalls({ contact, calls, isDnc }) {
  const sorted = [...calls].sort((a,b) => (b.started_at||'').localeCompare(a.started_at||''));

  const ICON_OUT = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/>
    </svg>
  );
  const ICON_IN = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="7" x2="7" y2="17"/><polyline points="16 17 7 17 7 8"/>
    </svg>
  );
  const ICON_MISSED = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
    </svg>
  );
  const STYLES = {
    out:    { bg:'#dcfce7', color:'#16a34a', icon: ICON_OUT,    label:'Outgoing' },
    in:     { bg:'#dbeafe', color:'#2563eb', icon: ICON_IN,     label:'Incoming' },
    missed: { bg:'#fee2e2', color:'#dc2626', icon: ICON_MISSED, label:'Missed'   },
  };

  const fmtRow = iso => `${formatDate(iso, { month:'short', day:'numeric' })} · ${formatTime(iso)}`;

  return (
    <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'12px 16px 16px' }}>
      {/* Real tel: handoff — opens the system dialer. No fake "Starting
          call…" toast that doesn't actually do anything. Twilio Voice SDK
          dial-from-browser is a future feature; today this routes through
          the iPhone's native phone app (which is what Key wants anyway). */}
      {isDnc ? (
        <button disabled style={{
          width:'100%', height:44, borderRadius:8,
          background:'#E5E7EB', color:MUTED,
          border:'none', cursor:'not-allowed',
          fontSize:14, fontWeight:600, fontFamily:'inherit',
          marginBottom:12, padding:'12px 16px',
        }}>DNC — calls disabled</button>
      ) : (
        <a href={contact?.phone ? `tel:${contact.phone}` : undefined}
           aria-disabled={!contact?.phone}
           style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:'100%', height:44, borderRadius:8,
            background: contact?.phone ? '#ffba00' : '#E5E7EB',
            color: contact?.phone ? NAVY : MUTED,
            border:'none', textDecoration:'none',
            cursor: contact?.phone ? 'pointer' : 'not-allowed',
            fontSize:14, fontWeight:600, fontFamily:'inherit',
            marginBottom:12,
            pointerEvents: contact?.phone ? 'auto' : 'none',
          }}>{contact?.phone ? `Call ${formatPhone(contact.phone)}` : 'No phone on file'}</a>
      )}

      {sorted.map(cl => {
        const s = STYLES[cl.direction] || STYLES.out;
        const dur = cl.direction === 'missed' ? '—' : formatDuration(cl.duration_sec);
        return (
          <div key={cl.id} style={{
            background:'white', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8,
            padding:'12px 14px', marginBottom:8,
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              width:32, height:32, borderRadius:'50%',
              background:s.bg, color:s.color,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>{s.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{s.label}</div>
              <div style={{ fontSize:12, color:'#666', marginTop:2, fontFamily:"'DM Mono', monospace" }}>{fmtRow(cl.started_at)}</div>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace", flexShrink:0 }}>{dur}</div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div style={{ padding:'40px 24px', textAlign:'center', fontSize:13, color:MUTED }}>No calls yet</div>
      )}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────
// Centered card on desktop, bottom-sheet on mobile (≤900px). Backdrop
// click closes; Escape key closes (top of stack only); focus traps
// inside the card while open. Renders via portal to body so the modal
// sits above all panes regardless of which subtree mounted it.
//
// Module-level scroll lock + escape stack so two stacked modals don't
// (a) leave the body permanently scroll-locked, or (b) close all-at-once
// on a single Escape keystroke.
let __modalLockCount = 0;
let __modalSavedOverflow = '';
const __modalEscapeStack = [];
function __pushModalLock(closeFn) {
  if (__modalLockCount === 0) {
    __modalSavedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  __modalLockCount += 1;
  __modalEscapeStack.push(closeFn);
}
function __popModalLock(closeFn) {
  const i = __modalEscapeStack.indexOf(closeFn);
  if (i >= 0) __modalEscapeStack.splice(i, 1);
  __modalLockCount = Math.max(0, __modalLockCount - 1);
  if (__modalLockCount === 0) {
    document.body.style.overflow = __modalSavedOverflow;
    __modalSavedOverflow = '';
  }
}
if (typeof document !== 'undefined' && !window.__modalEscapeBound) {
  window.__modalEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = __modalEscapeStack[__modalEscapeStack.length - 1];
    if (top) { e.stopPropagation(); top(); }
  });
}

function ModalShell({ open, onClose, title, footer, children }) {
  const overlayRef = React.useRef(null);
  const cardRef = React.useRef(null);

  // Keep the latest onClose in a ref so the lock effect can safely depend
  // ONLY on `open`. Otherwise an inline `() => setOpen(false)` parent prop
  // re-creates the function each render, the effect re-runs every realtime
  // tick, and the escape stack reorders incorrectly when modals stack.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const closeFn = () => onCloseRef.current?.();
    __pushModalLock(closeFn);
    // Focus the card so subsequent Tab cycles inside it.
    setTimeout(() => cardRef.current?.focus(), 0);
    return () => { __popModalLock(closeFn); };
  }, [open]);

  if (!open) return null;
  // 900px matches the app shell's mobile/desktop split (crm-app.jsx). iPad
  // Mini at 768px gets the bottom-sheet so the modal feels native, not a
  // tiny popup floating in the middle.
  const isMobile = (typeof window !== 'undefined' && window.innerWidth < 900);

  const overlay = (
    <div
      ref={overlayRef}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(11,31,59,0.45)',
        display:'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent:'center',
        padding: isMobile ? 0 : 16,
        animation:'bpp-fade-up 180ms ease-out both',
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        style={{
          background:'white',
          borderRadius: isMobile ? '16px 16px 0 0' : 12,
          width: isMobile ? '100%' : 'min(440px, calc(100vw - 32px))',
          // dvh = dynamic viewport height. iOS Safari shrinks dvh when the
          // keyboard pops up so the bottom sheet's footer (Send button)
          // doesn't get covered. vh stays full-screen and hides the CTA.
          maxHeight: isMobile ? '92dvh' : '88vh',
          display:'flex', flexDirection:'column',
          boxShadow:'0 20px 60px rgba(11,31,59,0.25)',
          outline:'none',
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0,
          animation: isMobile ? 'bpp-slide-up 220ms cubic-bezier(0.2,0.8,0.3,1) both' : 'bpp-fade-up 220ms cubic-bezier(0.2,0.8,0.3,1) both',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding:'10px 14px 10px 18px', borderBottom:'1px solid rgba(11,31,59,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0, fontSize:15, fontWeight:700, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{
            width:44, height:44, borderRadius:6, border:'none', background:'transparent',
            color:'#666', fontSize:24, lineHeight:1, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding:'12px 18px 14px', borderTop:'1px solid rgba(11,31,59,0.08)', flexShrink:0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}

// ── New Proposal Modal ────────────────────────────────────────────────
// Quick-quote — amp toggle, tier selector, add-on chips, auto-total,
// "Send to customer" inserts proposal + fires send-sms in one move.
// Mirrors the v1/v2 pricing engine exactly so proposal.html renders
// the same totals.
function NewProposalModal({ contact, onClose }) {
  // Trim before split-or-default so a name of "  " doesn't render
  // "Hey , here's your quote" — guards against whitespace-only DB rows.
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');
  const [amp,        setAmp]        = React.useState(contact.amp_type || '30');
  const [tier,       setTier]       = React.useState(contact.pricing_tier || 'standard');
  const [cordIncluded,  setCord]    = React.useState(true);
  const [includeSurge,  setSurge]   = React.useState(false);
  const [includePom,    setPom]     = React.useState(false);
  const [includePermit, setPermit]  = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const total = React.useMemo(() => quickQuoteTotal({
    amp, cordIncluded, includeSurge, includePom, includePermit, tier,
  }), [amp, cordIncluded, includeSurge, includePom, includePermit, tier]);

  // Pre-fill jurisdiction badge — purely informational. Uses the
  // contact's mapped jurisdiction (county for permit-allowlist matches like
  // Inman→Spartanburg, falling back to city). Don't recompute via raw
  // cityFromAddress because that returns the city ("Inman"), not the
  // permit-relevant county ("Spartanburg").
  const jurisdiction = contact.jurisdiction || '—';

  const submit = async () => {
    if (busy) return;
    if (contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (!CRM.__db || !CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    setBusy(true);
    try {
      const pricing30 = quickQuoteCompute({ amp:'30', cordIncluded, includeSurge, includePom, includePermit });
      const pricing50 = quickQuoteCompute({ amp:'50', cordIncluded, includeSurge, includePom, includePermit });
      const payload = {
        contact_id: contact.id,
        contact_name:    contact.name    || '',
        contact_email:   contact.email   || '',
        contact_phone:   contact.phone   || '',
        contact_address: contact.address || '',
        amp_type: amp,
        selected_amp: amp,
        run_ft: 5,
        mode: 'standard',
        include_cord: !!cordIncluded,
        cord_included: !!cordIncluded,
        price_cord: cordIncluded ? 0 : (amp === '50' ? QB_S.cordValue50 : QB_S.cordValue30),
        include_surge: !!includeSurge,
        price_surge: includeSurge ? QB_S.surge : 0,
        surge_price: QB_S.surge,
        include_pom: !!includePom,
        pom_price: QB_S.pom,
        include_permit: !!includePermit,
        include_main_breaker: false,
        include_twin_quad: false,
        pricing_30: pricing30,
        pricing_50: pricing50,
        total,
        price_base: total,
        pricing_tier: tier,
        pricing_variant: null,
        notes: '',
        custom_items: [],
        status: 'Sent',
        require_deposit: true,
      };
      const { data, error } = await CRM.__db.from('proposals').insert([payload]).select().single();
      if (error || !data) {
        window.showToast?.(`Insert failed: ${error?.message || 'unknown'}`);
        setBusy(false);
        return;
      }
      // Bump contact stage 1 → 2 (NEW → QUOTED) so the chip rail counts match.
      if ((contact.stage || 1) === 1) {
        CRM.__db.from('contacts').update({ stage: 2 }).eq('id', contact.id).eq('stage', 1).then(() => {}, () => {});
      }
      // Persist tier choice back to the contact if Key tweaked it.
      if (tier !== (contact.pricing_tier || 'standard')) {
        CRM.__db.from('contacts').update({ pricing_tier: tier }).eq('id', contact.id).then(() => {}, () => {});
      }
      // Send the SMS with the proposal link. Stable idempotency key keeps
      // double-clicks from sending twice.
      const url = `https://backuppowerpro.com/proposal.html?token=${data.token}`;
      const minute = Math.floor(Date.now() / 60000);
      // Include amp+tier so two distinct proposals to the same contact
      // within the same minute (e.g. Key resends as 50A right after 30A)
      // don't collide on server-side dedup.
      const idempotencyKey = `v3-newprop-${contact.id}-${amp}-${tier}-${minute}`;
      const body = `Hey ${firstName}, here's your install quote from Backup Power Pro: ${url}`;
      const { error: smsErr } = await CRM.__invokeFn('send-sms', {
        body: { contactId: contact.id, body, idempotencyKey },
      });
      if (smsErr) {
        window.showToast?.(`Saved but send failed: ${smsErr.message}`);
      } else {
        window.showToast?.(`Proposal sent to ${firstName}`);
      }
      onClose();
    } catch (e) {
      window.showToast?.(`Failed: ${e.message || e}`);
      setBusy(false);
    }
  };

  const Chip = ({ on, onClick, children }) => (
    <button onClick={onClick} style={{
      flex:1, minWidth:0, height:36, borderRadius:8,
      background: on ? NAVY : 'white',
      color: on ? 'white' : NAVY,
      border: on ? 'none' : '1px solid rgba(11,31,59,0.15)',
      fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      whiteSpace:'nowrap',
    }}>{children}</button>
  );
  const Seg = ({ on, onClick, label, sub }) => (
    <button onClick={onClick} style={{
      flex:1, padding:'8px 6px', borderRadius:8,
      background: on ? NAVY : 'white',
      color: on ? 'white' : NAVY,
      border: on ? 'none' : '1px solid rgba(11,31,59,0.15)',
      fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
    }}>
      <span>{label}</span>
      {sub && <span style={{ fontSize:10, opacity:0.65, fontWeight:500 }}>{sub}</span>}
    </button>
  );

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`New proposal — ${contact.name || formatPhone(contact.phone)}`}
      footer={(
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Total</div>
            <div style={{ fontSize:22, fontWeight:700, color:NAVY, fontFamily:"'JetBrains Mono', 'DM Mono', monospace" }}>${total.toLocaleString()}</div>
          </div>
          <button
            onClick={submit}
            disabled={busy || contact.do_not_contact}
            style={{
              height:42, padding:'0 18px', borderRadius:8,
              background: busy || contact.do_not_contact ? '#E5E5E5' : '#ffba00',
              color: busy || contact.do_not_contact ? '#999' : NAVY,
              border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
              cursor: busy || contact.do_not_contact ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', gap:7,
            }}
          >
            {busy ? 'Sending…' : 'Send to customer'}
          </button>
        </div>
      )}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Jurisdiction (read-only, informational) */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:BG, borderRadius:8 }}>
          <span style={{ fontSize:12, color:'#666' }}>Jurisdiction</span>
          <span style={{ fontSize:12, fontWeight:600, color:NAVY }}>{jurisdiction}</span>
        </div>
        {/* Amp toggle */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Amperage</div>
          <div style={{ display:'flex', gap:8 }}>
            <Chip on={amp === '30'} onClick={() => setAmp('30')}>30A</Chip>
            <Chip on={amp === '50'} onClick={() => setAmp('50')}>50A</Chip>
          </div>
        </div>
        {/* Tier 3-segment */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Tier</div>
          <div style={{ display:'flex', gap:8 }}>
            <Seg on={tier === 'standard'}     onClick={() => setTier('standard')}     label="Standard" sub="Base" />
            <Seg on={tier === 'premium'}      onClick={() => setTier('premium')}      label="Premium"  sub="+$300" />
            <Seg on={tier === 'premium_plus'} onClick={() => setTier('premium_plus')} label="Premium+" sub="+$600" />
          </div>
        </div>
        {/* Add-ons */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Add-ons</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Chip on={cordIncluded}  onClick={() => setCord(c => !c)}>Cord</Chip>
            <Chip on={includeSurge}  onClick={() => setSurge(s => !s)}>Surge</Chip>
            <Chip on={includePom}    onClick={() => setPom(p => !p)}>Peace of Mind</Chip>
            <Chip on={includePermit} onClick={() => setPermit(p => !p)}>Permit</Chip>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── New Invoice Modal ─────────────────────────────────────────────────
// Type picker (Deposit/Final/Balance), amount input, optional description.
// Deposit auto-fills 50% of approved-proposal total; Final fills remainder
// after summing deposit invoices; Balance is custom (Key types it).
function NewInvoiceModal({ contact, latestSignedProposal, invoices, onClose }) {
  // Trim before split-or-default so a name of "  " doesn't render
  // "Hey , here's your quote" — guards against whitespace-only DB rows.
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');

  const proposalTotal = (latestSignedProposal?.amount_cents || 0) / 100;
  // "Already-billed" — any invoice that's a live obligation reduces the
  // Final remainder. We INCLUDE 'sent' here intentionally (counter to a
  // narrow "only paid counts" reading) because Key wants Final to be
  // proposalTotal MINUS what's already been billed (deposit etc.) — sending
  // a Final that ignores an outstanding deposit double-bills the customer.
  // Voided/refunded/draft are excluded so they don't artificially inflate.
  const billedSum = invoices
    .filter(i => !['voided', 'refunded', 'draft', 'declined'].includes(i.status))
    .reduce((s,i) => s + (i.amount_cents || 0), 0) / 100;
  const remaining = Math.max(0, proposalTotal - billedSum);

  const [kind, setKind] = React.useState('deposit');
  const [amount, setAmount] = React.useState(() => {
    if (proposalTotal > 0) return Math.round(proposalTotal * 0.5);
    return 0;
  });
  const [description, setDescription] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Auto-fill amount when kind switches.
  const onKindChange = (k) => {
    setKind(k);
    if (k === 'deposit' && proposalTotal > 0) {
      setAmount(Math.round(proposalTotal * 0.5));
    } else if (k === 'final') {
      setAmount(Math.round(remaining));
    } else if (k === 'balance') {
      setAmount(0);
    }
  };

  const lineLabel = kind === 'deposit' ? '50% deposit'
                  : kind === 'final'   ? 'Final balance'
                  : 'Balance due';
  const lineItems = [{
    name: description.trim() || lineLabel,
    amount: Number(amount) || 0,
  }];

  const submit = async () => {
    if (busy) return;
    const total = Number(amount) || 0;
    if (total <= 0) {
      window.showToast?.('Amount must be greater than 0');
      return;
    }
    if (contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (!CRM.__db || !CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        contact_id: contact.id,
        proposal_id: latestSignedProposal?.id || null,
        contact_name:    contact.name    || '',
        contact_email:   contact.email   || '',
        contact_phone:   contact.phone   || '',
        contact_address: contact.address || '',
        line_items: lineItems,
        total,
        status: 'unpaid',
      };
      const { data, error } = await CRM.__db.from('invoices').insert([payload]).select().single();
      if (error || !data) {
        window.showToast?.(`Insert failed: ${error?.message || 'unknown'}`);
        setBusy(false);
        return;
      }
      const url = `https://backuppowerpro.com/invoice.html?token=${data.token}`;
      const minute = Math.floor(Date.now() / 60000);
      // Include kind so distinct deposit/final/balance invoices to the
      // same contact within the same minute don't collide.
      const idempotencyKey = `v3-newinv-${contact.id}-${kind}-${minute}`;
      const body = `Hey ${firstName}, here's your invoice from Backup Power Pro: ${url}`;
      const { error: smsErr } = await CRM.__invokeFn('send-sms', {
        body: { contactId: contact.id, body, idempotencyKey },
      });
      if (smsErr) {
        window.showToast?.(`Saved but send failed: ${smsErr.message}`);
      } else {
        window.showToast?.(`Invoice sent to ${firstName}`);
      }
      onClose();
    } catch (e) {
      window.showToast?.(`Failed: ${e.message || e}`);
      setBusy(false);
    }
  };

  const Seg = ({ on, onClick, label, sub }) => (
    <button onClick={onClick} style={{
      flex:1, padding:'8px 6px', borderRadius:8,
      background: on ? NAVY : 'white',
      color: on ? 'white' : NAVY,
      border: on ? 'none' : '1px solid rgba(11,31,59,0.15)',
      fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
    }}>
      <span>{label}</span>
      {sub && <span style={{ fontSize:10, opacity:0.65, fontWeight:500 }}>{sub}</span>}
    </button>
  );

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`New invoice — ${contact.name || formatPhone(contact.phone)}`}
      footer={(
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Amount</div>
            <div style={{ fontSize:22, fontWeight:700, color:NAVY, fontFamily:"'JetBrains Mono', 'DM Mono', monospace" }}>${(Number(amount) || 0).toLocaleString()}</div>
          </div>
          <button
            onClick={submit}
            disabled={busy || contact.do_not_contact}
            style={{
              height:42, padding:'0 18px', borderRadius:8,
              background: busy || contact.do_not_contact ? '#E5E5E5' : '#ffba00',
              color: busy || contact.do_not_contact ? '#999' : NAVY,
              border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
              cursor: busy || contact.do_not_contact ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', gap:7,
            }}
          >
            {busy ? 'Sending…' : 'Send to customer'}
          </button>
        </div>
      )}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Reference proposal */}
        {latestSignedProposal ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:BG, borderRadius:8 }}>
            <span style={{ fontSize:12, color:'#666' }}>Linked to approved proposal</span>
            <span style={{ fontSize:12, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace" }}>${proposalTotal.toLocaleString()}</span>
          </div>
        ) : (
          <div style={{ padding:'8px 12px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
            No approved proposal — Final/Deposit auto-fill won't work. Use Balance for custom amount.
          </div>
        )}
        {/* Final = $0 warning — proposal already invoiced in full. */}
        {kind === 'final' && latestSignedProposal && remaining === 0 && (
          <div style={{ padding:'8px 12px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, fontSize:12, color:'#991B1B' }}>
            This proposal has already been invoiced in full. Switch to <strong>Balance</strong> to send a custom amount, or close.
          </div>
        )}
        {/* Type picker */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Type</div>
          <div style={{ display:'flex', gap:8 }}>
            <Seg on={kind === 'deposit'} onClick={() => onKindChange('deposit')} label="Deposit" sub="50%" />
            <Seg on={kind === 'final'}   onClick={() => onKindChange('final')}   label="Final"   sub="Remainder" />
            <Seg on={kind === 'balance'} onClick={() => onKindChange('balance')} label="Balance" sub="Custom" />
          </div>
        </div>
        {/* Amount */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Amount (USD)</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, border:'1.5px solid #EBEBEA', borderRadius:8, padding:'2px 10px', background:'white' }}>
            <span style={{ fontSize:15, color:'#666', fontWeight:600 }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ flex:1, height:40, border:'none', outline:'none', fontSize:16, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace", background:'transparent' }}
            />
          </div>
        </div>
        {/* Description */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Description (optional)</div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={lineLabel}
            style={{ width:'100%', height:40, border:'1.5px solid #EBEBEA', borderRadius:8, padding:'0 10px', fontSize:16, color:NAVY, outline:'none', fontFamily:'inherit', background:'white', boxSizing:'border-box' }}
          />
        </div>
      </div>
    </ModalShell>
  );
}

// ── StageHistoryCard ──────────────────────────────────────────────────
// Compact timeline: "New → Quoted (4d) → Booked (12d) → here for 3d".
// Auditor: "Solo ops live or die by knowing why a deal stalled."
function StageHistoryCard({ contact }) {
  const all = window.CRM?.stageHistory || [];
  const rows = all.filter(r => r.contact_id === contact.id);
  if (rows.length === 0) return null;

  // Build a chronological list of stages including the implicit "created"
  // entry. Compute days-in-stage for each transition.
  const sorted = [...rows].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  const startTs = new Date(sorted[0].created_at).getTime();

  const segments = [];
  let prevTs = startTs;
  let prevStage = sorted[0].from_stage;
  // First segment: time spent at from_stage before first transition
  if (prevStage != null) {
    const days = Math.max(0, Math.floor((new Date(sorted[0].created_at).getTime() - prevTs) / 86400000));
    segments.push({ stage: prevStage, days, transitionAt: sorted[0].created_at });
  }
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const next = sorted[i + 1];
    const ts = new Date(t.created_at).getTime();
    const endTs = next ? new Date(next.created_at).getTime() : Date.now();
    const days = Math.max(0, Math.floor((endTs - ts) / 86400000));
    segments.push({ stage: t.to_stage, days, transitionAt: t.created_at, current: !next });
  }

  const labelFor = (n) => (window.CRM?.STAGE_LABELS?.[window.CRM?.STAGE_NUM_TO_STR?.[n]] || `Stage ${n}`);

  return (
    <InfoSection title="Pipeline" editAction={null}>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, fontSize:12, color:NAVY }}>
        {segments.map((s, i) => (
          <React.Fragment key={i}>
            <span style={{
              padding:'3px 8px', borderRadius:20, fontWeight:600,
              background: s.current ? '#FFFBEB' : '#F0F4FF',
              color: s.current ? '#92400E' : NAVY,
              border: s.current ? '1px solid #FDE68A' : '1px solid rgba(11,31,59,0.08)',
              fontSize:11,
              whiteSpace:'nowrap',
            }}>{labelFor(s.stage)}{s.days > 0 ? ` · ${s.days}d` : ''}{s.current ? ' (here)' : ''}</span>
            {i < segments.length - 1 && <span style={{ color:MUTED, fontSize:11 }}>→</span>}
          </React.Fragment>
        ))}
      </div>
    </InfoSection>
  );
}

// ── New Contact Modal ─────────────────────────────────────────────────
// Walk-ins, referrals, inbound callers — Key needs to capture a lead
// in <10s. Minimum viable: name + phone + address. Stage defaults to
// 'new' (1). Insert is direct — Contacts realtime channel will pick it
// up and ContactsList will re-render with the row at top.
function NewContactModal({ onClose, onCreated }) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName && !trimmedPhone) {
      window.showToast?.('Need at least a name or phone');
      return;
    }
    if (trimmedPhone && !/^\+?[\d\s().\-]{7,}$/.test(trimmedPhone)) {
      window.showToast?.('Phone looks invalid');
      return;
    }
    if (!CRM.__db) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: trimmedName || null,
        phone: trimmedPhone || '',
        address: address.trim() || null,
        stage: 1,           // new lead
        status: 'Active',
        do_not_contact: false,
      };
      const { data, error } = await CRM.__db.from('contacts').insert([payload]).select().single();
      if (error || !data) {
        window.showToast?.(`Save failed: ${error?.message || 'unknown'}`);
        setBusy(false);
        return;
      }
      window.showToast?.(`${trimmedName || 'Contact'} added`);
      onCreated?.(data.id);
      onClose();
    } catch (e) {
      window.showToast?.(`Failed: ${e.message || e}`);
      setBusy(false);
    }
  };

  // fontSize 16 prevents iOS Safari auto-zoom on focus.
  const inputStyle = { width:'100%', height:40, padding:'0 12px', fontSize:16, fontFamily:'inherit', border:'1px solid rgba(11,31,59,0.15)', borderRadius:8, background:'white', color:NAVY, outline:'none', boxSizing:'border-box' };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Add contact"
      footer={(
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} disabled={busy} style={{
            flex:'1 1 0', minWidth:0, height:42, borderRadius:8, background:'white', color:NAVY,
            border:'1px solid rgba(27,43,75,0.15)', fontSize:14, fontWeight:600, fontFamily:'inherit', cursor: busy?'not-allowed':'pointer',
          }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{
            flex:'1 1 0', minWidth:0, height:42, borderRadius:8,
            background: busy ? '#E5E5E5' : '#ffba00', color: busy ? '#999' : NAVY,
            border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Name</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name" autoFocus style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Phone</div>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Address (optional)</div>
          <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="123 Main St, Spartanburg" autoComplete="street-address" style={inputStyle} />
        </div>
        <div style={{ fontSize:11, color:MUTED, lineHeight:1.5 }}>
          New leads land at stage 1 (New). You can advance the stage from the contact's overview after creating.
        </div>
      </div>
    </ModalShell>
  );
}

Object.assign(window, { RightPanel, NewProposalModal, NewInvoiceModal, NewContactModal, ModalShell });
