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
      <ContactStrip contact={contact} isDnc={dncSet.has(contactId)} toggleDnc={() => toggleDnc(contactId)} bumpData={bumpData} onOpenTab={onOpenTab} />
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
function ContactStrip({ contact, isDnc, toggleDnc, bumpData, onOpenTab }) {
  const isPremium = contact.pricing_tier === 'premium' || contact.pricing_tier === 'premium_plus';

  // Pin state mirrors the ContactsList pin star — same localStorage key.
  // Listening for the custom event keeps both components in sync without
  // a shared parent.
  const PIN_KEY = 'bpp_v3_pinned_contacts';
  const readPinned = () => {
    try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || '[]')); }
    catch { return new Set(); }
  };
  const [pinned, setPinned] = React.useState(readPinned);
  React.useEffect(() => {
    const onChanged = () => setPinned(readPinned());
    window.addEventListener('crm-pin-changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener('crm-pin-changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, []);
  const isPinned = pinned.has(contact.id);
  const togglePin = () => {
    const next = new Set(pinned);
    if (next.has(contact.id)) next.delete(contact.id);
    else next.add(contact.id);
    setPinned(next);
    window.safeSetItem?.(PIN_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new CustomEvent('crm-pin-changed'));
    window.showToast?.(isPinned ? 'Unpinned' : 'Pinned to top');
  };

  return (
    <div style={{ height:60, background:'white', borderBottom:'1px solid #EBEBEA', padding:'0 18px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
      <ContactAvatar contact={contact} size={32} />
      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
        {isPremium && window.tweaksGlobal?.premiumDots !== false && <GoldDot />}
        <span style={{ fontSize:14, fontWeight:700, color:NAVY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0, flex:1 }}>{contactName(contact)}</span>
        <button onClick={togglePin}
          aria-label={isPinned ? 'Unpin contact' : 'Pin contact to top'}
          title={isPinned ? 'Unpin' : 'Pin to top'}
          style={{
            background:'none', border:'none', cursor:'pointer', flexShrink:0,
            width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
            color: isPinned ? GOLD : '#D1D5DB', padding:0,
          }}>
          <svg viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
        {isDnc && <span style={{ fontSize:9,fontWeight:700,color:'#991B1B',background:'#FEF2F2',padding:'1px 6px',borderRadius:20, flexShrink:0 }}>DO NOT CONTACT</span>}
      </div>
      <ContactOverflowMenu contact={contact} isDnc={isDnc} toggleDnc={toggleDnc} bumpData={bumpData} onOpenTab={onOpenTab} />
    </div>
  );
}

// ── Overflow Menu (right-aligned dropdown anchored to the 3-dots button) ─
function ContactOverflowMenu({ contact, isDnc, toggleDnc, bumpData, onOpenTab }) {
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
    // Make sure the contacts tab is active before dispatching — otherwise
    // the listener (in ContactInfoSection on the contacts tab) isn't
    // mounted and the event falls into the void.
    onOpenTab?.('contacts');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-edit-contact', { detail: { contactId: contact.id } }));
    }, 60);
  };

  const openInMaps = () => {
    close();
    window.open(`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`, '_blank', 'noopener');
  };

  const copyPhone = async () => {
    close();
    try {
      const ok = await window.copyText(contact.phone);
      window.showToast?.(ok ? 'Phone copied' : 'Copy failed');
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

  // Symmetric "allow contact again" — without this, removing the DNC flag
  // required Supabase Studio access. Confirm-gated so it's a deliberate
  // action; TCPA-sensitive enough to make Key pause.
  const unmarkDnc = async () => {
    close();
    if (!isDnc) return;
    const ok = await window.confirmAction?.({
      title: 'Allow ' + contactName(contact) + ' to be contacted again?',
      body: 'Make sure they\'ve actually agreed to receive messages again. Removes the DNC flag.',
      confirmLabel: 'Allow again',
    });
    if (ok) {
      contact.do_not_contact = false;
      toggleDnc?.(contact.id);
      if (CRM.__db) CRM.__db.from('contacts').update({ do_not_contact: false }).eq('id', contact.id);
      window.showToast?.(contactName(contact) + ' can be contacted again');
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
    isDnc
      ? { kind:'item', icon:OFI.ban, label:'Allow contact again', onClick: unmarkDnc }
      : { kind:'item', icon:OFI.ban, label:'Mark do not contact', danger:true, onClick: markDnc },
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
  // Track which contact our `note` state was loaded for — guards the
  // auto-save against a 1-frame race where a contact switch reseeds
  // `note` from the new contact but the auto-save effect still has the
  // OLD contact's text in its closure. Without this, switching contacts
  // mid-typing could overwrite the new contact's notes with the prior
  // contact's text.
  const loadedForContactId = React.useRef(contact.id);
  React.useEffect(() => {
    setNote(contact.notes || '');
    setNoteSaved(false);
    loadedForContactId.current = contact.id;
  }, [contact.id]);
  // Debounced auto-save: 800ms after the last keystroke, persist to contacts.notes.
  React.useEffect(() => {
    if (loadedForContactId.current !== contact.id) return; // race guard
    if (note === (contact.notes || '')) return;
    const timer = setTimeout(async () => {
      if (!CRM.__db) return;
      // Re-check at fire time — a contact switch could have happened
      // during the 800ms debounce.
      if (loadedForContactId.current !== contact.id) return;
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
            <div style={{ fontSize:18, fontWeight:700, color: moneyStatus.color, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{formatMoneyCents(moneyStatus.cents)}</div>
          </div>
          <span style={{ fontSize:13, color: moneyStatus.color, fontWeight:700, padding:'4px 0', flexShrink:0 }}>View →</span>
        </button>
      )}
      <ContactInfoSection contact={contact} bumpData={bumpData} onOpenTab={onOpenTab} />
      {/* Install spec + Permits cards only render once a proposal is
          signed. Before that, the contact view stays clean — Inlet/
          Interlock + permit workflow are noise until there's a real
          deal to install. Same gate Key uses mentally. */}
      {latestSigned && (
        <InstallSpecCard ampSpec={ampSpec} contact={contact} materials={materials} bumpData={bumpData} />
      )}
      {nextEvent && (
        <NextJobCard contact={contact} event={nextEvent} permit={cPermit} materials={materials} onOpenTab={onOpenTab} />
      )}
      {/* Notes before Photos — Key references notes more often than
          photos when re-opening a contact. */}
      <InfoSection title="Notes" editAction={null}>
        <div contentEditable suppressContentEditableWarning data-placeholder="Internal notes (auto-saves)…"
          ref={el => { if (el && el.innerText !== note) el.innerText = note || ''; }}
          onInput={e => setNote(e.currentTarget.innerText)}
          style={{ width:'100%',minHeight:68,border:'1.5px solid #EBEBEA',borderRadius:8,background:BG,padding:'10px 12px',fontSize:16,color:NAVY,outline:'none',fontFamily:'inherit',lineHeight:1.5,boxSizing:'border-box',whiteSpace:'pre-wrap',wordBreak:'break-word' }} />
        <div style={{ marginTop:6, fontSize:11, color:'#999', minHeight:14 }}>
          {noteSaving ? 'Saving…' : noteSaved ? 'Saved' : ' '}
        </div>
      </InfoSection>
      <PhotosSection contact={contact} />
      <StageHistoryCard contact={contact} />
      {latestSigned && (
        <PermitsCard permits={permits} contact={contact} bumpData={bumpData} />
      )}
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
          <button
            aria-label="Edit"
            onClick={editAction}
            style={{
              fontSize:12, color:'#666', background:'none', border:'none',
              cursor:'pointer', fontFamily:'inherit',
              // 32-tall hit zone — visual size unchanged but touch is reachable.
              minHeight:32, padding:'8px 10px', margin:'-8px -10px',
            }}
          >Edit</button>
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

// ── Action buttons ────────────────────────────────────────────────
// Two-tier system:
//   1. GoldActionBtn — text pill for VERB actions ("Pull permit",
//      "Send quote"). The text is part of the meaning.
//   2. IconActionBtn — 32×32 circle for UTILITY actions ("Call", "Map",
//      "Copy"). Glyph carries the meaning; saves horizontal space so
//      every InfoLineRow fits cleanly on one line at any width.
// Apple Contacts / Stripe Dashboard pattern. No more text-pill buttons
// wrapping below the value with awkward whitespace gaps.
function GoldActionBtn({ onClick, href, target, children }) {
  const style = {
    height:32, padding:'0 14px', borderRadius:8,
    background: GOLD, color:NAVY, border:'none',
    fontSize:13, fontWeight:600, fontFamily:'inherit',
    cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
    textDecoration:'none', whiteSpace:'nowrap',
  };
  if (href) return <a href={href} target={target} rel={target ? 'noopener noreferrer' : undefined} style={style}>{children}</a>;
  return <button onClick={onClick} style={style}>{children}</button>;
}

const ICON_PHONE = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const ICON_PIN = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const ICON_COPY = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const ICON_CHAT = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

function IconActionBtn({ icon, onClick, href, target, ariaLabel, variant = 'outline' }) {
  const filled = variant === 'gold';
  const style = {
    // 36×36 — sits above Apple's 32px lower bound for icon-only touch
    // targets and stays visually compact in 4-up rows on a 390px screen
    // (4×36 + 3×8 gap = 168px, comfortably fits beside row label/value).
    width:36, height:36, borderRadius:'50%',
    background: filled ? GOLD : 'white',
    color: NAVY,
    border: filled ? 'none' : '1px solid rgba(11,31,59,0.15)',
    cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
    textDecoration:'none', flexShrink:0, fontFamily:'inherit', padding:0,
  };
  if (href) return <a href={href} target={target} rel={target ? 'noopener noreferrer' : undefined} aria-label={ariaLabel} style={style}>{icon}</a>;
  return <button onClick={onClick} aria-label={ariaLabel} style={style}>{icon}</button>;
}

const CallIconBtn = ({ href, onClick }) => <IconActionBtn icon={ICON_PHONE} href={href} onClick={onClick} ariaLabel="Call" variant="gold" />;
const TextIconBtn = ({ onClick }) => <IconActionBtn icon={ICON_CHAT} onClick={onClick} ariaLabel="Text" variant="gold" />;
const MapIconBtn = ({ onClick }) => <IconActionBtn icon={ICON_PIN} onClick={onClick} ariaLabel="Open in maps" variant="gold" />;
const CopyBtn = ({ onClick }) => <IconActionBtn icon={ICON_COPY} onClick={onClick} ariaLabel="Copy" />;

function InfoLineRow({ label, value, valueColor, actions }) {
  // Single-line layout. Label fixed-width left, value flexes and
  // truncates if it overflows, actions sit tight to the right. If
  // value is a complex JSX node (tag chips, "+ add" button) we let it
  // wrap so the whole pill row stays visible.
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:'1px solid #F2F2EF', minHeight:48 }}>
      <span style={{ width:60, flexShrink:0, fontSize:11, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
      <span style={{ flex:1, minWidth:0, fontSize:14, fontWeight:500, color: valueColor || NAVY, lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis' }}>{value}</span>
      {actions && (
        <div style={{ display:'inline-flex', gap:6, flexShrink:0 }}>
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
    ? `≈ ${info.minutes} min from home`
    : `≈ ${Math.floor(info.minutes/60)} hr ${info.minutes%60} min from home`;
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
  // Pre-flight check via the free Places metadata API. Without this,
  // Google returns a "Sorry, we have no imagery here" placeholder image
  // (HTTP 200, so onError doesn't fire) and the hero displays a giant
  // ugly gray rectangle on every contact whose address has no panorama.
  // Same cache pattern as ContactAvatar.
  const [hasImagery, setHasImagery] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const address = contact.address;
  React.useEffect(() => {
    setFailed(false);
    setVerified(false);
    setHasImagery(false);
    if (!address || !isAddressableStreet(address) || typeof window.checkSvImagery !== 'function') {
      setVerified(true);
      return;
    }
    let cancelled = false;
    window.checkSvImagery(address).then(result => {
      if (cancelled) return;
      setHasImagery(result === 'ok');
      setVerified(true);
    });
    return () => { cancelled = true; };
  }, [contact.id, address]);

  if (!address || failed) return null;
  if (!isAddressableStreet(address)) return null;
  // While verifying, render nothing (avoid flicker). Once verified
  // without imagery, also render nothing — the colored ContactStrip
  // avatar above plus the contact name carry the identity.
  if (!verified || !hasImagery) return null;
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
    // ⚠️ KNOWN SURFACE — message-media bucket is fully public (per
    // F12 of 2026-05-01 security audit). Anyone with the URL can view
    // forever. Mitigation today: contact-id-scoped paths are UUID-
    // unguessable, but the URL leaks via Twilio MMS carrier logs and
    // ends up in message_body for the lifetime of the thread. See
    // wiki/Operations/Message Media Bucket.md for the migration plan
    // (private bucket + signed URLs at render time).
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
      // Persist storage path on the photo record so removeJobPhoto
      // can delete the underlying blob, not just the localStorage row.
      const next = [...jobPhotos, { id: 'job-' + Date.now(), url, path, uploaded_at: new Date().toISOString() }];
      setJobPhotos(next);
      window.safeSetItem?.(STORAGE_KEY, JSON.stringify(next));
      window.showToast?.('Photo added');
    } catch (err) {
      window.showToast?.(`Upload failed: ${err.message || 'unknown'}`);
    } finally {
      setUploading(false);
    }
  };

  const removeJobPhoto = async (id) => {
    const removed = jobPhotos.find(p => p.id === id);
    const next = jobPhotos.filter(p => p.id !== id);
    setJobPhotos(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    // Also delete the underlying blob from Supabase storage so we don't
    // leak storage cost on every removed job photo. Best-effort —
    // failure is non-fatal but logged.
    if (removed?.path && CRM.__db?.storage) {
      try {
        const { error } = await CRM.__db.storage.from('message-media').remove([removed.path]);
        if (error) console.warn('[CRM] photo blob delete failed:', error.message);
      } catch (e) {
        console.warn('[CRM] photo blob delete threw:', e?.message);
      }
    }
    window.showToast?.('Photo removed');
  };

  return (
    <InfoSection title="Photos" editAction={null}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display:'none' }} />
      {allPhotos.length === 0 ? (
        <div style={{ fontSize:13, color:MUTED, padding:'4px 0', marginBottom:8 }}>
          Add job photos here, or send/receive photos in the SMS thread. Note: anyone with the photo URL can view it — don't include sensitive info in filenames.
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

  // Pre-flight Street View metadata so the hero never renders Google's
  // gray "Sorry, we have no imagery here" placeholder. Same cache as
  // ContactAvatar — checked once per address.
  const [heroVerified, setHeroVerified] = React.useState(false);
  const [heroHasImagery, setHeroHasImagery] = React.useState(false);
  React.useEffect(() => {
    setHeroVerified(false);
    setHeroHasImagery(false);
    if (!contact.address || !isAddressableStreet(contact.address)) {
      setHeroVerified(true);
      return;
    }
    let cancelled = false;
    window.checkSvImagery(contact.address).then(result => {
      if (cancelled) return;
      setHeroHasImagery(result === 'ok');
      setHeroVerified(true);
    });
    return () => { cancelled = true; };
  }, [contact.id, contact.address]);

  if (!editing) {
    // Combined hero + contact info card. Image at top with name overlay
    // (large + bold) + Copy button. Below: phone/address/stage/tier rows.
    const hasHero = isAddressableStreet(contact.address) && heroHasImagery;
    const heroUrl = hasHero
      ? `https://maps.googleapis.com/maps/api/streetview?size=640x200&scale=2&location=${encodeURIComponent(contact.address.trim())}&fov=90&pitch=2&source=outdoor&key=${SV_KEY}`
      : null;
    const isPremium = contact.pricing_tier === 'premium' || contact.pricing_tier === 'premium_plus';
    const stageLabel = CRM.STAGE_LABELS[contact.stage] || '';

    const copyName = async () => {
      const ok = await window.copyText(contactName(contact));
      window.showToast?.(ok ? 'Name copied' : 'Copy failed');
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
            <button
              aria-label="Edit contact"
              onClick={() => setEditing(true)}
              style={{
                background:'none', border:'none', color:'#666', fontSize:12,
                cursor:'pointer', fontFamily:'inherit',
                // 32-tall hit zone — same visual size, reachable on touch.
                minHeight:32, padding:'8px 10px', margin:'-8px -10px',
              }}
            >Edit</button>
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
          <div contentEditable suppressContentEditableWarning data-placeholder="Full name"
            ref={el => { if (el && el.innerText !== name) el.innerText = name || ''; }}
            onInput={e => setName(e.currentTarget.innerText)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            style={{ ...inputStyle, minHeight:40, padding:'10px 12px', whiteSpace:'nowrap', overflow:'hidden' }} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 }}>Phone</div>
          <input value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 }}>Address</div>
          <AddressAutocomplete value={address} onChange={setAddress} placeholder="123 Main St, Spartanburg" style={inputStyle} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <button onClick={() => {
            // Reset form state to the current contact's persisted values
            // before closing — without this, typing "JUNK" then Cancel
            // leaves the dirty value behind and the next time Edit
            // opens, "JUNK" is still there.
            setName(contact.name || '');
            setPhone(contact.phone || '');
            setAddress(contact.address || '');
            setEditing(false);
          }} disabled={saving} style={{
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
  // Show the full address as it was entered. The previous "Street · Jurisdiction"
  // form (e.g. "109 Suzanna Drive · Spartanburg") truncated City/State/ZIP — and
  // worse, it conflated jurisdiction (county for permitting) with city, so a
  // contact in Inman, SC inside Spartanburg County rendered as "Spartanburg".
  // Fall back to a cleaned-up street if the full address is missing.
  const fullAddress = (contact.address || '').trim();
  const street = fullAddress.split(',')[0].trim();
  const addressDisplay = fullAddress || street;
  const addressForCopy = addressDisplay;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressDisplay)}`;

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
    const ok = await window.copyText(text);
    window.showToast?.(ok ? label + ' copied' : 'Copy failed');
  };

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <InfoLineRow
        label="Phone"
        value={phoneFmt}
        actions={<>
          <CallIconBtn href={`tel:${contact.phone}`} />
          <TextIconBtn onClick={() => onOpenTab?.('messages')} />
          <CopyBtn onClick={() => copy(contact.phone, 'Phone')} />
        </>}
      />
      {contact.address ? (
        <InfoLineRow
          label="Address"
          value={addressDisplay}
          actions={<>
            <MapIconBtn onClick={() => window.open(mapsUrl, '_blank', 'noopener')} />
            <CopyBtn onClick={() => copy(addressForCopy, 'Address')} />
          </>}
        />
      ) : (
        // No address yet — surface a single ghost "+ Add address" link
        // instead of an empty row with floating Map/Copy buttons. Hits
        // the contact's edit form via the existing crm-edit-contact
        // event (same path as the overflow-menu "Edit").
        <InfoLineRow
          label="Address"
          value={
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('crm-edit-contact', { detail: { contactId: contact.id } }))}
              style={{
                background:'none', border:'1px dashed rgba(11,31,59,0.2)', borderRadius:6,
                padding:'4px 10px', fontSize:12, fontWeight:600, color:MUTED,
                cursor:'pointer', fontFamily:'inherit',
              }}
            >+ Add address</button>
          }
        />
      )}
      <InfoLineRow
        label="Stage"
        value={CRM.STAGE_LABELS[contact.stage]}
        // Hide the Stage CTA for "Pull permit" — the Permits card below
        // has its own "Start permit" button which is the canonical place
        // to start one. Two buttons that do the same thing was confusing.
        actions={(nextStageLabel && contact.stage !== 'booked') ? <GoldActionBtn onClick={handleStageAction}>{stageActionVerbFor(contact.stage)}</GoldActionBtn> : null}
      />
      {/* Tags row removed per user — not needed today. The TagsRow
          component + localStorage persistence is left in place so
          re-enabling later is a one-line revert. */}
      {/* Tier row dropped — the Premium / Premium+ pill already sits in the
          hero overlay, so a duplicate row here is redundant. */}
    </div>
  );
}

// ── Tags ────────────────────────────────────────────────────────────
// Custom labels per-contact. Stored in localStorage (no DB column —
// schema-mid-session is the bug pattern that bit this app before).
// Filtering by tag is wired in ContactsList: search box matches tags.
const TAGS_KEY = 'bpp_v3_tags';
function loadTagMap() {
  try { return JSON.parse(localStorage.getItem(TAGS_KEY) || '{}') || {}; }
  catch { return {}; }
}
function saveTagMap(map) {
  window.safeSetItem?.(TAGS_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('crm-tags-changed'));
}
function tagsFor(contactId) {
  const m = loadTagMap();
  return Array.isArray(m[contactId]) ? m[contactId] : [];
}

function TagsRow({ contactId }) {
  const [tags, setTags] = React.useState(() => tagsFor(contactId));
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => { setTags(tagsFor(contactId)); }, [contactId]);
  React.useEffect(() => {
    const refresh = () => setTags(tagsFor(contactId));
    window.addEventListener('crm-tags-changed', refresh);
    return () => window.removeEventListener('crm-tags-changed', refresh);
  }, [contactId]);

  const commit = (next) => {
    const map = loadTagMap();
    if (next.length === 0) delete map[contactId];
    else map[contactId] = next;
    saveTagMap(map);
    setTags(next);
  };
  const removeTag = (t) => commit(tags.filter(x => x !== t));
  const addTag = () => {
    const v = draft.trim().slice(0, 24);
    if (!v) { setAdding(false); return; }
    if (tags.includes(v)) { setDraft(''); setAdding(false); return; }
    commit([...tags, v]);
    setDraft('');
    setAdding(false);
  };

  return (
    <InfoLineRow
      label="Tags"
      value={
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center' }}>
          {tags.map(t => (
            <button key={t} onClick={() => removeTag(t)} title="Remove tag" style={{
              height:22, padding:'0 8px', borderRadius:11, border:'none', cursor:'pointer',
              background:'#EEF2FF', color:'#3730A3', fontSize:11, fontWeight:600, fontFamily:'inherit',
              display:'inline-flex', alignItems:'center', gap:4,
            }}>{t}<span style={{ opacity:0.5, fontSize:10 }}>✕</span></button>
          ))}
          {adding ? (
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onBlur={addTag}
              onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
              autoFocus placeholder="VIP, Refer, Slow…"
              style={{ height:22, padding:'0 8px', borderRadius:11, border:'1px solid rgba(11,31,59,0.2)', background:'white', fontSize:11, fontFamily:'inherit', color:NAVY, outline:'none', width:120 }}
            />
          ) : (
            <button onClick={() => setAdding(true)} aria-label="Add tag" style={{
              height:22, padding:'0 8px', borderRadius:11, border:'1px dashed rgba(11,31,59,0.25)', background:'white',
              color:MUTED, cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit',
            }}>+ tag</button>
          )}
          {tags.length === 0 && !adding && (
            <span style={{ fontSize:11, color:MUTED }}>None</span>
          )}
        </div>
      }
    />
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

  const addPermit = async () => {
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
    // Advance the contact stage from "Booked" → "Permit submit" since
    // starting a permit IS that transition. The Stage row CTA used to
    // do this; now the Permits card handles it directly.
    if (contact.stage === 'booked' && CRM.STAGE_STR_TO_NUM?.permit_submit != null) {
      const previous = contact.stage;
      contact.stage = 'permit_submit';
      bumpData?.();
      try {
        if (CRM.__db) {
          const { error } = await CRM.__db.from('contacts')
            .update({ stage: CRM.STAGE_STR_TO_NUM.permit_submit })
            .eq('id', contact.id);
          if (error) {
            contact.stage = previous;
            bumpData?.();
            window.showToast?.(`Permit added — stage save failed: ${error.message}`);
            return;
          }
        }
      } catch (e) {
        contact.stage = previous;
        bumpData?.();
      }
    }
    bumpData?.();
    window.showToast?.('Permit started');
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
                <PermitAgeChip permit={p} />
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

// Permit aging chip — typical SC city turnaround is ~14 days. Gold once
// past 7d submitted, red once past the 14d SLA. Hidden if approved or
// not yet submitted.
function PermitAgeChip({ permit }) {
  if (!permit?.submitted_at || permit.status === 'approved') return null;
  const days = Math.floor((Date.now() - new Date(permit.submitted_at).getTime()) / 86400000);
  const SLA = 14;
  const overdue = days > SLA;
  const aging = days >= 7;
  const bg = overdue ? '#FEE2E2' : aging ? '#FEF3C7' : '#F0F4FF';
  const color = overdue ? '#991B1B' : aging ? '#92400E' : '#1E40AF';
  const label = overdue ? `Day ${days} · over SLA` : `Day ${days} of ${SLA}`;
  return (
    <span title={overdue ? 'Past typical SLA — call the city.' : 'Day-count since submission.'} style={{
      fontSize:10, fontWeight:700, color, background:bg,
      padding:'2px 7px', borderRadius:20, fontFamily:'DM Mono, monospace',
    }}>{label}</span>
  );
}

// ── Install Spec Card ─────────────────────────────────────────────
const MAT_STATUS = {
  not_ordered: { icon: '○', color: '#999',    label: 'Not ordered' },
  ordered:     { icon: '◐', color: '#f59e0b', label: 'Ordered' },
  received:    { icon: '●', color: '#2563eb', label: 'Received' },
  installed:   { icon: '✓', color: '#16a34a', label: 'Installed' },
};
const MAT_NEXT = {
  not_ordered: { next:'ordered',   label:'Mark ordered',   gold:true,  stamp:'ordered_at' },
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

  // Reset back to "Not ordered" — the only escape hatch from an
  // accidental "Mark installed". Wipes the date stamps.
  const reset = () => {
    if (isPlaceholder) return; // already at default
    mat.status = 'not_ordered';
    mat.ordered_at = null;
    mat.received_at = null;
    mat.installed_at = null;
    bumpData?.();
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)}: reset`);
  };

  // Delete an ad-hoc extra (not the 3 permanent kinds: inlet,
  // interlock, cord — those always render as part of the install).
  const PERMANENT = new Set(['inlet','interlock','cord']);
  const canDelete = !isPlaceholder && !PERMANENT.has(mat.kind);
  const remove = () => {
    if (!canDelete) return;
    const i = (CRM.materials || []).findIndex(m => m.id === mat.id);
    if (i >= 0) CRM.materials.splice(i, 1);
    bumpData?.();
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)} removed`);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
      <span style={{ width:16, fontSize:14, color:st.color, flexShrink:0, textAlign:'center', lineHeight:1, fontWeight:700 }}>{st.icon}</span>
      <span style={{ flex:1, fontSize:14, color:NAVY }}>{MAT_KIND_LABEL(mat.kind)}</span>
      <span style={{ fontSize:12, color:'#666', whiteSpace:'nowrap' }}>{statusText}</span>
      {/* Status === installed → show a Reset button instead of nothing.
          Without an undo it was easy to accidentally tap "Mark installed"
          and have no way to walk it back. */}
      {!next && mat.status === 'installed' && !isPlaceholder && (
        <button onClick={reset} aria-label="Reset to not ordered" title="Reset" style={{
          height:32, padding:'0 12px', borderRadius:8,
          background:'transparent', color:'#666',
          border:'1px solid rgba(27,43,75,0.15)',
          fontSize:12, fontWeight:600, fontFamily:'inherit',
          cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
        }}>Reset</button>
      )}
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
      {/* Delete affordance — only on extras (Surge, Whip, Breaker,
          Other), never on the 3 permanent rows. Small × so it doesn't
          compete with the primary action. */}
      {canDelete && (
        <button onClick={remove} aria-label={`Remove ${MAT_KIND_LABEL(mat.kind)}`} title="Remove" style={{
          width:28, height:32, borderRadius:8,
          background:'transparent', color:'#991B1B',
          border:'none',
          fontSize:14, fontWeight:600, fontFamily:'inherit',
          cursor:'pointer', flexShrink:0,
        }}>✕</button>
      )}
    </div>
  );
}

function InstallSpecCard({ ampSpec, contact, materials = [], bumpData }) {
  const hasSpec = !!ampSpec;
  const big = hasSpec ? ampSpec : '—';
  const sub = hasSpec ? `${ampSpec.replace(/A$/,'').toLowerCase()} amp installation` : 'Awaiting signed proposal';

  // Ordering rows: inlet + interlock + cord always (placeholders if missing).
  // Cord is bundled by default — included on every install — so we
  // surface it as a permanent line alongside Inlet and Interlock.
  const inletMat = materials.find(m => m.kind === 'inlet') || { kind:'inlet', status:'not_ordered', contact_id:contact.id, _placeholder:true };
  const interlockMat = materials.find(m => m.kind === 'interlock') || { kind:'interlock', status:'not_ordered', contact_id:contact.id, _placeholder:true };
  const cordMat = materials.find(m => m.kind === 'cord') || { kind:'cord', status:'not_ordered', contact_id:contact.id, _placeholder:true };
  const extras = materials.filter(m => !['inlet','interlock','cord'].includes(m.kind));
  const rows = [inletMat, interlockMat, cordMat, ...extras];

  const [showAddPicker, setShowAddPicker] = React.useState(false);
  const EXTRA_KINDS = ['breaker','whip','surge','other'];

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
    // DB has `event_type`, not `kind`; no `status` column. Don't insert
    // those — the prior INSERT silently 422'd because of the schema gap.
    const row = {
      contact_id: contact.id,
      event_type: kind,
      title: defaultTitleFor(kind),
      start_at: startIso,
      end_at: endIso,
    };
    const { data, error } = await CRM.__db.from('calendar_events').insert(row).select().single();
    if (error) { setSaving(false); window.showToast?.(`Save failed: ${error.message}`); return; }
    CRM.events.push({
      id: data.id, contact_id: data.contact_id, kind: data.event_type || kind,
      start_at: data.start_at, end_at: data.end_at, title: data.title, status: 'scheduled',
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
        {/* Quick-pick date chips above the picker. 80% of installs are
            scheduled <14 days out, so these absorb the common case. */}
        <DatePresetRow value={date} onChange={setDate} />
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
            step="900"
            onChange={e=>setTime(e.target.value)}
            style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }}
          />
        </div>
        <ScheduleConflictHint date={date} time={time} durationMin={60} contactId={contact.id} />
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

  // Cancel a sent proposal — flips status to declined with a 5-second
  // undo window. Uses the same optimistic-then-rollback pattern as
  // markPaid so realtime can't fight us.
  const cancelProposal = async (prop) => {
    if (!CRM.__db) return;
    if (markingRef.current.has('cancel:' + prop.id)) return;
    markingRef.current.add('cancel:' + prop.id);
    const live = (CRM.proposals || []).find(x => x.id === prop.id) || prop;
    const prev = live.status;
    live.status = 'declined';
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    const { error } = await CRM.__db.from('proposals').update({ status: 'declined' }).eq('id', prop.id);
    if (error) {
      live.status = prev;
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(`Cancel failed: ${error.message}`);
      return;
    }
    window.showToast?.('Proposal cancelled', {
      undo: async () => {
        const liveNow = (CRM.proposals || []).find(x => x.id === prop.id) || live;
        liveNow.status = prev;
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        if (CRM.__db) await CRM.__db.from('proposals').update({ status: prev }).eq('id', prop.id);
      },
      duration: 5000,
    });
  };

  // Void an invoice — same pattern as cancelProposal. Flips to "voided"
  // (or "cancelled" if your schema uses that). Uses 'voided' to align
  // with the FIN_PILL palette below.
  const voidInvoice = async (inv) => {
    if (!CRM.__db) return;
    if (markingRef.current.has('void:' + inv.id)) return;
    markingRef.current.add('void:' + inv.id);
    const live = (CRM.invoices || []).find(x => x.id === inv.id) || inv;
    const prev = live.status;
    live.status = 'voided';
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    const { error } = await CRM.__db.from('invoices').update({ status: 'voided' }).eq('id', inv.id);
    if (error) {
      live.status = prev;
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(`Void failed: ${error.message}`);
      return;
    }
    window.showToast?.('Invoice voided', {
      undo: async () => {
        const liveNow = (CRM.invoices || []).find(x => x.id === inv.id) || live;
        liveNow.status = prev;
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        if (CRM.__db) await CRM.__db.from('invoices').update({ status: prev }).eq('id', inv.id);
      },
      duration: 5000,
    });
  };

  const FIN_PILL = {
    paid:      { bg:'#16a34a', color:'white', label:'Paid' },
    sent:      { bg:'#2563eb', color:'white', label:'Sent' },
    viewed:    { bg:'#2563eb', color:'white', label:'Viewed' },
    overdue:   { bg:'#dc2626', color:'white', label:'Overdue' },
    approved:  { bg:'#16a34a', color:'white', label:'Approved' },
    declined:  { bg:'#dc2626', color:'white', label:'Cancelled' },
    // Some legacy v1/v2 rows write `cancelled` instead of `declined`
    // (proposals) or `voided` (invoices). Treat them as the same surface
    // so 11 production records stop rendering as gray "Draft".
    cancelled: { bg:'#dc2626', color:'white', label:'Cancelled' },
    voided:    { bg:'#999',    color:'white', label:'Voided' },
    refunded:  { bg:'#999',    color:'white', label:'Refunded' },
    expired:   { bg:'#999',    color:'white', label:'Expired' },
    draft:     { bg:'#999',    color:'white', label:'Draft' },
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
    // Guard: a draft proposal or invoice that hasn't been issued a token
    // yet has linkUrl=null. Sending "null" as a URL would deliver the
    // literal word to the customer. Refuse + tell Key why.
    if (!linkUrl) {
      window.showToast?.('No link yet — save the draft first');
      return;
    }
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
    if (!linkUrl) { window.showToast?.('No link yet — save the draft first'); return; }
    const ok = await window.copyText(linkUrl);
    window.showToast?.(ok ? 'Link copied' : 'Copy failed');
  };
  const viewAsCustomer = (linkUrl) => {
    if (!linkUrl) { window.showToast?.('No link yet — save the draft first'); return; }
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  const FinanceRow = ({ left, money, status, activity, linkUrl, onMarkPaid, onCancel, onVoid }) => {
    // 40px on touch (Apple HIG = 44; 40 keeps the row visually compact
    // while staying above the "frustration threshold" Material flags at
    // 48px). Cursor-driven desktop is fine at 32 — but the inline style
    // doesn't have a media query, so we pick a single accommodating size.
    const sharedBtn = {
      height:40, padding:'0 12px', borderRadius:8,
      fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      whiteSpace:'nowrap', flex:1, minWidth:0,
    };
    // Status-aware button gating. Send/Copy must NEVER appear once the
    // doc is finalized (paid invoice, approved proposal, voided/declined
    // anything) — re-sending an approved Premium+ proposal looks
    // unprofessional and confuses the customer. View link still shows
    // for everything except voided/refunded so Key can re-open the
    // customer's view.
    const FINAL_PROPOSAL = ['approved', 'declined', 'expired'];
    const FINAL_INVOICE = ['paid', 'voided', 'refunded'];
    const isProposal = !FIN_PILL[status] || ['draft','sent','viewed','approved','declined','expired'].includes(status);
    // Loose heuristic: presence of `kind` field would indicate invoice,
    // but we only have status — use the strict invoice-only set check.
    const isFinalInvoice = FINAL_INVOICE.includes(status);
    const isFinalProposal = FINAL_PROPOSAL.includes(status);
    const showSend = !isFinalInvoice && !isFinalProposal;
    const showCopy = !['voided','refunded'].includes(status);
    const showView = !['voided','refunded'].includes(status);
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
        {(showSend || showCopy || showView) && (
          <div style={{ display:'flex', gap:6, marginTop:10 }}>
            {showSend && (
              <button onClick={()=>sendLink(linkUrl)} aria-label="Send to customer" style={{ ...sharedBtn, background:GOLD, color:NAVY, border:'none' }}>
                {SendIcon}<span>Send</span>
              </button>
            )}
            {showCopy && (
              <button onClick={()=>copyLink(linkUrl)} aria-label="Copy link" style={{ ...sharedBtn, background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)' }}>
                {CopyIcon}<span>Copy</span>
              </button>
            )}
            {showView && (
              <button onClick={()=>viewAsCustomer(linkUrl)} aria-label="View as customer" style={{ ...sharedBtn, background:'white', color:NAVY, border:'1px solid rgba(27,43,75,0.15)' }}>
                {EyeIcon}<span>View</span>
              </button>
            )}
          </div>
        )}
        {/* Secondary actions row — Mark paid (manual override for cash
            payments) + Cancel/Void destructive actions. Ghost styling
            so they don't compete with the gold Send CTA. */}
        {(onMarkPaid || onCancel || onVoid) && (
          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
            {onMarkPaid && (
              <button onClick={onMarkPaid} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:'#16a34a',
                border:'1px solid rgba(22,163,74,0.35)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Mark paid</button>
            )}
            {onCancel && (
              <button onClick={async () => {
                const ok = await window.confirmAction?.({
                  title: 'Cancel this proposal?',
                  body: 'The customer\'s link will show "Cancelled". You can undo within 5 seconds.',
                  confirmLabel: 'Cancel proposal',
                  destructive: true,
                });
                if (ok) onCancel();
              }} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:'#991B1B',
                border:'1px solid rgba(153,27,27,0.35)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Cancel</button>
            )}
            {onVoid && (
              <button onClick={async () => {
                const ok = await window.confirmAction?.({
                  title: 'Void this invoice?',
                  body: 'The customer\'s link will show "Voided". You can undo within 5 seconds.',
                  confirmLabel: 'Void invoice',
                  destructive: true,
                });
                if (ok) onVoid();
              }} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:'#991B1B',
                border:'1px solid rgba(153,27,27,0.35)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Void</button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Group every proposal with its invoices into one DealCard. Invoices
  // that don't reference a proposal (legacy / standalone billing) get
  // their own card so they stay visible. The deal-lifecycle box evolves:
  //   compose → sent → viewed → approved → invoiced → paid
  // ...all inside the SAME card. No popups, no context-switch.
  const sortedProposals = [...proposals].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
  const dealCards = sortedProposals.map(p => ({
    key: 'p-' + p.id,
    proposal: p,
    invoices: sortedInvoices.filter(i => i.proposal_id === p.id),
  }));
  const orphanInvoices = sortedInvoices.filter(i => !i.proposal_id);
  for (const i of orphanInvoices) {
    dealCards.push({ key: 'i-' + i.id, proposal: null, invoices: [i] });
  }

  // Per-DealCard "compose invoice" toggle (key = proposal.id). Lives at
  // the parent so realtime updates don't reset the open/closed state.
  const [composeInvoiceFor, setComposeInvoiceFor] = React.useState(null);

  const DealCard = ({ proposal, invoices }) => {
    const showInvoiceComposer = proposal && composeInvoiceFor === proposal.id;
    // Approved proposal with no invoice yet → surface "Generate invoice"
    // CTA right inside the card. Approved proposal that already has
    // invoices but isn't fully invoiced → smaller secondary trigger.
    const billedSum = invoices
      .filter(i => !['voided', 'refunded', 'draft', 'declined'].includes(i.status))
      .reduce((s,i) => s + (i.amount_cents || 0), 0);
    const propTotal = proposal?.amount_cents || 0;
    const fullyBilled = propTotal > 0 && billedSum >= propTotal;
    const canGenerateInvoice = proposal?.status === 'approved' && !fullyBilled;

    return (
      <div data-card style={{
        background:'white', border:'1px solid rgba(11,31,59,0.10)', borderRadius:10,
        marginBottom:14, overflow:'hidden',
      }}>
        {proposal && (
          <FinanceRow
            left={tierLabel(proposal.tier)}
            money={formatMoneyCents(proposal.amount_cents)}
            status={proposal.status}
            activity={propActivity(proposal)}
            linkUrl={proposalUrl(proposal)}
            onCancel={proposal.status === 'sent' || proposal.status === 'viewed' ? () => cancelProposal(proposal) : null}
          />
        )}

        {/* Approved → CTA to start the invoice composer right inside
            this card. Once clicked, the composer slides in below. */}
        {canGenerateInvoice && !showInvoiceComposer && (
          <div style={{ padding:'0 14px 12px' }}>
            <button
              onClick={() => setComposeInvoiceFor(proposal.id)}
              style={{
                width:'100%', height:40, borderRadius:8,
                background:GOLD, color:NAVY, border:'none',
                fontSize:13, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}
            >
              {invoices.length === 0 ? '+ Generate deposit invoice' : '+ Generate next invoice'}
            </button>
          </div>
        )}

        {/* Inline invoice composer — renders inside the same card so the
            user stays in context. Once sent, the composer collapses and
            the new invoice row materialises below via realtime. */}
        {showInvoiceComposer && (
          <div style={{ padding:'0 14px 12px' }}>
            <NewInvoiceModal
              contact={contact}
              latestSignedProposal={proposal}
              invoices={invoices}
              onClose={() => setComposeInvoiceFor(null)}
              inline
            />
          </div>
        )}

        {invoices.length > 0 && (
          <div style={{ padding:'0 14px 12px' }}>
            {invoices.map(inv => (
              <FinanceRow
                key={inv.id}
                left={capitalize(inv.kind)}
                money={formatMoneyCents(inv.amount_cents)}
                status={inv.status}
                activity={invActivity(inv)}
                linkUrl={invoiceUrl(inv)}
                onMarkPaid={['sent','viewed','overdue'].includes(inv.status) ? () => markPaid(inv) : null}
                onVoid={['sent','viewed','overdue'].includes(inv.status) ? () => voidInvoice(inv) : null}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'12px 16px 16px' }}>
      {/* Top create buttons. Either creates a new inline composer at the
          top of the list — no modal overlay. + New invoice falls back to
          standalone invoice (no proposal link) if no approved proposal
          is in scope; if there IS one, the per-card "Generate invoice"
          button inside that DealCard is the better path. */}
      {!proposalModalOpen && !invoiceModalOpen && (
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={() => { setInvoiceModalOpen(false); setProposalModalOpen(true); }} style={{
            flex:1, height:40, borderRadius:8,
            background:GOLD, color:NAVY, border:'none',
            fontSize:13, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>+ New proposal</button>
          <button onClick={() => { setProposalModalOpen(false); setInvoiceModalOpen(true); }} style={{
            flex:1, height:40, borderRadius:8,
            background:'white', color:NAVY, border:'1px solid rgba(11,31,59,0.15)',
            fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>+ New invoice</button>
        </div>
      )}

      {/* Inline proposal composer — sits at the top of the deal list. */}
      {proposalModalOpen && (
        <NewProposalModal contact={contact} onClose={() => setProposalModalOpen(false)} inline />
      )}

      {/* Inline standalone-invoice composer — for billing without a
          proposal on file. If there IS an approved proposal, the
          per-card Generate invoice button is the primary path. */}
      {invoiceModalOpen && (
        <NewInvoiceModal
          contact={contact}
          latestSignedProposal={proposals.find(p => p.status === 'approved')}
          invoices={invoices}
          onClose={() => setInvoiceModalOpen(false)}
          inline
        />
      )}

      {dealCards.map(d => <DealCard key={d.key} proposal={d.proposal} invoices={d.invoices} />)}

      {dealCards.length === 0 && !proposalModalOpen && !invoiceModalOpen && (
        <div style={{ padding:'48px 24px', textAlign:'center', color:MUTED, fontSize:13 }}>Use the buttons above to send a proposal or invoice.</div>
      )}
    </div>
  );
}

// ── Contact Messages ──────────────────────────────────────────────
// Editable templates library. Persists in localStorage so Key can edit
// his own canned replies without touching code. Seeded with the most
// common solo-electrician scenarios. {firstName} expands at insert time.
const TEMPLATES_KEY = 'bpp_v3_message_templates';
const DEFAULT_TEMPLATES = [
  'Hey {firstName}! Confirming the install for tomorrow.',
  'Running about 15 min late — be there shortly.',
  'On my way!',
  'Reminder: install is set for tomorrow morning, 9am.',
  'Wrapped up — looks great. Mind dropping a quick Google review when you have a sec? Thanks!',
  'Permit just landed. Scheduling install now.',
  'Got a question on the panel — quick photo when you can?',
];
function loadTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || 'null');
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {}
  return DEFAULT_TEMPLATES;
}

function TemplateEditModal({ onClose }) {
  const [list, setList] = React.useState(loadTemplates);
  const [draft, setDraft] = React.useState('');
  const save = () => {
    window.safeSetItem?.(TEMPLATES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('crm-templates-changed'));
    window.showToast?.('Templates saved');
    onClose();
  };
  return (
    <ModalShell open={true} onClose={onClose} title="Saved templates" footer={
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onClose} style={{ flex:'1 1 0', minWidth:0, height:42, borderRadius:8, background:'white', border:'1px solid rgba(11,31,59,0.15)', color:NAVY, fontWeight:600, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Cancel</button>
        <button onClick={save} style={{ flex:'1 1 0', minWidth:0, height:42, borderRadius:8, background:GOLD, border:'none', color:NAVY, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Save</button>
      </div>
    }>
      <div style={{ fontSize:11, color:MUTED, lineHeight:1.5, marginBottom:10 }}>
        Tap a chip in the messages tab to drop the template into compose. Use <code style={{ background:'#F5F5F3', padding:'1px 4px', borderRadius:3, fontSize:10 }}>{'{firstName}'}</code> and it'll expand.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
        {list.map((t, i) => (
          <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
            <div contentEditable suppressContentEditableWarning
              ref={el => { if (el && el.innerText !== t) el.innerText = t || ''; }}
              onInput={e => { const val = e.currentTarget.innerText; setList(l => l.map((x,j) => j===i ? val : x)); }}
              style={{
                flex:1, padding:'8px 10px', border:'1px solid rgba(11,31,59,0.15)', borderRadius:6, fontSize:13, color:NAVY, fontFamily:'inherit', minHeight:40, whiteSpace:'pre-wrap', wordBreak:'break-word', outline:'none',
              }} />
            <button onClick={() => setList(l => l.filter((_,j) => j !== i))} aria-label="Delete template" style={{
              width:32, height:32, borderRadius:6, background:'#FEE2E2', color:'#991B1B', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0,
            }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <div contentEditable suppressContentEditableWarning data-placeholder="New template…"
          ref={el => { if (el && el.innerText !== draft) el.innerText = draft || ''; }}
          onInput={e => setDraft(e.currentTarget.innerText)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          style={{
            flex:1, minHeight:36, borderRadius:6, border:'1px solid rgba(11,31,59,0.15)', padding:'8px 10px', fontSize:14, color:NAVY, fontFamily:'inherit', outline:'none', whiteSpace:'nowrap', overflow:'hidden',
          }} />
        <button onClick={() => { if (draft.trim()) { setList(l => [...l, draft.trim()]); setDraft(''); } }} style={{
          height:36, padding:'0 14px', borderRadius:6, background:NAVY, color:'white', border:'none', fontWeight:600, cursor:'pointer', fontFamily:'inherit', fontSize:13,
        }}>Add</button>
      </div>
      <button onClick={() => { setList(DEFAULT_TEMPLATES); window.showToast?.('Reset to defaults'); }} style={{
        background:'none', border:'none', color:MUTED, fontSize:11, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline',
      }}>Reset to defaults</button>
    </ModalShell>
  );
}

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
  const [templates, setTemplates] = React.useState(loadTemplates);
  const [editingTemplates, setEditingTemplates] = React.useState(false);
  // Auto-reply suggestions — Claude reads thread + Key's last 20 outbound
  // replies + starred examples → 3 short replies in his voice. Tap to
  // drop into compose. Star (⭐) the ones you actually send to weight
  // them as gold-standard for future calls.
  const [suggestions, setSuggestions] = React.useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);
  const [suggestionsErr, setSuggestionsErr] = React.useState('');
  const fetchSuggestions = async () => {
    if (suggestionsLoading) return;
    setSuggestionsLoading(true);
    setSuggestionsErr('');
    try {
      const { data, error } = await CRM.__invokeFn('suggest-reply', { body: { contactId: contact.id } });
      if (error || !data) {
        setSuggestionsErr(`Failed: ${error?.message || 'unknown'}`);
        setSuggestions([]);
      } else if (data.error) {
        setSuggestionsErr(data.error);
        setSuggestions([]);
      } else {
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      setSuggestionsErr(e.message || String(e));
    } finally {
      setSuggestionsLoading(false);
    }
  };
  // Star a suggestion — saves it to reply_suggestion_stars so future
  // suggest-reply calls weight it heavily.
  const starSuggestion = async (body) => {
    try {
      await CRM.__db?.from('reply_suggestion_stars').insert({ body, contact_id: contact.id });
      window.showToast?.('Saved as example');
    } catch (e) {
      window.showToast?.(`Star failed: ${e.message || e}`);
    }
  };
  // Reset suggestions when contact changes — they're per-thread.
  React.useEffect(() => {
    setSuggestions([]);
    setSuggestionsErr('');
  }, [contact.id]);
  const containerRef = React.useRef(null);
  const imgRef = React.useRef(null);
  const fileRef = React.useRef(null);

  // Live-refresh templates when the editor saves them.
  React.useEffect(() => {
    const refresh = () => setTemplates(loadTemplates());
    window.addEventListener('crm-templates-changed', refresh);
    return () => window.removeEventListener('crm-templates-changed', refresh);
  }, []);

  // {firstName} expansion at insert time so Key can save one template
  // and have it personalize per contact.
  const expandTemplate = (t) => {
    const first = (contact.name || '').trim().split(/\s+/)[0] || '';
    return t.replace(/\{firstName\}/g, first);
  };

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

  // In-thread search — finds the gate code / panel photo / permit number
  // a customer texted weeks ago without scrolling 60 messages of install
  // chatter. Hidden behind a magnifier toggle so it doesn't claim header
  // real estate every session.
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [threadQuery, setThreadQuery] = React.useState('');
  const matchesQuery = (m) => {
    if (!threadQuery.trim()) return true;
    return (m.body || '').toLowerCase().includes(threadQuery.toLowerCase());
  };

  // Group by day for the date dividers; respects active search.
  const grouped = allMsgs.filter(matchesQuery).reduce((acc, m) => {
    const d = dayKey(m.sent_at);
    (acc[d] = acc[d] || []).push(m);
    return acc;
  }, {});
  const matchCount = threadQuery.trim() ? Object.values(grouped).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, position:'relative', background:'#F8F8F6' }}>
      {/* v10.1.29: dedicated search row removed (Key feedback 2026-05-04) —
          the gray bar took valuable mobile vertical space for a feature
          rarely used. When search is active (toggled from contact-header
          magnifier), the compose input swaps to a search input below. */}
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
                    {m.body && <span style={{ padding: m.attachments?.length ? '0 5px' : 0, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{linkify(m.body)}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#999', fontFamily:"'DM Mono', monospace", marginTop:3 }}>{formatTime(m.sent_at)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* AI suggestions row — appears above templates when Key taps
          "Suggest". Each chip = one Claude-generated reply in Key's
          voice. Tap to drop into compose; ⭐ to save as a starred
          example for future calls (the prompt weights starred replies
          highest). */}
      {(suggestions.length > 0 || suggestionsLoading || suggestionsErr) && (
        <div className="hide-scrollbar" style={{ padding:'4px 12px 0', display:'flex', gap:8, overflowX:'auto', flexShrink:0, alignItems:'center' }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#5B21B6', alignSelf:'center', whiteSpace:'nowrap', letterSpacing:'0.05em' }}>SUGGESTED</span>
          {suggestionsLoading && <span style={{ fontSize:11, color:MUTED, fontStyle:'italic' }}>Thinking…</span>}
          {suggestionsErr && <span style={{ fontSize:11, color:'#991B1B', fontStyle:'italic' }}>{suggestionsErr}</span>}
          {suggestions.map((s, i) => (
            <div key={i} style={{ display:'inline-flex', alignItems:'center', flexShrink:0 }}>
              <button onClick={() => setMsg(s)} style={{
                height:30, padding:'0 10px 0 12px', borderRadius:'6px 0 0 6px',
                border:'1px solid #DDD6FE', borderRight:'none',
                background:'#F5F3FF', color:'#5B21B6',
                fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
                fontFamily:'inherit', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis',
              }}>{s.length > 36 ? s.slice(0, 36) + '…' : s}</button>
              <button onClick={() => starSuggestion(s)} aria-label="Star this suggestion" title="Star — use as future example" style={{
                height:30, padding:'0 8px', borderRadius:'0 6px 6px 0',
                border:'1px solid #DDD6FE', background:'#F5F3FF', color:'#5B21B6',
                cursor:'pointer', fontFamily:'inherit', fontSize:11,
              }}>⭐</button>
            </div>
          ))}
        </div>
      )}
      {/* Saved templates — editable list. Tap to insert (with
          {firstName} expansion); pencil opens the editor modal. */}
      <div className="hide-scrollbar" style={{ padding:'4px 12px 0', display:'flex', gap:8, overflowX:'auto', flexShrink:0, alignItems:'center' }}>
        <button onClick={fetchSuggestions} disabled={suggestionsLoading} aria-label="Suggest replies" title="AI reply suggestions in your voice" style={{
          height:30, padding:'0 10px', borderRadius:6,
          border:'1px solid #DDD6FE', background:'#F5F3FF', color:'#5B21B6',
          cursor: suggestionsLoading ? 'wait' : 'pointer', fontFamily:'inherit', flexShrink:0,
          fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z"/></svg>
          {suggestionsLoading ? 'Thinking…' : 'Suggest'}
        </button>
        <button onClick={() => setEditingTemplates(true)} aria-label="Edit templates" title="Edit templates" style={{
          width:30, height:30, borderRadius:6, border:'1px solid rgba(11,31,59,0.15)', background:'white',
          color:MUTED, cursor:'pointer', fontFamily:'inherit', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        {templates.map((t, i) => {
          // Expand {firstName} for both the chip preview AND the value
          // dropped into compose. Showing the raw `{firstName}` token
          // makes the chip read like a code variable, not a real text.
          const expanded = expandTemplate(t);
          return (
            <button key={i} onClick={() => setMsg(expanded)} style={{
              height:30, padding:'0 12px', borderRadius:6,
              border:'1px solid rgba(11,31,59,0.15)', background:'white', color:NAVY,
              fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
              fontFamily:'inherit', flexShrink:0,
              maxWidth:180, overflow:'hidden', textOverflow:'ellipsis',
            }}>{expanded.length > 28 ? expanded.slice(0, 28) + '…' : expanded}</button>
          );
        })}
      </div>
      {editingTemplates && <TemplateEditModal onClose={() => setEditingTemplates(false)} />}

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

      {/* Compose. v10.1.27: padding-bottom uses --vvs which collapses to 0
          when the keyboard is open (visualViewport.height < 600), restoring
          to env(safe-area-inset-bottom) when keyboard closed. Eliminates
          the chin gap below compose when keyboard is up. */}
      {!isDnc && (
        <div style={{ padding:'10px 16px calc(14px + var(--vvs, env(safe-area-inset-bottom, 0px)))', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
          {/* v10.1.30: contentEditable div instead of textarea. iOS shows
              the up/down/checkmark accessory bar above the keyboard for
              ANY form field (input/textarea), but NOT for contentEditable
              elements. This kills the bar.
              Caveats: keep .innerText in sync with React state, handle
              placeholder via :empty pseudo, manually clear on send. */}
          <div
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Message…"
            ref={el => { if (el && el.innerText !== msg) el.innerText = msg || ''; }}
            onInput={e => setMsg(e.currentTarget.innerText)}
            onKeyDown={e=>{
              const isMobile = window.innerWidth < 768;
              if (e.key==='Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); send(); }
            }}
            style={{
              flex:1, minHeight:36, maxHeight:92,
              borderRadius:8, border:'1px solid rgba(11,31,59,0.15)',
              padding:'8px 12px', fontSize:16, fontFamily:'inherit', outline:'none',
              color:NAVY, lineHeight:1.35, boxSizing:'border-box', background:'white',
              overflowY:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word',
              WebkitUserModify: 'read-write-plaintext-only',
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
        const transcript = cl.voicemail_transcript || cl.voicemail_transcription || '';
        return (
          <div key={cl.id} style={{
            background:'white', border:'1px solid rgba(11,31,59,0.08)', borderRadius:8,
            padding:'12px 14px', marginBottom:8,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%',
                background: cl.voicemail_url ? '#EDE9FE' : s.bg, color: cl.voicemail_url ? '#7C3AED' : s.color,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>{cl.voicemail_url ? <div style={{ width:14, height:14 }}>{Icons.voicemail}</div> : s.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>
                  {cl.voicemail_url ? 'Voicemail' : s.label}
                </div>
                <div style={{ fontSize:12, color:'#666', marginTop:2, fontFamily:"'DM Mono', monospace" }}>{fmtRow(cl.started_at)}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace", flexShrink:0 }}>{dur}</div>
            </div>
            {/* Voicemail playback + transcription. Twilio's transcribe
                hands us the text; we render it below the row so Key
                doesn't need to listen while driving. */}
            {cl.voicemail_url && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(11,31,59,0.06)' }}>
                {transcript ? (
                  <div style={{ fontSize:13, color:NAVY, lineHeight:1.5, fontStyle:'italic', marginBottom:8 }}>
                    "{transcript}"
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:MUTED, marginBottom:8 }}>Transcription pending…</div>
                )}
                <audio controls preload="none" src={cl.voicemail_url} style={{ width:'100%', height:32 }}></audio>
              </div>
            )}
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
          // safe-area-inset-bottom keeps the action buttons clear of the
          // iPhone home indicator on the bottom-sheet variant.
          <div style={{
            padding:'12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop:'1px solid rgba(11,31,59,0.08)', flexShrink:0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}

// ── New Proposal Modal / Inline Composer ──────────────────────────────
// Quick-quote — amp toggle, tier selector, add-on chips, auto-total,
// "Send to customer" inserts proposal + fires send-sms in one move.
// Mirrors the v1/v2 pricing engine exactly so proposal.html renders
// the same totals.
//
// When `inline` is true, renders as a plain card (no overlay). The
// Finance pane uses inline mode so the composer feels like part of the
// page, evolving into the proposal row once sent. Modal mode is kept
// for any cross-tab dispatch path that still wants an overlay.
function NewProposalModal({ contact, onClose, inline = false }) {
  // Trim before split-or-default so a name of "  " doesn't render
  // "Hey , here's your quote" — guards against whitespace-only DB rows.
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');
  // Default amp from the contact's actual install spec. mapContact
  // selects `panel_amps` (canonical column) — `amp_type` was never
  // mapped, so reading it always fell back to '30' even for a 50A
  // panel. Coerce to '30'/'50' or fall back when unset/legacy.
  const [amp,        setAmp]        = React.useState(['30','50'].includes(String(contact.panel_amps)) ? String(contact.panel_amps) : '30');
  const [tier,       setTier]       = React.useState(contact.pricing_tier || 'standard');
  const [cordIncluded,  setCord]    = React.useState(true);
  const [includeSurge,  setSurge]   = React.useState(false);
  const [includePom,    setPom]     = React.useState(false);
  const [includePermit, setPermit]  = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const total = React.useMemo(() => quickQuoteTotal({
    amp, cordIncluded, includeSurge, includePom, includePermit, tier,
  }), [amp, cordIncluded, includeSurge, includePom, includePermit, tier]);

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
      // Bump contact stage NEW → QUOTED. contact.stage is the v3 STRING
      // form ('new'); the prior `=== 1` compared string vs number and
      // never matched. Translate to numeric for the DB write.
      if (contact.stage === 'new') {
        const numQuoted = CRM.STAGE_STR_TO_NUM?.quoted ?? 2;
        contact.stage = 'quoted';
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        CRM.__db.from('contacts').update({ stage: numQuoted }).eq('id', contact.id).then(() => {}, () => {});
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
    // 2-up basis (~50% width) so "Peace of Mind" doesn't get squeezed
    // below its intrinsic width on a 390px viewport (4-up = 83px each;
    // Peace of Mind needs ~95px). flex-wrap drops the row to two when
    // there's not enough space for all 4 inline.
    <button onClick={onClick} style={{
      flex:'1 1 calc(50% - 4px)', minWidth:0, height:36, borderRadius:8,
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

  // Form body — extracted so we can render it in either a ModalShell
  // or an inline card without duplicating all the chip/seg markup.
  const formBody = (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
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
  );

  const footerRow = (
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
  );

  if (inline) {
    return (
      <div data-card style={{
        background:'white', border:'1px solid rgba(11,31,59,0.12)', borderRadius:8,
        marginBottom:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px 10px', borderBottom:'1px solid rgba(11,31,59,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:NAVY }}>New proposal</div>
          <button onClick={onClose} aria-label="Cancel" style={{
            width:32, height:32, borderRadius:6, border:'none', background:'transparent',
            color:'#666', fontSize:22, lineHeight:1, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>
        <div style={{ padding:'14px' }}>{formBody}</div>
        <div style={{ padding:'10px 14px 12px', borderTop:'1px solid rgba(11,31,59,0.06)' }}>
          {footerRow}
        </div>
      </div>
    );
  }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`New proposal — ${contact.name || formatPhone(contact.phone)}`}
      footer={footerRow}
    >
      {formBody}
    </ModalShell>
  );
}

// ── New Invoice Modal ─────────────────────────────────────────────────
// Type picker (Deposit/Final/Balance), amount input, optional description.
// Deposit auto-fills 50% of approved-proposal total; Final fills remainder
// after summing deposit invoices; Balance is custom (Key types it).
function NewInvoiceModal({ contact, latestSignedProposal, invoices, onClose, inline = false }) {
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

  const formBody = (
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
        <div contentEditable suppressContentEditableWarning data-placeholder={lineLabel}
          ref={el => { if (el && el.innerText !== description) el.innerText = description || ''; }}
          onInput={e => setDescription(e.currentTarget.innerText)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          style={{ width:'100%', minHeight:40, border:'1.5px solid #EBEBEA', borderRadius:8, padding:'10px', fontSize:16, color:NAVY, outline:'none', fontFamily:'inherit', background:'white', boxSizing:'border-box', whiteSpace:'nowrap', overflow:'hidden' }}
        />
      </div>
    </div>
  );

  const footerRow = (
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
  );

  if (inline) {
    return (
      <div data-card style={{
        background:'white', border:'1px solid rgba(11,31,59,0.12)', borderRadius:8,
        marginBottom:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px 10px', borderBottom:'1px solid rgba(11,31,59,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:NAVY }}>
            {latestSignedProposal ? 'Generate invoice' : 'New invoice'}
          </div>
          <button onClick={onClose} aria-label="Cancel" style={{
            width:32, height:32, borderRadius:6, border:'none', background:'transparent',
            color:'#666', fontSize:22, lineHeight:1, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>
        <div style={{ padding:'14px' }}>{formBody}</div>
        <div style={{ padding:'10px 14px 12px', borderTop:'1px solid rgba(11,31,59,0.06)' }}>
          {footerRow}
        </div>
      </div>
    );
  }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`New invoice — ${contact.name || formatPhone(contact.phone)}`}
      footer={footerRow}
    >
      {formBody}
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
  // entry. Compute days-in-stage for each transition. The DB column is
  // `changed_at` not `created_at` — wrong field name silently produced
  // NaN on every transition and the card rendered with empty pills.
  const sorted = [...rows].sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
  const startTs = new Date(sorted[0].changed_at).getTime();

  const segments = [];
  let prevTs = startTs;
  let prevStage = sorted[0].from_stage;
  if (prevStage != null) {
    const days = Math.max(0, Math.floor((new Date(sorted[0].changed_at).getTime() - prevTs) / 86400000));
    segments.push({ stage: prevStage, days, transitionAt: sorted[0].changed_at });
  }
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const next = sorted[i + 1];
    const ts = new Date(t.changed_at).getTime();
    const endTs = next ? new Date(next.changed_at).getTime() : Date.now();
    const days = Math.max(0, Math.floor((endTs - ts) / 86400000));
    segments.push({ stage: t.to_stage, days, transitionAt: t.changed_at, current: !next });
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

// ── AddressAutocomplete ─────────────────────────────────────────────
// Search-as-you-type using Nominatim (the same OpenStreetMap geocoder
// we already use for drive-time). Free, no key. Suggestions appear in
// a dropdown beneath the input — tap to fill. 600ms debounce respects
// Nominatim's 1 req/sec fair-use policy. SC bias keeps results local.
function AddressAutocomplete({ value, onChange, placeholder, style }) {
  const [open, setOpen] = React.useState(false);
  const [hits, setHits] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const debounceRef = React.useRef(null);
  const lastQueriedRef = React.useRef('');

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (value || '').trim();
    if (q.length < 4 || q === lastQueriedRef.current) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      lastQueriedRef.current = q;
      try {
        // SC bounding box biases Nominatim toward our service area.
        // viewbox=west,south,east,north (BPP services Greenville,
        // Spartanburg, Pickens — approx -83.4..-78.5, 32.0..35.2).
        // bounded=0 keeps the bias soft so out-of-state matches still
        // appear if Key types a long-distance address.
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&countrycodes=us&addressdetails=1&viewbox=-83.4,35.2,-78.5,32.0&bounded=0&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!r.ok) { setHits([]); setSearching(false); return; }
        const data = await r.json();
        // City extraction. For Greenville County addresses where
        // Nominatim returns a CDP/neighborhood (e.g. "Sans Souci",
        // "Wade Hampton") we prefer "Greenville" because that's the
        // postal city Key uses. Same for Spartanburg County.
        const cityFor = (a) => {
          if (a.city) return a.city;
          if (a.town) return a.town;
          // CDP override: ANY address in our 4-jurisdiction area maps
          // to the canonical city when Nominatim picks a less-known
          // village/CDP/suburb.
          const county = (a.county || '').toLowerCase();
          if (county.includes('greenville')) return 'Greenville';
          if (county.includes('spartanburg')) return 'Spartanburg';
          if (county.includes('pickens')) return 'Pickens';
          return a.village || a.hamlet || a.suburb || a.county || '';
        };
        // Bias SC results to top — sort with SC matches first, then
        // by Nominatim's importance (display order). Keep cap at 5.
        const ranked = (data || [])
          .map((row, i) => ({ row, i, isSC: (row.address?.state || '').toLowerCase() === 'south carolina' }))
          .sort((a, b) => (b.isSC - a.isSC) || (a.i - b.i))
          .slice(0, 5)
          .map(({ row }) => row);
        const suggestions = ranked.map(row => {
          const a = row.address || {};
          const street = [a.house_number, a.road].filter(Boolean).join(' ');
          const city = cityFor(a);
          const stateAbbr = a.state ? (a['ISO3166-2-lvl4'] || '').replace('US-', '') : '';
          const short = [street, city].filter(Boolean).join(', ');
          return {
            label: short || row.display_name.split(',').slice(0, 3).join(','),
            full: short ? `${short}${stateAbbr ? ' ' + stateAbbr : ''}${a.postcode ? ' ' + a.postcode : ''}` : row.display_name,
          };
        }).filter(s => s.label);
        setHits(suggestions);
        setOpen(suggestions.length > 0);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [value]);

  // The dropdown is portaled to document.body with position:fixed so it
  // can extend beyond a modal's scroll boundary (parent has overflow:auto).
  // Recompute coordinates on scroll (capture phase catches modal scroll
  // too) + resize. Outside-click closes when the click is neither on the
  // input nor the dropdown itself.
  const inputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);
  const [rect, setRect] = React.useState(null);

  // Smart placement: prefer below the input, but flip above when there's
  // not enough room (e.g. mobile bottom-sheet modal where the input sits
  // near the viewport floor). Always cap maxHeight to whatever fits in
  // the chosen direction so the dropdown is never clipped by the
  // viewport edge.
  const updateRect = React.useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const desired = 240;
    if (spaceBelow >= 140 || spaceBelow >= spaceAbove) {
      // Below.
      setRect({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.min(desired, Math.max(120, spaceBelow)) });
    } else {
      // Flip above. `bottom` anchors so the dropdown grows upward as it
      // gets taller, instead of clipping at top:0.
      setRect({ bottom: vh - r.top + 4, left: r.left, width: r.width, maxHeight: Math.min(desired, Math.max(120, spaceAbove)) });
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open, updateRect]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (
        (inputRef.current && inputRef.current.contains(e.target)) ||
        (dropdownRef.current && dropdownRef.current.contains(e.target))
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div style={{ position:'relative' }}>
      <div
        ref={el => {
          inputRef.current = el;
          if (el && el.innerText !== value) el.innerText = value || '';
        }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={e => onChange(e.currentTarget.innerText)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
        style={{ ...style, minHeight: (style && style.height) || 40, height: 'auto', padding:'10px 12px', whiteSpace:'nowrap', overflow:'hidden' }}
      />
      {searching && (
        <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:MUTED }}>…</div>
      )}
      {open && hits.length > 0 && rect && ReactDOM.createPortal(
        <div ref={dropdownRef} style={{
          position:'fixed',
          ...(rect.top != null ? { top: rect.top } : { bottom: rect.bottom }),
          left: rect.left, width: rect.width, zIndex:10000,
          background:'white', border:'1px solid rgba(11,31,59,0.15)', borderRadius:8,
          boxShadow:'0 8px 24px rgba(11,31,59,0.16)',
          maxHeight: rect.maxHeight || 240, overflowY:'auto',
        }}>
          {hits.map((h, i) => (
            <button
              key={i}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(h.full); setOpen(false); }}
              style={{
                width:'100%', padding:'10px 12px', textAlign:'left', background:'white', border:'none',
                borderBottom: i < hits.length - 1 ? '1px solid #F5F5F3' : 'none',
                cursor:'pointer', fontFamily:'inherit', fontSize:14, color:NAVY,
              }}
            >{h.full}</button>
          ))}
        </div>,
        document.body
      )}
    </div>
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

  // Save is enabled once minimum-viable contact info is present —
  // either a name or a complete US phone (10 digits). Keeps Key from
  // saving rows with just "Bob" that he can't actually call.
  const phoneDigits = phone.replace(/\D/g, '');
  const canSave = !!name.trim() || phoneDigits.length === 10;

  const submit = async () => {
    if (busy || !canSave) return;
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
          <button onClick={submit} disabled={busy || !canSave} style={{
            flex:'1 1 0', minWidth:0, height:42, borderRadius:8,
            background: (busy || !canSave) ? '#E5E5E5' : '#ffba00', color: (busy || !canSave) ? '#999' : NAVY,
            border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
            cursor: (busy || !canSave) ? 'not-allowed' : 'pointer',
          }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Name</div>
          <div contentEditable suppressContentEditableWarning data-placeholder="Full name"
            ref={el => { if (el) { if (el.innerText !== name) el.innerText = name || ''; if (!name) setTimeout(() => el.focus(), 0); } }}
            onInput={e => setName(e.currentTarget.innerText)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (canSave) submit(); } }}
            style={{ ...inputStyle, minHeight:40, padding:'10px 12px', whiteSpace:'nowrap', overflow:'hidden' }} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Phone</div>
          <input value={phone} onChange={e=>setPhone(formatPhoneInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) { e.preventDefault(); submit(); } }}
            placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Address (optional)</div>
          <AddressAutocomplete value={address} onChange={setAddress} placeholder="123 Main St, Spartanburg" style={inputStyle} />
        </div>
        <div style={{ fontSize:11, color:MUTED, lineHeight:1.5 }}>
          New leads land at stage 1 (New). You can advance the stage from the contact's overview after creating.
        </div>
      </div>
    </ModalShell>
  );
}

// ── New Event Modal ──────────────────────────────────────────────────
// Global "Add event" — pick a contact, kind, date, time, save. Mirrors
// AddEventInline (per-contact) but with a contact picker on top.
function NewEventModal({ contacts = [], onClose }) {
  const [contactId, setContactId] = React.useState('');
  const [kind, setKind] = React.useState('install');
  const [date, setDate] = React.useState(() => {
    const d = new Date(Date.now() + 24*3600*1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [time, setTime] = React.useState('09:00');
  const [busy, setBusy] = React.useState(false);

  // Sort contacts alphabetically for the picker. Filter out archived.
  const pickable = (contacts || []).filter(c => !c.archived).sort((a,b) => (a.name||'').localeCompare(b.name||''));

  const KIND_OPTIONS = [
    { v:'install',   label:'Install' },
    { v:'inspect',   label:'Inspection' },
    { v:'follow_up', label:'Follow-up call' },
    { v:'pickup',    label:'Pickup' },
    { v:'meeting',   label:'Meeting' },
  ];

  const submit = async () => {
    if (busy) return;
    if (!contactId) { window.showToast?.('Pick a contact'); return; }
    if (!date || !time) { window.showToast?.('Pick a date and time'); return; }
    if (!CRM.__db) { window.showToast?.('Supabase not loaded'); return; }
    setBusy(true);
    const startIso = new Date(`${date}T${time}:00`).toISOString();
    const durMin = kind === 'install' ? 180 : kind === 'inspect' ? 30 : 60;
    const endIso = new Date(new Date(startIso).getTime() + durMin*60*1000).toISOString();
    const titleFor = ({ install:'Install', inspect:'Inspection', follow_up:'Follow-up call', pickup:'Pickup', meeting:'Meeting' })[kind] || 'Event';
    // DB column is `event_type`; no `status` column. Insert via the
    // real schema, alias back to `kind` in our in-memory row.
    const row = {
      contact_id: contactId,
      event_type: kind,
      title: titleFor,
      start_at: startIso,
      end_at: endIso,
    };
    const { data, error } = await CRM.__db.from('calendar_events').insert(row).select().single();
    if (error || !data) {
      setBusy(false);
      window.showToast?.(`Save failed: ${error?.message || 'unknown'}`);
      return;
    }
    CRM.events.push({
      id: data.id, contact_id: data.contact_id, kind: data.event_type || kind,
      start_at: data.start_at, end_at: data.end_at, title: data.title, status: 'scheduled',
    });
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    window.showToast?.(`${titleFor} scheduled`);
    onClose();
  };

  const inputStyle = { width:'100%', height:40, padding:'0 12px', fontSize:16, fontFamily:'inherit', border:'1px solid rgba(11,31,59,0.15)', borderRadius:8, background:'white', color:NAVY, outline:'none', boxSizing:'border-box' };
  const todayMin = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Add event"
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
          }}>{busy ? 'Saving…' : 'Schedule'}</button>
        </div>
      )}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Contact</div>
          <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
            <option value="">— pick a contact —</option>
            {pickable.map(c => <option key={c.id} value={c.id}>{c.name || formatPhone(c.phone) || c.id.slice(0,4)}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Kind</div>
          <select value={kind} onChange={e => setKind(e.target.value)} style={inputStyle}>
            {KIND_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
        <DatePresetRow value={date} onChange={setDate} />
        <div style={{ display:'flex', gap:8 }}>
          <input type="date" value={date} min={todayMin} max="2099-12-31" onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }} />
          <input type="time" value={time} step="900" onChange={e => setTime(e.target.value)} style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }} />
        </div>
        {contactId && <ScheduleConflictHint date={date} time={time} durationMin={60} contactId={contactId} />}
      </div>
    </ModalShell>
  );
}

// Schedule-conflict hint. Validates a proposed slot against existing
// events for the same day. Flags time overlap and back-to-back same-day
// events with insufficient drive-time buffer. Drive-time is a heuristic
// (same city = 5min, different = 25min, unknown = 15min) — solid enough
// for the truck-dispatch-fitness check without a routing API call.
function ScheduleConflictHint({ date, time, durationMin = 60, contactId }) {
  if (!date || !time) return null;
  const events = window.CRM?.events || [];
  const contacts = window.CRM?.contacts || [];
  const contact = contacts.find(c => c.id === contactId);
  // Build the slot start/end Date objects in local TZ.
  const [yy, mm, dd] = date.split('-').map(Number);
  const [hh, mn] = time.split(':').map(Number);
  const start = new Date(yy, mm - 1, dd, hh, mn);
  const end = new Date(start.getTime() + durationMin * 60000);

  const myCity = (contact?.address || '').split(',').slice(1, 2).join('').trim().toLowerCase();
  const sameDay = events.filter(e => {
    if (!e.start_at || e.status !== 'scheduled') return false;
    const d = new Date(e.start_at);
    return d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd;
  });

  let issue = null;
  for (const e of sameDay) {
    const eStart = new Date(e.start_at);
    const eEnd = e.end_at ? new Date(e.end_at) : new Date(eStart.getTime() + 60 * 60000);
    // Overlap?
    if (eStart < end && eEnd > start) {
      issue = { kind: 'overlap', other: e };
      break;
    }
    // Back-to-back tightness — gap between earlier-end and later-start.
    const otherC = contacts.find(c => c.id === e.contact_id);
    const otherCity = (otherC?.address || '').split(',').slice(1, 2).join('').trim().toLowerCase();
    const driveMin = !myCity || !otherCity ? 15 : (myCity === otherCity ? 5 : 25);
    if (eEnd <= start) {
      const gapMin = (start - eEnd) / 60000;
      if (gapMin < driveMin) {
        issue = { kind: 'tight', other: e, gapMin: Math.round(gapMin), driveMin };
        break;
      }
    } else if (start <= eStart) {
      const gapMin = (eStart - end) / 60000;
      if (gapMin < driveMin) {
        issue = { kind: 'tight', other: e, gapMin: Math.round(gapMin), driveMin };
        break;
      }
    }
  }

  if (!issue) return null;
  const otherName = contacts.find(c => c.id === issue.other.contact_id)?.name || 'Another event';
  return (
    <div style={{
      background: issue.kind === 'overlap' ? '#FEE2E2' : '#FEF3C7',
      border: `1px solid ${issue.kind === 'overlap' ? '#FECACA' : '#FDE68A'}`,
      borderRadius:8, padding:'8px 10px', marginTop:6,
      fontSize:11, color: issue.kind === 'overlap' ? '#991B1B' : '#92400E', lineHeight:1.4,
    }}>
      <div style={{ fontWeight:700, marginBottom:2 }}>
        {issue.kind === 'overlap' ? '⚠ Overlaps with another event' : '⚠ Tight schedule'}
      </div>
      {issue.kind === 'overlap' ? (
        <span>{otherName} is already booked at {formatTime(issue.other.start_at)}.</span>
      ) : (
        <span>Only {issue.gapMin} min between this and {otherName} ({formatTime(issue.other.start_at)}). Drive estimate: {issue.driveMin} min.</span>
      )}
    </div>
  );
}

// Date quick-pick chips. Today / Tomorrow / Friday / Next week. Tapping
// a chip writes the YYYY-MM-DD into the date input. The active chip
// highlights gold so Key knows what's currently selected.
function DatePresetRow({ value, onChange }) {
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const friday = new Date(today);
  // 0=Sun, 5=Fri. If today is Friday, jump to next Friday.
  const daysToFri = ((5 - today.getDay() + 7) % 7) || 7;
  friday.setDate(today.getDate() + daysToFri);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const presets = [
    { label:'Today',    iso: fmt(today) },
    { label:'Tomorrow', iso: fmt(tomorrow) },
    { label:'Friday',   iso: fmt(friday) },
    { label:'Next week', iso: fmt(nextWeek) },
  ];
  return (
    <div className="hide-scrollbar" style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
      {presets.map(p => {
        const active = value === p.iso;
        return (
          <button key={p.label} onClick={() => onChange(p.iso)} style={{
            height:28, padding:'0 12px', borderRadius:14, fontFamily:'inherit', fontSize:11, fontWeight:600,
            background: active ? GOLD : 'white', color: NAVY,
            border: active ? 'none' : '1px solid rgba(11,31,59,0.15)',
            cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>{p.label}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, { RightPanel, NewProposalModal, NewInvoiceModal, NewContactModal, NewEventModal, ModalShell, DatePresetRow });
