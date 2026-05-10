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
      {tab==='contacts' && <ContactOverview contact={contact} events={cEvents} permits={cPermits} proposals={cProposals} invoices={cInvoices} materials={cMaterials} messages={cMessages} calls={cCalls} bumpData={bumpData} onOpenTab={onOpenTab} />}
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

  // Pin state shares CRM.contacts as the source of truth (column added
  // 2026-05-09 via migration 20260509140000). Pins now sync between
  // desktop and mobile via the contacts realtime channel; before this
  // change the star lived only in localStorage and never crossed devices.
  const pinned = window.usePinned ? window.usePinned() : new Set();
  const isPinned = pinned.has(contact.id);
  const togglePin = async () => {
    const wasOn = isPinned;
    // Optimistic flip on the live row, then persist + revert on error.
    const live = (CRM.contacts || []).find(c => c.id === contact.id) || contact;
    live.pinned = !wasOn;
    window.dispatchEvent(new CustomEvent('crm-pin-changed'));
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ pinned: !wasOn })
        .eq('id', contact.id);
      if (error) {
        live.pinned = wasOn;
        window.dispatchEvent(new CustomEvent('crm-pin-changed'));
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        window.showToast?.('Pin save failed: ' + error.message);
        return;
      }
    }
    window.showToast?.(wasOn ? 'Unpinned' : 'Pinned to top');
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
        {isDnc && <span style={{ fontSize:10,fontWeight:700,color:'#991B1B',background:'#FEF2F2',padding:'1px 6px',borderRadius:20, flexShrink:0 }}>DO NOT CONTACT</span>}
      </div>
      <ContactOverflowMenu contact={contact} isDnc={isDnc} toggleDnc={toggleDnc} bumpData={bumpData} onOpenTab={onOpenTab} />
    </div>
  );
}

// ── Overflow Menu (right-aligned dropdown anchored to the 3-dots button) ─
function ContactOverflowMenu({ contact, isDnc, toggleDnc, bumpData, onOpenTab }) {
  const [open, setOpen] = React.useState(false);
  const [openSubmenu, setOpenSubmenu] = React.useState(null); // label of open submenu
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setOpenSubmenu(null); } };
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); setOpenSubmenu(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => { setOpen(false); setOpenSubmenu(null); };

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
    window.open(`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`, '_blank', 'noopener,noreferrer');
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
      // Pinned contacts moved to contacts.pinned column 2026-05-09 —
      // localStorage backfill drains itself on first load. This sweep
      // is now defensive only: if a stale entry sat in some browser,
      // strip it so the migration completes cleanly. Will be deleted
      // entirely after a few weeks.
      try {
        const pinRaw = localStorage.getItem('bpp_v3_pinned_contacts');
        if (pinRaw) {
          const pinned = JSON.parse(pinRaw).filter(id => id !== contactId);
          if (pinned.length === 0) localStorage.removeItem('bpp_v3_pinned_contacts');
          else localStorage.setItem('bpp_v3_pinned_contacts', JSON.stringify(pinned));
        }
      } catch (_) {}
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
    // Optimistic-first, then await + revert on error. Yesterday these
    // were fire-and-forget so a failed write would leave the in-memory
    // state diverged from the DB (and on TCPA-sensitive paths like DNC,
    // that's an actual federal-violation risk). Now: optimistic flip,
    // await the write, revert + toast on error.
    contact.archived = true;
    bumpData?.();
    sweepContactLocal(contact.id);
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ status: 'Archived', archived: true })
        .eq('id', contact.id);
      if (error) {
        contact.archived = false;
        bumpData?.();
        window.showToast?.('Archive failed: ' + error.message);
        return;
      }
    }
    window.showToast?.('Job archived', {
      undo: async () => {
        const live = (CRM.contacts || []).find(x => x.id === contact.id) || contact;
        live.archived = false;
        bumpData?.();
        if (CRM.__db) {
          const { error } = await CRM.__db.from('contacts')
            .update({ status: 'Active', archived: false })
            .eq('id', contact.id);
          if (error) {
            live.archived = true;
            bumpData?.();
            window.showToast?.('Undo failed: ' + error.message);
          }
        }
      },
      duration: 5000,
    });
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
    if (!ok) return;
    // TCPA-critical: must NOT diverge from DB. Optimistic flip, await,
    // revert on error so a silent failure doesn't leave Key thinking
    // the contact is DNC'd when the DB says otherwise.
    contact.do_not_contact = true;
    toggleDnc?.(contact.id);
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ do_not_contact: true, dnc_at: new Date().toISOString(), dnc_source: 'crm_manual' })
        .eq('id', contact.id);
      if (error) {
        contact.do_not_contact = false;
        toggleDnc?.(contact.id);
        window.showToast?.('DNC failed — contact NOT marked: ' + error.message);
      }
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
    if (!ok) return;
    contact.do_not_contact = false;
    toggleDnc?.(contact.id);
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ do_not_contact: false })
        .eq('id', contact.id);
      if (error) {
        contact.do_not_contact = true;
        toggleDnc?.(contact.id);
        window.showToast?.('Allow-again failed — flag still set: ' + error.message);
        return;
      }
    }
    window.showToast?.(contactName(contact) + ' can be contacted again');
  };

  const deleteContact = async () => {
    close();
    const ok = await window.confirmAction?.({
      title: 'Delete ' + contactName(contact) + '?',
      body: 'Soft-deletes (archives) this contact. Recoverable from the Archived filter chip on the contact list.',
      confirmLabel: 'Delete contact',
      destructive: true,
    });
    if (!ok) return;
    // Soft-delete via archived flag. Mirror the archive flow exactly so
    // restoring works through the same Archived lens.
    contact.archived = true;
    bumpData?.();
    sweepContactLocal(contact.id);
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ status: 'Archived', archived: true })
        .eq('id', contact.id);
      if (error) {
        contact.archived = false;
        bumpData?.();
        window.showToast?.('Delete failed: ' + error.message);
        return;
      }
    }
    window.showToast?.('Contact archived (recoverable from Archived lens)');
  };

  // Snooze — hide a contact for N days. Stored in localStorage so this is
  // a per-device gesture (no DB migration). Snooze auto-clears at the
  // until-date; the overflow menu offers preset durations + a custom date.
  const snooze = async (days) => {
    close();
    const until = new Date(Date.now() + days * 86400000);
    window.snoozeContact?.(contact.id, until.toISOString());
    bumpData?.();
    const niceDate = until.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    window.showToast?.('Snoozed until ' + niceDate, {
      undo: () => { window.unsnoozeContact?.(contact.id); bumpData?.(); },
      duration: 5000,
    });
  };
  const snoozeCustom = async () => {
    close();
    const default14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10);
    const v = window.prompt('Snooze until (YYYY-MM-DD):', default14);
    if (!v) return;
    const parsed = new Date(v + 'T08:00:00');
    if (isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) {
      window.showToast?.('Pick a future date');
      return;
    }
    window.snoozeContact?.(contact.id, parsed.toISOString());
    bumpData?.();
    window.showToast?.('Snoozed until ' + parsed.toLocaleDateString(), {
      undo: () => { window.unsnoozeContact?.(contact.id); bumpData?.(); },
      duration: 5000,
    });
  };
  const unsnooze = () => {
    close();
    window.unsnoozeContact?.(contact.id);
    bumpData?.();
    window.showToast?.('Unsnoozed');
  };
  const snoozedTs = window.snoozedUntil?.(contact.id);
  const snoozedLabel = snoozedTs
    ? new Date(snoozedTs).toLocaleDateString(undefined, { month:'short', day:'numeric' })
    : '';

  // Overflow menu — pruned to actions you can't already do inline. Open in
  // Maps and Copy phone live on their own rows in CONTACT INFO; duplicating
  // them here makes the menu noisy for no benefit. Delete copy now reflects
  // the actual behavior (soft-archive — recoverable, no orphaned records).
  const items = [
    { kind:'item', icon:OFI.pencil, label:'Edit contact', onClick: editContact },
    { kind:'divider' },
    snoozedTs
      ? { kind:'item', icon:OFI.clock, label:'Unsnooze', sub:'Currently hidden until ' + snoozedLabel, onClick: unsnooze }
      : { kind:'submenu', icon:OFI.clock, label:'Snooze',
          children: [
            { label:'1 day',     onClick:() => snooze(1) },
            { label:'3 days',    onClick:() => snooze(3) },
            { label:'1 week',    onClick:() => snooze(7) },
            { label:'2 weeks',   onClick:() => snooze(14) },
            { label:'1 month',   onClick:() => snooze(30) },
            { label:'Pick date…', onClick: snoozeCustom },
          ],
        },
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
            // Submenu: clicking the parent toggles an inline-expanded list
            // of choices. Keeps the menu visually contained — no flying
            // side-panels that fall off-screen on narrow CRM panes.
            if (it.kind === 'submenu') {
              const isOpen = openSubmenu === it.label;
              return (
                <React.Fragment key={it.label}>
                  <button
                    onClick={() => setOpenSubmenu(isOpen ? null : it.label)}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:10,
                      padding:'8px 10px', borderRadius:8,
                      background: isOpen ? '#F0F4FF' : 'none', border:'none', textAlign:'left',
                      cursor:'pointer', fontFamily:'inherit', color: NAVY,
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#F8F8F6'; }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'none'; }}
                  >
                    <span style={{ width:14, height:14, flexShrink:0, color: NAVY }}>{it.icon}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{it.label}</span>
                    <span style={{
                      fontSize:10, color: MUTED,
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
                      transition:'transform 0.12s', display:'inline-block',
                    }}>▶</span>
                  </button>
                  {isOpen && it.children.map((c, ci) => (
                    <button
                      key={c.label}
                      onClick={c.onClick}
                      style={{
                        width:'100%', display:'block',
                        padding:'6px 10px 6px 34px', borderRadius:8,
                        background:'none', border:'none', textAlign:'left',
                        cursor:'pointer', fontFamily:'inherit', color: NAVY,
                        fontSize:12, lineHeight:1.3,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8F8F6'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >{c.label}</button>
                  ))}
                </React.Fragment>
              );
            }
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
  clock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
};

// ── Contact Overview ──────────────────────────────────────────────
function ContactOverview({ contact, events, permits = [], proposals = [], materials = [], invoices = [], messages = [], calls = [], bumpData, onOpenTab }) {
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
      // Audit-2026-05-09 H11: capture the contact id at the time the
      // saved-flag was set; if user switches contacts before the 1800ms
      // tick fires, only clear the flag when we're still on the original
      // contact (otherwise the new contact's render briefly flickers).
      const savedFor = contact.id;
      setTimeout(() => {
        if (loadedForContactId.current === savedFor) setNoteSaved(false);
      }, 1800);
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
      <NotesWithMarkdownPreview
        note={note}
        setNote={setNote}
        noteSaving={noteSaving}
        noteSaved={noteSaved}
      />
      <PhotosSection contact={contact} />
      <StageHistoryCard contact={contact} />
      <ActivityTimelineCard
        contact={contact}
        messages={messages}
        calls={calls}
        proposals={proposals}
        invoices={invoices}
        events={events}
        onOpenTab={onOpenTab}
      />
      {latestSigned && (
        <PermitsCard permits={permits} contact={contact} bumpData={bumpData} />
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── PhotoAnnotateModal ────────────────────────────────────────────────
// Full-screen modal: photo + canvas overlay. Pen draws red strokes;
// undo pops the last stroke; clear wipes everything; save composites
// the strokes onto the original image at full resolution and returns
// a PNG blob via onSave. Pointer-events handle mouse/touch/pen alike.
function PhotoAnnotateModal({ photo, onClose, onSave }) {
  const imgRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [strokes, setStrokes] = React.useState([]); // [[{x,y},...]]
  const [drawing, setDrawing] = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [color, setColor] = React.useState('#dc2626');
  const [thickness, setThickness] = React.useState(4);
  const [saving, setSaving] = React.useState(false);

  // Audit-2026-05-09 H5: Escape-to-close was missing. On phone the canvas
  // sometimes ate tap-to-close events and Key was locked into the modal
  // until he hit the tiny X. Mirrors every other modal in the app.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // Resize canvas to match the displayed image whenever the image loads
  // or the window resizes.
  React.useEffect(() => {
    if (!imgLoaded) return;
    const sync = () => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return;
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [imgLoaded, strokes, color, thickness]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  };

  const xy = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    setDrawing(true);
    const p = xy(e);
    setStrokes(s => [...s, { color, thickness, points: [p] }]);
  };
  const onPointerMove = (e) => {
    if (!drawing) return;
    const p = xy(e);
    setStrokes(s => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      const next = { ...last, points: [...last.points, p] };
      return [...s.slice(0, -1), next];
    });
  };
  const onPointerUp = (e) => {
    setDrawing(false);
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId); } catch {}
  };

  const undo = () => setStrokes(s => s.slice(0, -1));
  const clear = () => setStrokes([]);

  // Save: composite strokes onto the original image at full resolution.
  // Scale stroke coords by (naturalWidth/displayedWidth) so annotations
  // look correct at any export size. Resulting PNG is sent to onSave.
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const img = imgRef.current;
      if (!img) { setSaving(false); return; }
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const dRect = img.getBoundingClientRect();
      const sx = W / dRect.width;
      const sy = H / dRect.height;
      // Use a separate offscreen canvas so we don't pollute the live one.
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const ctx = out.getContext('2d');
      // Draw the original image; if it errored as cross-origin, we'll
      // fall through and just export the strokes on a transparent BG —
      // strokes alone are still useful as an overlay.
      try {
        ctx.drawImage(img, 0, 0, W, H);
      } catch (e) {
        console.warn('[CRM] photo draw failed (likely CORS):', e?.message);
      }
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.thickness * Math.max(sx, sy);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * sx, stroke.points[0].y * sy);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * sx, stroke.points[i].y * sy);
        }
        ctx.stroke();
      }
      out.toBlob(blob => {
        setSaving(false);
        if (!blob) { window.showToast?.('Nothing to save'); return; }
        onSave?.(blob);
      }, 'image/png');
    } catch (e) {
      setSaving(false);
      window.showToast?.('Save failed: ' + (e.message || e));
    }
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(11,31,59,0.85)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'white', borderRadius:12, maxWidth:'90vw', maxHeight:'92vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #EBEBEA' }}>
          <div style={{ fontSize:13, fontWeight:700, color:NAVY }}>Annotate photo</div>
          <button onClick={onClose} style={{ fontSize:14, background:'none', border:'none', color:MUTED, cursor:'pointer' }}>✕</button>
        </div>
        {/* Image + canvas overlay */}
        <div style={{ position:'relative', overflow:'auto', minHeight:0, flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#0b1f3b' }}>
          <img
            ref={imgRef}
            src={photo.url}
            alt=""
            crossOrigin="anonymous"
            onLoad={() => setImgLoaded(true)}
            style={{ maxWidth:'80vw', maxHeight:'70vh', display:'block', userSelect:'none', pointerEvents:'none' }}
          />
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', cursor:'crosshair', touchAction:'none' }}
          />
        </div>
        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderTop:'1px solid #EBEBEA', flexWrap:'wrap' }}>
          {[{c:'#dc2626',l:'Red'},{c:'#facc15',l:'Yellow'},{c:'#0b1f3b',l:'Navy'},{c:'#ffffff',l:'White'}].map(swatch => (
            <button key={swatch.c} onClick={() => setColor(swatch.c)} title={swatch.l}
              style={{
                width:24, height:24, borderRadius:'50%',
                background: swatch.c,
                border: color === swatch.c ? '2px solid #0b1f3b' : '1px solid #EBEBEA',
                cursor:'pointer', flexShrink:0,
              }} />
          ))}
          <span style={{ fontSize:11, color:MUTED, marginLeft:4 }}>Size</span>
          {[2, 4, 8, 14].map(t => (
            <button key={t} onClick={() => setThickness(t)} style={{
              width:28, height:28, borderRadius:6,
              border: thickness === t ? '2px solid #0b1f3b' : '1px solid #EBEBEA',
              background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <span style={{ width:t, height:t, borderRadius:'50%', background: NAVY, display:'block' }} />
            </button>
          ))}
          <div style={{ flex:1 }} />
          <button onClick={undo} disabled={strokes.length === 0} style={{
            padding:'6px 10px', fontSize:12, fontWeight:600, color:NAVY,
            background:'white', border:'1px solid #EBEBEA', borderRadius:6,
            cursor: strokes.length === 0 ? 'not-allowed' : 'pointer', opacity: strokes.length === 0 ? 0.5 : 1,
            fontFamily:'inherit',
          }}>Undo</button>
          <button onClick={clear} disabled={strokes.length === 0} style={{
            padding:'6px 10px', fontSize:12, fontWeight:600, color:'#991B1B',
            background:'white', border:'1px solid #FECACA', borderRadius:6,
            cursor: strokes.length === 0 ? 'not-allowed' : 'pointer', opacity: strokes.length === 0 ? 0.5 : 1,
            fontFamily:'inherit',
          }}>Clear</button>
          <button onClick={save} disabled={saving || strokes.length === 0} style={{
            padding:'6px 14px', fontSize:13, fontWeight:700, color:NAVY,
            background:'#ffba00', border:'none', borderRadius:6,
            cursor: (saving || strokes.length === 0) ? 'not-allowed' : 'pointer', opacity: (saving || strokes.length === 0) ? 0.6 : 1,
            fontFamily:'inherit',
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── NotesWithMarkdownPreview ──────────────────────────────────────────
// Internal notes textarea with a Preview tab showing rendered markdown
// (bold, italic, headings, links, bullets, code). Voice memo button on
// the meta row. Light markdown only — no HTML, no XSS surface; all
// transforms produce plain text + safe React elements.
function NotesWithMarkdownPreview({ note, setNote, noteSaving, noteSaved }) {
  const [mode, setMode] = React.useState('edit'); // 'edit' | 'preview'
  return (
    <InfoSection title="Notes" editAction={null}>
      {/* Tiny tab strip — Edit / Preview */}
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {['edit','preview'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase',
              padding:'4px 10px', borderRadius:6,
              background: mode === m ? NAVY : 'transparent',
              color: mode === m ? 'white' : MUTED,
              border: '1px solid ' + (mode === m ? NAVY : 'rgba(11,31,59,0.12)'),
              cursor:'pointer', fontFamily:'inherit',
            }}
          >{m}</button>
        ))}
      </div>
      {mode === 'edit' ? (
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Internal notes (auto-saves)… Markdown supported."
          style={{ width:'100%',minHeight:68,border:'1.5px solid #EBEBEA',borderRadius:8,background:BG,padding:'10px 12px',fontSize:16,color:NAVY,resize:'vertical',outline:'none',fontFamily:'inherit',lineHeight:1.5,boxSizing:'border-box' }} />
      ) : (
        <div style={{ width:'100%', minHeight:68, border:'1.5px solid #EBEBEA', borderRadius:8, background:'white', padding:'10px 14px', fontSize:14, color:NAVY, lineHeight:1.5, boxSizing:'border-box' }}>
          {note.trim()
            ? <MarkdownRender text={note} />
            : <span style={{ color: MUTED, fontStyle:'italic' }}>(empty)</span>}
        </div>
      )}
      <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ fontSize:11, color:'#999', minHeight:14 }}>
          {noteSaving ? 'Saving…' : noteSaved ? 'Saved' : ' '}
        </div>
        <VoiceMemoButton onTranscript={(text) => {
          const stamp = new Date().toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
          const existing = note ? note + '\n\n' : '';
          setNote(existing + `[Voice ${stamp}] ${text}`);
        }} />
      </div>
    </InfoSection>
  );
}

// Tiny markdown renderer: blocks (headings, bullets, blockquotes,
// fenced code) + inline (bold, italic, code, links). Splits on blank
// lines into blocks; each block rendered as the appropriate element.
// All output is plain text + React elements — no innerHTML, no
// dangerouslySetInnerHTML. Links open in a new tab with rel=noopener.
function MarkdownRender({ text }) {
  const blocks = React.useMemo(() => {
    const out = [];
    const lines = text.split(/\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('```')) {
        const code = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          code.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        out.push({ kind:'code', value: code.join('\n') });
      } else if (/^#{1,3}\s/.test(line)) {
        const m = line.match(/^(#{1,3})\s+(.*)$/);
        out.push({ kind:'heading', level: m[1].length, value: m[2] });
        i++;
      } else if (/^>\s/.test(line)) {
        const quote = [line.replace(/^>\s?/, '')];
        i++;
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push({ kind:'quote', value: quote.join('\n') });
      } else if (/^[-*]\s/.test(line)) {
        const items = [line.replace(/^[-*]\s+/, '')];
        i++;
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^[-*]\s+/, ''));
          i++;
        }
        out.push({ kind:'list', items });
      } else if (line.trim() === '') {
        i++;
      } else {
        const para = [line];
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|>\s|[-*]\s|```)/.test(lines[i])) {
          para.push(lines[i]);
          i++;
        }
        out.push({ kind:'p', value: para.join(' ') });
      }
    }
    return out;
  }, [text]);

  // Inline transform: returns an array of strings + React nodes.
  const renderInline = (s) => {
    if (!s) return null;
    // Order matters: code first (claims its content), then links, then
    // bold, then italic. Each pass walks the array looking for plain
    // strings to split.
    let parts = [s];
    const passes = [
      // inline code
      { re: /`([^`]+)`/g, wrap: (m, _i) => <code key={'c'+_i} style={{ background:'#F0F0EE', padding:'1px 5px', borderRadius:4, fontFamily:"'DM Mono', monospace", fontSize:'90%' }}>{m[1]}</code> },
      // links: [label](url)
      { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, wrap: (m, _i) => <a key={'a'+_i} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: NAVY, textDecoration:'underline' }}>{m[1]}</a> },
      // bold **x**
      { re: /\*\*([^*]+)\*\*/g, wrap: (m, _i) => <strong key={'b'+_i}>{m[1]}</strong> },
      // italic *x*
      { re: /\*([^*]+)\*/g, wrap: (m, _i) => <em key={'i'+_i}>{m[1]}</em> },
    ];
    let counter = 0;
    for (const { re, wrap } of passes) {
      const next = [];
      for (const part of parts) {
        if (typeof part !== 'string') { next.push(part); continue; }
        re.lastIndex = 0;
        let lastIdx = 0;
        let m;
        while ((m = re.exec(part)) !== null) {
          if (m.index > lastIdx) next.push(part.slice(lastIdx, m.index));
          next.push(wrap(m, counter++));
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < part.length) next.push(part.slice(lastIdx));
      }
      parts = next;
    }
    return parts;
  };

  return (
    <div>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          const sz = b.level === 1 ? 18 : b.level === 2 ? 16 : 14;
          return <div key={i} style={{ fontSize:sz, fontWeight:700, color:NAVY, marginTop: i === 0 ? 0 : 8, marginBottom:4 }}>{renderInline(b.value)}</div>;
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} style={{ margin:'4px 0 4px 20px', padding:0, color:NAVY }}>
              {b.items.map((it, j) => <li key={j} style={{ marginBottom:2 }}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        if (b.kind === 'quote') {
          return (
            <div key={i} style={{ borderLeft:'3px solid #EBEBEA', padding:'4px 12px', color:'#555', margin:'6px 0', whiteSpace:'pre-line' }}>
              {renderInline(b.value)}
            </div>
          );
        }
        if (b.kind === 'code') {
          return (
            <pre key={i} style={{ background:'#F0F0EE', padding:'8px 12px', borderRadius:6, fontFamily:"'DM Mono', monospace", fontSize:12, overflowX:'auto', margin:'6px 0' }}>{b.value}</pre>
          );
        }
        return <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', color:NAVY }}>{renderInline(b.value)}</p>;
      })}
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

  // Photo annotation: click the pencil → opens overlay where Key can
  // draw on the photo (red pen, undo, clear). Save uploads the
  // annotated copy as a NEW jobPhoto so the original is preserved.
  const [annotating, setAnnotating] = React.useState(null); // photo object
  const finishAnnotation = async (annotatedBlob) => {
    setAnnotating(null);
    if (!annotatedBlob || !CRM.__db) return;
    setUploading(true);
    try {
      const path = `crm-job-photos/${contact.id}/${Date.now()}-annotated.png`;
      const { error: upErr } = await CRM.__db.storage.from('message-media').upload(path, annotatedBlob, { contentType: 'image/png' });
      if (upErr) throw upErr;
      const { data: pub } = CRM.__db.storage.from('message-media').getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('No public URL');
      const next = [...jobPhotos, { id: 'job-' + Date.now(), url, path, uploaded_at: new Date().toISOString(), annotated: true }];
      setJobPhotos(next);
      window.safeSetItem?.(STORAGE_KEY, JSON.stringify(next));
      window.showToast?.('Annotated photo saved');
    } catch (err) {
      window.showToast?.(`Save failed: ${err.message || 'unknown'}`);
    } finally {
      setUploading(false);
    }
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
              {/* Annotate pencil — top-left so the remove × stays
                  visible in its top-right corner without overlap. */}
              <button onClick={(e) => { e.preventDefault(); setAnnotating(p); }}
                title="Annotate" aria-label="Annotate photo"
                style={{
                  position:'absolute', top:4, left:4, width:20, height:20, borderRadius:'50%',
                  background:'rgba(11,31,59,0.7)', color:'white', border:'none', fontSize:11,
                  cursor:'pointer', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
                }}>✎</button>
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
                  background:'rgba(11,31,59,0.7)', color:'white', fontSize:10, fontWeight:600,
                }}>SMS</span>
              )}
              {p.annotated && (
                <span title="Annotated" style={{
                  position:'absolute', bottom:4, right:4, padding:'1px 5px', borderRadius:4,
                  background:'rgba(220,38,38,0.85)', color:'white', fontSize:10, fontWeight:700,
                }}>✎</span>
              )}
            </div>
          ))}
        </div>
      )}
      {annotating && (
        <PhotoAnnotateModal photo={annotating} onClose={() => setAnnotating(null)} onSave={finishAnnotation} />
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
  // Audit-2026-05-09 a11y M5: wrapping each input in a <label> gives the
  // sibling `<div>` text its proper accessible role, makes tap-on-label
  // focus the input on phones, and lets screen readers announce
  // "Phone, edit text" instead of "edit text, blank".
  const labelStyle = { display:'block', cursor:'text' };
  const labelTextStyle = { fontSize:11, fontWeight:600, color:'#666', letterSpacing:'0.04em', marginBottom:4 };
  return (
    <InfoSection title="Contact info">
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <label style={labelStyle}>
          <div style={labelTextStyle}>Name</div>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder="Full name" autoCapitalize="words" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <div style={labelTextStyle}>Phone</div>
          <input value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <div style={labelTextStyle}>Address</div>
          <AddressAutocomplete value={address} onChange={setAddress} placeholder="123 Main St, Spartanburg" style={inputStyle} />
        </label>
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
            <MapIconBtn onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')} />
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
// Custom labels per-contact. Source of truth = contacts.tags column
// (migration 20260509150000). Synced via the contacts realtime channel.
// localStorage was the previous home; backfill in crm-app.jsx migrates
// any leftover entries and the helper below reads from CRM.contacts so
// every device sees the same labels.
function tagsFor(contactId) {
  const c = (window.CRM?.contacts || []).find(x => x.id === contactId);
  return Array.isArray(c?.tags) ? c.tags : [];
}

function TagsRow({ contactId }) {
  const [tags, setTags] = React.useState(() => tagsFor(contactId));
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => { setTags(tagsFor(contactId)); }, [contactId]);
  React.useEffect(() => {
    const refresh = () => setTags(tagsFor(contactId));
    window.addEventListener('crm-tags-changed', refresh);
    window.addEventListener('crm-data-changed', refresh);
    return () => {
      window.removeEventListener('crm-tags-changed', refresh);
      window.removeEventListener('crm-data-changed', refresh);
    };
  }, [contactId]);

  // Optimistic flip + DB write + revert on error. Same pattern as
  // togglePin / DNC: in-memory mutation first so the chip reflects
  // immediately, then persist.
  const commit = async (next) => {
    const live = (CRM.contacts || []).find(c => c.id === contactId);
    const prev = live?.tags ? [...live.tags] : [];
    if (live) live.tags = [...next];
    setTags(next);
    window.dispatchEvent(new CustomEvent('crm-tags-changed'));
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    if (CRM.__db) {
      const { error } = await CRM.__db.from('contacts')
        .update({ tags: next })
        .eq('id', contactId);
      if (error) {
        if (live) live.tags = prev;
        setTags(prev);
        window.dispatchEvent(new CustomEvent('crm-tags-changed'));
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        window.showToast?.('Tag save failed: ' + error.message);
      }
    }
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
            // Audit-2026-05-09 a11y L2: explicit aria-label so the button's
            // accessible name is "Remove tag VIP" instead of just "VIP".
            // Screen readers couldn't tell that tapping removed the tag.
            <button key={t} onClick={() => removeTag(t)} title="Remove tag" aria-label={`Remove tag ${t}`} style={{
              height:22, padding:'0 8px', borderRadius:11, border:'none', cursor:'pointer',
              background:'#EEF2FF', color:'#3730A3', fontSize:11, fontWeight:600, fontFamily:'inherit',
              display:'inline-flex', alignItems:'center', gap:4,
            }}>{t}<span aria-hidden="true" style={{ opacity:0.5, fontSize:10 }}>✕</span></button>
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

  const pick = async (name) => {
    setOpen(false);
    if (permit.jurisdiction === name) return;
    const prev = { jurisdiction: permit.jurisdiction, jurisdiction_name: permit.jurisdiction_name };
    // Optimistic flip
    permit.jurisdiction = name;
    permit.jurisdiction_name = name;
    bumpData?.();
    // Persist + revert on error. Look up the jurisdiction_id from the
    // existing permit_jurisdictions table by name so the FK stays valid.
    if (!CRM.__db) return;
    let jurisdictionId = null;
    try {
      const { data } = await CRM.__db.from('permit_jurisdictions').select('id').eq('name', name).limit(1);
      if (data?.[0]?.id) jurisdictionId = data[0].id;
    } catch (_) {}
    const { error } = await CRM.__db.from('permits')
      .update({ jurisdiction_name: name, jurisdiction_id: jurisdictionId })
      .eq('id', permit.id);
    if (error) {
      permit.jurisdiction = prev.jurisdiction;
      permit.jurisdiction_name = prev.jurisdiction_name;
      bumpData?.();
      window.showToast?.('Jurisdiction save failed: ' + error.message);
      return;
    }
    permit.jurisdiction_id = jurisdictionId;
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
  // Optimistic + await + revert on error. Persists the new status +
  // any timestamp stamps (submitted_at, approved_at) and the
  // blocker_note when transitioning to/from blocked.
  const advance = async (toStatus, stamps = {}) => {
    const prev = {
      status: permit.status,
      submitted_at: permit.submitted_at,
      approved_at: permit.approved_at,
      blocker_note: permit.blocker_note,
    };
    permit.status = toStatus;
    Object.assign(permit, stamps);
    bumpData?.();
    if (!CRM.__db) return;
    const patch = { status: toStatus, ...stamps };
    const { error } = await CRM.__db.from('permits').update(patch).eq('id', permit.id);
    if (error) {
      Object.assign(permit, prev);
      bumpData?.();
      window.showToast?.('Permit save failed: ' + error.message);
      return;
    }
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
    if (!CRM.__db) {
      window.showToast?.('Supabase not loaded — permit not saved');
      return;
    }
    // Resolve jurisdiction_id from the name so the FK is valid. If the
    // lookup fails we proceed with a null FK rather than blocking — the
    // jurisdiction_name still drives the UI.
    let jurisdictionId = null;
    try {
      const { data: jdata } = await CRM.__db.from('permit_jurisdictions')
        .select('id').eq('name', j).limit(1);
      if (jdata?.[0]?.id) jurisdictionId = jdata[0].id;
    } catch (_) {}
    const { data, error } = await CRM.__db.from('permits').insert({
      contact_id: contact.id,
      jurisdiction_id: jurisdictionId,
      jurisdiction_name: j,
      status: 'not_started',
      permit_number: 'PENDING',
      cost_cents: 0,
    }).select().single();
    if (error) {
      window.showToast?.('Permit save failed: ' + error.message);
      return;
    }
    // Optimistically push the mapped row into local state. Realtime
    // will reconcile from the channel a moment later.
    CRM.permits.push({
      id: data.id,
      contact_id: data.contact_id,
      jurisdiction_id: data.jurisdiction_id || null,
      jurisdiction: data.jurisdiction_name || j,
      jurisdiction_name: data.jurisdiction_name || j,
      permit_number: data.permit_number || 'PENDING',
      status: data.status || 'not_started',
      submitted_at: data.submitted_at || null,
      approved_at: data.approved_at || null,
      cost_cents: data.cost_cents || 0,
      blocker_note: data.blocker_note || null,
    });
    bumpData?.();
    // Advance the contact stage from "Booked" → "Permit submit" since
    // starting a permit IS that transition.
    if (contact.stage === 'booked' && CRM.STAGE_STR_TO_NUM?.permit_submit != null) {
      const previous = contact.stage;
      contact.stage = 'permit_submit';
      bumpData?.();
      try {
        const { error: stageErr } = await CRM.__db.from('contacts')
          .update({ stage: CRM.STAGE_STR_TO_NUM.permit_submit })
          .eq('id', contact.id);
        if (stageErr) {
          contact.stage = previous;
          bumpData?.();
          window.showToast?.(`Permit added — stage save failed: ${stageErr.message}`);
          return;
        }
      } catch (e) {
        contact.stage = previous;
        bumpData?.();
      }
    }
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

  const advance = async () => {
    if (!next) return;
    if (!CRM.__db) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    if (isPlaceholder) {
      // First advance on a permanent row (inlet/interlock/cord) → INSERT.
      const stamps = {
        ordered_at: next.stamp === 'ordered_at' ? TODAY : null,
        received_at: next.stamp === 'received_at' ? TODAY : null,
        installed_at: next.stamp === 'installed_at' ? TODAY : null,
      };
      const { data, error } = await CRM.__db.from('materials').insert({
        contact_id: contact.id,
        kind: mat.kind,
        status: next.next,
        ...stamps,
      }).select().single();
      if (error) {
        window.showToast?.(`${MAT_KIND_LABEL(mat.kind)} save failed: ${error.message}`);
        return;
      }
      CRM.materials.push({
        id: data.id,
        contact_id: data.contact_id,
        kind: data.kind,
        status: data.status,
        ordered_at: data.ordered_at,
        received_at: data.received_at,
        installed_at: data.installed_at,
      });
      bumpData?.();
      window.showToast?.(`${MAT_KIND_LABEL(mat.kind)}: ${next.label.toLowerCase()}`);
      return;
    }
    // UPDATE path for an existing row. Optimistic + revert on error.
    const prev = { status: mat.status, [next.stamp]: mat[next.stamp] };
    mat.status = next.next;
    mat[next.stamp] = TODAY;
    bumpData?.();
    const { error } = await CRM.__db.from('materials')
      .update({ status: next.next, [next.stamp]: TODAY })
      .eq('id', mat.id);
    if (error) {
      mat.status = prev.status;
      mat[next.stamp] = prev[next.stamp];
      bumpData?.();
      window.showToast?.(`${MAT_KIND_LABEL(mat.kind)} save failed: ${error.message}`);
      return;
    }
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)}: ${next.label.toLowerCase()}`);
  };

  // Reset back to "Not ordered" — the only escape hatch from an
  // accidental "Mark installed". Wipes the date stamps.
  const reset = async () => {
    if (isPlaceholder) return;
    if (!CRM.__db) return;
    const prev = {
      status: mat.status,
      ordered_at: mat.ordered_at,
      received_at: mat.received_at,
      installed_at: mat.installed_at,
    };
    mat.status = 'not_ordered';
    mat.ordered_at = null;
    mat.received_at = null;
    mat.installed_at = null;
    bumpData?.();
    const { error } = await CRM.__db.from('materials')
      .update({ status: 'not_ordered', ordered_at: null, received_at: null, installed_at: null })
      .eq('id', mat.id);
    if (error) {
      Object.assign(mat, prev);
      bumpData?.();
      window.showToast?.(`Reset failed: ${error.message}`);
      return;
    }
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)}: reset`);
  };

  // Delete an ad-hoc extra (not the 3 permanent kinds: inlet,
  // interlock, cord — those always render as part of the install).
  const PERMANENT = new Set(['inlet','interlock','cord']);
  const canDelete = !isPlaceholder && !PERMANENT.has(mat.kind);
  const remove = async () => {
    if (!canDelete) return;
    if (!CRM.__db) return;
    // Snapshot before delete so undo can re-insert
    const snap = { ...mat };
    const i = (CRM.materials || []).findIndex(m => m.id === mat.id);
    if (i >= 0) CRM.materials.splice(i, 1);
    bumpData?.();
    const { error } = await CRM.__db.from('materials').delete().eq('id', mat.id);
    if (error) {
      // Re-insert into local array on persist failure
      if (i >= 0) CRM.materials.splice(i, 0, snap);
      bumpData?.();
      window.showToast?.(`Remove failed: ${error.message}`);
      return;
    }
    window.showToast?.(`${MAT_KIND_LABEL(mat.kind)} removed`, {
      undo: async () => {
        const { id, created_at, updated_at, ...rest } = snap;
        const { data, error: e2 } = await CRM.__db.from('materials').insert(rest).select().single();
        if (e2) {
          window.showToast?.(`Undo failed: ${e2.message}`);
          return;
        }
        CRM.materials.push({
          id: data.id,
          contact_id: data.contact_id,
          kind: data.kind,
          status: data.status,
          ordered_at: data.ordered_at,
          received_at: data.received_at,
          installed_at: data.installed_at,
        });
        bumpData?.();
      },
      duration: 5000,
    });
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

  const addExtra = async (kind) => {
    setShowAddPicker(false);
    if (!CRM.__db) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    const { data, error } = await CRM.__db.from('materials').insert({
      contact_id: contact.id,
      kind,
      status: 'not_ordered',
    }).select().single();
    if (error) {
      window.showToast?.(`Add ${MAT_KIND_LABEL(kind)} failed: ${error.message}`);
      return;
    }
    CRM.materials.push({
      id: data.id,
      contact_id: data.contact_id,
      kind: data.kind,
      status: data.status,
      ordered_at: data.ordered_at,
      received_at: data.received_at,
      installed_at: data.installed_at,
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
        <UpcomingEventCard
          event={upcoming}
          subtitle={subtitle(upcoming)}
          fmtRow={fmtRow}
          bumpData={bumpData}
        />
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

// ── UpcomingEventCard ─────────────────────────────────────────────────
// Hosts the next-up event row + quick reschedule controls. Click the
// time to expand inline date/time pickers. Save shifts the event and
// fires a toast with Undo. Avoids the "open a modal to move a meeting"
// friction — most reschedules are 1 day or 1 hour off.
function UpcomingEventCard({ event, subtitle, fmtRow, bumpData }) {
  const [editing, setEditing] = React.useState(false);
  // Seed pickers from event.start_at in LOCAL time so the date+time
  // round-trip cleanly through `<input type=date|time>`.
  const initial = React.useMemo(() => {
    const d = new Date(event.start_at);
    const pad = n => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }, [event.start_at, event.id]);
  const [date, setDate] = React.useState(initial.date);
  const [time, setTime] = React.useState(initial.time);
  React.useEffect(() => { setDate(initial.date); setTime(initial.time); }, [initial.date, initial.time]);

  // Audit-2026-05-09 H4: rapid +1d / +1d clicks shared the same `event`
  // reference; the second click read event.start_at AFTER the first
  // mutation, the first DB write hadn't landed, both updates collided,
  // and the undo reverted to the post-click-1 state instead of the true
  // original. busyRef serializes; origRef captures the true pre-shift
  // value once per UI session and re-resets after the toast window. On
  // DB failure we revert in memory + alert.
  const busyRef = React.useRef(false);
  const origRef = React.useRef(null);
  const shiftBy = async (ms) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (origRef.current === null) origRef.current = event.start_at;
    const trueOrig = origRef.current;
    const fromAt = event.start_at;
    const newStart = new Date(new Date(fromAt).getTime() + ms).toISOString();
    const prevEnd = event.end_at;
    event.start_at = newStart;
    if (prevEnd) {
      const dur = new Date(prevEnd).getTime() - new Date(fromAt).getTime();
      event.end_at = new Date(new Date(newStart).getTime() + dur).toISOString();
    }
    bumpData?.();
    let dbErr = null;
    if (CRM.__db) {
      const patch = { start_at: newStart };
      if (event.end_at) patch.end_at = event.end_at;
      const { error } = await CRM.__db.from('calendar_events').update(patch).eq('id', event.id);
      dbErr = error;
    }
    busyRef.current = false;
    if (dbErr) {
      // Revert in-memory mutation; the DB write didn't land.
      event.start_at = fromAt;
      if (prevEnd) event.end_at = prevEnd;
      bumpData?.();
      window.showToast?.(`Reschedule failed: ${dbErr.message}`, { kind:'error', duration: 4000 });
      return;
    }
    // Reset origRef after the undo window (5s) so the next "session" of
    // shifts starts fresh. Prevents undo from reaching back two sessions.
    setTimeout(() => { origRef.current = null; }, 5200);
    window.showToast?.('Rescheduled to ' + new Date(newStart).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }), {
      undo: async () => {
        event.start_at = trueOrig;
        if (prevEnd) event.end_at = prevEnd;
        origRef.current = null;
        bumpData?.();
        if (CRM.__db) {
          const patch = { start_at: trueOrig };
          if (prevEnd) patch.end_at = prevEnd;
          await CRM.__db.from('calendar_events').update(patch).eq('id', event.id);
        }
      },
      duration: 5000,
    });
  };

  const saveCustom = async () => {
    if (!date || !time) { window.showToast?.('Pick date and time'); return; }
    const newStart = new Date(`${date}T${time}:00`);
    if (isNaN(newStart.getTime())) { window.showToast?.('Invalid date'); return; }
    const ms = newStart.getTime() - new Date(event.start_at).getTime();
    if (ms === 0) { setEditing(false); return; }
    setEditing(false);
    await shiftBy(ms);
  };

  const quickBtn = (label, ms) => (
    <button
      onClick={() => shiftBy(ms)}
      style={{
        padding:'4px 8px', fontSize:11, fontWeight:600, color: NAVY,
        background:'#F0F4FF', border:'1px solid rgba(11,31,59,0.08)',
        borderRadius:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
      }}
    >{label}</button>
  );

  return (
    <div style={{
      background:'white', borderRadius:8, marginBottom:10,
      borderLeft:'3px solid #ffba00',
      border:'1px solid rgba(11,31,59,0.08)',
      borderLeftWidth:3, borderLeftColor:'#ffba00',
      padding:'12px 14px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:NAVY }}>{event.title}</div>
          <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{subtitle}</div>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          title="Reschedule"
          style={{
            fontSize:12, color:NAVY, fontFamily:"'DM Mono', monospace",
            whiteSpace:'nowrap', flexShrink:0,
            background:'none', border:'1px solid rgba(11,31,59,0.08)',
            padding:'4px 8px', borderRadius:6, cursor:'pointer',
          }}
        >{fmtRow(event.start_at)}</button>
      </div>
      {editing ? (
        <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize:12, padding:'5px 8px', border:'1px solid #EBEBEA', borderRadius:6, fontFamily:'inherit' }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ fontSize:12, padding:'5px 8px', border:'1px solid #EBEBEA', borderRadius:6, fontFamily:'inherit' }} />
          <button onClick={saveCustom} style={{ padding:'5px 12px', fontSize:12, fontWeight:700, color:NAVY, background:GOLD, border:'none', borderRadius:6, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ padding:'5px 10px', fontSize:12, color:'#666', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
      ) : (
        <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
          {quickBtn('+1 hr', 3600 * 1000)}
          {quickBtn('+1 day', 86400 * 1000)}
          {quickBtn('+2 days', 2 * 86400 * 1000)}
          {quickBtn('+1 week', 7 * 86400 * 1000)}
          <button
            onClick={() => setEditing(true)}
            style={{
              padding:'4px 8px', fontSize:11, fontWeight:600, color: NAVY,
              background:'white', border:'1px dashed rgba(11,31,59,0.25)',
              borderRadius:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
            }}
          >Custom…</button>
          {/* Cancel — soft-delete via status='cancelled'. Confirms first
              because losing an install slot is high-cost and Key would
              hate a stray click wiping a confirmed booking. */}
          <button
            onClick={async () => {
              const ok = await window.confirmAction?.({
                title: 'Cancel this ' + (event.kind || 'event') + '?',
                body: 'Removes it from the schedule. Use Undo within 5 seconds if it was a mistake.',
                confirmLabel: 'Cancel event',
                destructive: true,
              });
              if (!ok) return;
              const prev = event.status;
              event.status = 'cancelled';
              bumpData?.();
              if (CRM.__db) {
                const { error } = await CRM.__db.from('calendar_events').update({ status: 'cancelled' }).eq('id', event.id);
                if (error) {
                  event.status = prev;
                  bumpData?.();
                  window.showToast?.('Cancel failed: ' + error.message);
                  return;
                }
              }
              window.showToast?.('Event cancelled', {
                undo: async () => {
                  event.status = prev;
                  bumpData?.();
                  if (CRM.__db) await CRM.__db.from('calendar_events').update({ status: prev }).eq('id', event.id);
                },
                duration: 5000,
              });
            }}
            style={{
              padding:'4px 10px', fontSize:11, fontWeight:600, color:'#dc2626',
              background:'white', border:'1px solid rgba(220,38,38,0.3)',
              borderRadius:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
              marginLeft:'auto',
            }}
          >Cancel event</button>
        </div>
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
  // V3: edit-mode targets (id only — we look up the row at render time so
  // realtime updates flow through automatically).
  const [editingProposalId, setEditingProposalId] = React.useState(null);
  const [editingInvoiceId,  setEditingInvoiceId]  = React.useState(null);
  // If the row being edited disappears (deleted via realtime), close the
  // modal — but do it in an effect, not during render. setState during
  // render triggers a re-render warning and can briefly thrash.
  React.useEffect(() => {
    if (editingProposalId && !(CRM.proposals || []).some(p => p.id === editingProposalId)) {
      setEditingProposalId(null);
    }
  }, [editingProposalId, proposals]);
  React.useEffect(() => {
    if (editingInvoiceId && !(CRM.invoices || []).some(i => i.id === editingInvoiceId)) {
      setEditingInvoiceId(null);
    }
  }, [editingInvoiceId, invoices]);

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
        // Reverting the cancel — drop the auto-re-engagement todo we
        // queued below so it doesn't fire after Key un-cancelled.
        try {
          await CRM.__db.from('bpp_todos').delete()
            .eq('related_contact_id', prop.contact_id)
            .eq('source', 'auto_cancel_reengage')
            .eq('completed', false);
        } catch (_) { /* best-effort */ }
      },
      duration: 5000,
    });
    // Queue an auto re-engagement todo for +14d. Cancelled proposals
    // aren't dead — silent prospects often warm back if checked at
    // the 2-week mark (BPP follow-up framework). Stored with
    // source='auto_cancel_reengage' so the undo path can roll it back
    // and so future analytics can measure conversion-from-cancel.
    if (!contact?.do_not_contact && CRM.__db) {
      const firstName = ((contact?.name || '').trim().split(/\s+/)[0] || 'them');
      CRM.__db.from('bpp_todos').insert([{
        title: `Re-check ${firstName}: cancelled quote, 14-day touch`,
        notes: `Quote was cancelled ${new Date().toLocaleDateString()}. Reach out at the 2-week mark — silent prospects often circle back if you check in.`,
        source: 'auto_cancel_reengage',
        priority: 2,
        related_contact_id: prop.contact_id,
        completed: false,
        generated_for_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10),
      }]).then(({ error }) => {
        if (error) console.warn('[CRM] auto-reengage queue failed (non-fatal):', error.message);
      });
    }
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

  // V3: bring a cancelled proposal back to life. The 5-second undo on
  // cancelProposal handles same-tab mistakes; Revive handles "I cancelled
  // this last week and now I want to follow up after all" — a real case
  // when a customer goes silent and then circles back.
  const reviveProposal = async (prop) => {
    if (!CRM.__db) return;
    if (markingRef.current.has('revive:'+prop.id)) return;
    markingRef.current.add('revive:'+prop.id);
    const live = (CRM.proposals || []).find(x => x.id === prop.id) || prop;
    const prev = live.status;
    live.status = 'sent';
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    // Server-side status guard: only revive rows actually in a cancelled
    // state. Prevents a stale tab or direct API call from flipping a
    // paid/approved proposal back to Sent. Mirrors the lock cancelProposal
    // already implements via `prev` / rollback, but enforced server-side.
    const { error } = await CRM.__db.from('proposals')
      .update({ status: 'Sent' })
      .eq('id', prop.id)
      .in('status', ['declined', 'cancelled', 'expired', 'Cancelled', 'Declined', 'Expired']);
    markingRef.current.delete('revive:'+prop.id);
    if (error) {
      live.status = prev;
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(`Revive failed: ${error.message}`);
      return;
    }
    window.showToast?.('Proposal revived');
  };
  const reviveInvoice = async (inv) => {
    if (!CRM.__db) return;
    if (markingRef.current.has('revive:'+inv.id)) return;
    markingRef.current.add('revive:'+inv.id);
    const live = (CRM.invoices || []).find(x => x.id === inv.id) || inv;
    const prev = live.status;
    live.status = 'sent';
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    const { error } = await CRM.__db.from('invoices')
      .update({ status: 'unpaid' })
      .eq('id', inv.id)
      .in('status', ['voided', 'refunded', 'Voided', 'Refunded']);
    markingRef.current.delete('revive:'+inv.id);
    if (error) {
      live.status = prev;
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(`Revive failed: ${error.message}`);
      return;
    }
    window.showToast?.('Invoice revived');
  };

  // V3: hard delete (distinct from cancel/void which is reversible). Used
  // for proposals/invoices Key created by mistake or wants gone entirely.
  const deleteProposal = async (prop) => {
    if (!CRM.__db) return;
    const ok = await window.confirmAction?.({
      title: 'Delete this proposal?',
      body: 'This permanently removes the proposal and breaks the customer link. Cannot be undone. Use Cancel instead if you might need it back.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (!ok) return;
    // The proposals table has a self-referential FK (superseded_by) created by
    // the auto-supersede trigger when a newer proposal lands for the same
    // contact. Postgres rejects deletes that leave dangling references, so
    // we clear the FK on any rows pointing at us BEFORE deleting. SET NULL
    // matches the auto-supersede semantics — the old proposal is just no
    // longer marked as superseded by anything.
    await CRM.__db.from('proposals').update({ superseded_by: null }).eq('superseded_by', prop.id);
    // Same treatment for invoices that point at this proposal: keep the
    // invoice (it may have been sent / paid) but detach the link.
    await CRM.__db.from('invoices').update({ proposal_id: null }).eq('proposal_id', prop.id);
    const { error } = await CRM.__db.from('proposals').delete().eq('id', prop.id);
    if (error) { window.showToast?.(`Delete failed: ${error.message}`); return; }
    const arr = CRM.proposals || [];
    const idx = arr.findIndex(x => x.id === prop.id);
    if (idx >= 0) arr.splice(idx, 1);
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    window.showToast?.('Proposal deleted');
  };
  const deleteInvoice = async (inv) => {
    if (!CRM.__db) return;
    const ok = await window.confirmAction?.({
      title: 'Delete this invoice?',
      body: 'This permanently removes the invoice and breaks the customer link. Cannot be undone. Use Void instead if you might need it back.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (!ok) return;
    const { error } = await CRM.__db.from('invoices').delete().eq('id', inv.id);
    if (error) { window.showToast?.(`Delete failed: ${error.message}`); return; }
    const arr = CRM.invoices || [];
    const idx = arr.findIndex(x => x.id === inv.id);
    if (idx >= 0) arr.splice(idx, 1);
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    window.showToast?.('Invoice deleted');
  };
  // V3: email send via the send-email edge function with the proposal/invoice
  // template. Confirms before firing because email is more permanent than SMS.
  // The function REQUIRES `subject` (validated server-side) and a brain-token
  // header — otherwise it 401s or 400s with a generic non-2xx wrapper.
  // Subject is templated per template type; brain-token wiring is tracked
  // as a follow-up (function returns 401 without it today).
  const emailDoc = async ({ template, contact_id, proposal, invoice }) => {
    if (!contact?.email) { window.showToast?.('No email on contact — add one first'); return; }
    const ok = await window.confirmAction?.({
      title: `Email ${template} to ${contact.email}?`,
      body: 'This sends the formatted email via Resend. Same content as the customer page.',
      confirmLabel: 'Send email',
    });
    if (!ok) return;
    const url = proposal ? proposalUrl(proposal) : (invoice ? invoiceUrl(invoice) : null);
    const total = (proposal?.amount_cents || invoice?.amount_cents || 0) / 100;
    const firstName = (contact.name || '').trim().split(/\s+/)[0] || 'there';
    // Subjects mirror the email templates so the inbox preview reads
    // naturally — Key's voice, customer's first name, no corporate fluff.
    const SUBJECTS = {
      proposal:    `Your generator inlet quote — Backup Power Pro`,
      invoice:     `Invoice from Backup Power Pro`,
      'permit-approved': `Permit approved — install scheduling next`,
      completion:  `You're all set — backup power confirmed`,
      review:      `Quick favor — Google review for Backup Power Pro?`,
    };
    const subject = SUBJECTS[template] || `Update from Backup Power Pro for ${firstName}`;
    const { data, error } = await CRM.__invokeFn('send-email', {
      body: {
        template,
        contact_id,
        subject,
        variables: {
          [`${template}_url`]: url,
          total: '$' + total.toLocaleString(),
          amp_type: proposal?.amp_type || '30',
          first_name: firstName,
        },
        trigger_source: 'crm_v3_finance_action',
      },
    });
    if (error) {
      // Surface the real error body — supabase-js wraps non-2xx as a
      // generic "Edge Function returned a non-2xx status code" otherwise.
      let detail = error.message || 'unknown';
      try {
        const body = await error.context?.json?.();
        if (body?.error) detail = body.error + (body.need ? ` (needs: ${(body.need || []).join(', ')})` : '');
      } catch (_) {}
      window.showToast?.(`Email failed: ${detail}`);
      return;
    }
    if (data?.skipped) {
      window.showToast?.(`Skipped: ${data.skipped}`);
      return;
    }
    window.showToast?.(`Email sent to ${contact.email}`);
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
      // Promote draft → sent status. Pulled from linkKind: token in URL
      // matches the row's token, so we can flip the right one server-side.
      // Only promote if currently in a draft-equivalent state — never
      // downgrade approved/paid/etc.
      try {
        const tokenMatch = linkUrl.match(/[?&]token=([0-9a-f-]{8,})/i);
        const token = tokenMatch?.[1];
        if (token && CRM.__db) {
          if (linkKind === 'prop') {
            await CRM.__db.from('proposals')
              .update({ status: 'Sent', copied_at: new Date().toISOString() })
              .eq('token', token)
              .in('status', ['Created', 'Draft', 'draft']);
          } else if (linkKind === 'inv') {
            await CRM.__db.from('invoices')
              .update({ status: 'unpaid', sent_at: new Date().toISOString() })
              .eq('token', token)
              .in('status', ['draft', 'Draft']);
          }
          window.dispatchEvent(new CustomEvent('crm-data-changed'));
        }
      } catch (_) { /* status flip best-effort; the SMS already sent */ }
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

  const FinanceRow = ({ left, money, status, activity, linkUrl, onMarkPaid, onCancel, onVoid, onEdit, onDelete, onEmail, onRevive, divided }) => {
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
      // FinanceRow is always rendered inside DealCard which already provides
      // the white bg + border + radius. Wrapping it in another bordered card
      // produced a "double chin" effect at the bottom where the inner card's
      // padding stacked on the outer card's. Strip the inner box; rely on
      // DealCard for the visual boundary, separate stacked rows (proposal +
      // invoices) with a hairline top divider via the `divided` prop.
      <div style={{
        padding:'12px 14px',
        borderTop: divided ? '1px solid rgba(11,31,59,0.06)' : 'none',
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
        {/* Secondary actions row — Edit / Email / Mark paid + destructive
            (Cancel/Void/Delete). Ghost styling so they don't compete with
            the gold Send CTA. */}
        {(onMarkPaid || onCancel || onVoid || onEdit || onDelete || onEmail || onRevive) && (
          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
            {onRevive && (
              <button onClick={onRevive} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:'#16a34a',
                border:'1px solid rgba(22,163,74,0.35)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Revive</button>
            )}
            {onEdit && (
              <button onClick={onEdit} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:NAVY,
                border:'1px solid rgba(11,31,59,0.20)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Edit</button>
            )}
            {onEmail && (
              <button onClick={onEmail} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:NAVY,
                border:'1px solid rgba(11,31,59,0.20)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Email</button>
            )}
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
            {onDelete && (
              <button onClick={onDelete} style={{
                minHeight:40, padding:'0 14px', borderRadius:8,
                background:'transparent', color:'#991B1B',
                border:'1px solid rgba(153,27,27,0.25)',
                fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              }}>Delete</button>
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
            onRevive={['declined','cancelled','expired'].includes(proposal.status) ? () => reviveProposal(proposal) : null}
            onEdit={['draft','sent','viewed'].includes(proposal.status) ? () => { setProposalModalOpen(false); setEditingProposalId(proposal.id); } : null}
            onDelete={['draft','sent','viewed','declined','cancelled','expired'].includes(proposal.status) ? () => deleteProposal(proposal) : null}
            onEmail={contact?.email && ['sent','viewed','draft'].includes(proposal.status) ? () => emailDoc({ template:'proposal', contact_id: contact.id, proposal }) : null}
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

        {invoices.length > 0 && invoices.map(inv => (
          <FinanceRow
            key={inv.id}
            left={capitalize(inv.kind)}
            money={formatMoneyCents(inv.amount_cents)}
            status={inv.status}
            activity={invActivity(inv)}
            linkUrl={invoiceUrl(inv)}
            divided
            onMarkPaid={['sent','viewed','overdue'].includes(inv.status) ? () => markPaid(inv) : null}
            onVoid={['sent','viewed','overdue'].includes(inv.status) ? () => voidInvoice(inv) : null}
            onRevive={['voided','refunded'].includes(inv.status) ? () => reviveInvoice(inv) : null}
            onEdit={['draft','sent','viewed','overdue'].includes(inv.status) ? () => { setInvoiceModalOpen(false); setEditingInvoiceId(inv.id); } : null}
            onDelete={['draft','sent','viewed','overdue','voided','refunded'].includes(inv.status) ? () => deleteInvoice(inv) : null}
            onEmail={contact?.email && ['sent','viewed','draft','overdue'].includes(inv.status) ? () => emailDoc({ template:'invoice', contact_id: contact.id, invoice: inv }) : null}
          />
        ))}
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

      {/* Edit modals — mounted at this level so they overlay the deal list.
          Cleanup of editingProposalId/editingInvoiceId when the underlying
          row disappears (deleted by realtime mid-edit) lives in a useEffect
          below — calling setState during render warns and re-renders. */}
      {editingProposalId && (() => {
        const ep = (CRM.proposals || []).find(p => p.id === editingProposalId);
        if (!ep) return null;
        return (
          <NewProposalModal
            contact={contact}
            editingProposal={ep}
            onClose={() => setEditingProposalId(null)}
          />
        );
      })()}
      {editingInvoiceId && (() => {
        const ei = (CRM.invoices || []).find(i => i.id === editingInvoiceId);
        if (!ei) return null;
        return (
          <NewInvoiceModal
            contact={contact}
            latestSignedProposal={proposals.find(p => p.id === ei.proposal_id) || null}
            invoices={invoices}
            editingInvoice={ei}
            onClose={() => setEditingInvoiceId(null)}
          />
        );
      })()}

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

// ── StarredExamplesManager ──────────────────────────────────────────
// Lists every row in reply_suggestion_stars with body + created_at +
// contact name. Each row has an unstar (delete) action with confirm.
// Without this, a typo'd star permanently weights future suggest-reply
// calls — there was no escape hatch from the CRM until 2026-05-09.
function StarredExamplesManager({ onClose }) {
  const [rows, setRows] = React.useState(null); // null = loading, [] = empty, [...] = loaded
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!CRM.__db) { setErr('Supabase not loaded'); return; }
    setErr('');
    const { data, error } = await CRM.__db
      .from('reply_suggestion_stars')
      .select('id, body, contact_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setErr('Load failed: ' + error.message);
      setRows([]);
      return;
    }
    setRows(data || []);
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  // ESC closes
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lookupContactName = (cid) => {
    const c = (CRM.contacts || []).find(x => x.id === cid);
    if (!c) return '—';
    return contactName(c) || (c.phone || c.id || '').slice(0, 12);
  };

  const remove = async (row) => {
    const ok = await window.confirmAction?.({
      title: 'Unstar this example?',
      body: `It will no longer weight future reply suggestions:\n\n"${row.body}"`,
      confirmLabel: 'Unstar',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const snap = { ...row };
    setRows(prev => (prev || []).filter(r => r.id !== row.id));
    const { error } = await CRM.__db.from('reply_suggestion_stars').delete().eq('id', row.id);
    setBusy(false);
    if (error) {
      setRows(prev => [snap, ...(prev || [])]);
      window.showToast?.('Unstar failed: ' + error.message);
      return;
    }
    window.showToast?.('Unstarred', {
      undo: async () => {
        const { id, created_at, ...rest } = snap;
        const { data, error: e2 } = await CRM.__db
          .from('reply_suggestion_stars')
          .insert(rest)
          .select()
          .single();
        if (e2) {
          window.showToast?.('Undo failed: ' + e2.message);
          return;
        }
        setRows(prev => [data, ...(prev || [])]);
      },
      duration: 5000,
    });
  };

  const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(11,31,59,0.45)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'white', borderRadius:12, width:'100%', maxWidth:560, maxHeight:'88vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
        border:'1px solid rgba(11,31,59,0.12)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #EBEBEA' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:NAVY }}>Starred reply examples</div>
            <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>These shape how the AI suggests replies in your voice.</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            fontSize:18, background:'none', border:'none', color:MUTED, cursor:'pointer', lineHeight:1, padding:4,
          }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {rows == null && (
            <div style={{ padding:'24px 16px', textAlign:'center', fontSize:13, color:MUTED }}>Loading…</div>
          )}
          {err && (
            <div style={{ padding:'12px 18px', fontSize:12, color:'#991B1B', background:'#FEF2F2' }}>{err}</div>
          )}
          {Array.isArray(rows) && rows.length === 0 && !err && (
            <div style={{ padding:'40px 24px', textAlign:'center' }}>
              <div style={{ fontSize:13, color:NAVY, fontWeight:600, marginBottom:6 }}>No starred examples yet</div>
              <div style={{ fontSize:12, color:MUTED, lineHeight:1.5 }}>
                Tap the star next to a Suggest result to save it as a high-weight example. Your AI suggestions will sound more like you over time.
              </div>
            </div>
          )}
          {Array.isArray(rows) && rows.map(r => (
            <div key={r.id} style={{
              display:'flex', alignItems:'flex-start', gap:10,
              padding:'12px 18px',
              borderBottom:'1px solid #F5F5F3',
            }}>
              <span style={{
                width:20, height:20, borderRadius:'50%',
                background:'#FEF3C7', color:'#92400E',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
              }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:NAVY, lineHeight:1.45, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{r.body}</div>
                <div style={{ fontSize:11, color:MUTED, marginTop:4, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span>{fmtWhen(r.created_at)}</span>
                  {r.contact_id && <span>· {lookupContactName(r.contact_id)}</span>}
                </div>
              </div>
              <button
                onClick={() => remove(r)}
                disabled={busy}
                title="Unstar (delete)"
                aria-label="Unstar"
                style={{
                  width:28, height:28, borderRadius:6, flexShrink:0,
                  background:'transparent', color:'#dc2626',
                  border:'1px solid rgba(220,38,38,0.22)', cursor: busy ? 'wait' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding:'10px 18px', borderTop:'1px solid #EBEBEA', fontSize:11, color:MUTED, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>{Array.isArray(rows) ? `${rows.length} starred` : ''}</span>
          <button onClick={refresh} style={{
            fontSize:11, fontWeight:600, color:NAVY, background:'none',
            border:'1px solid rgba(11,31,59,0.12)', borderRadius:6,
            padding:'4px 10px', cursor:'pointer', fontFamily:'inherit',
          }}>Refresh</button>
        </div>
      </div>
    </div>
  );
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
            <textarea value={t} onChange={e => setList(l => l.map((x,j) => j===i ? e.target.value : x))} rows={2} style={{
              flex:1, padding:'8px 10px', border:'1px solid rgba(11,31,59,0.15)', borderRadius:6, fontSize:13, color:NAVY, fontFamily:'inherit', resize:'vertical',
            }} />
            <button onClick={() => setList(l => l.filter((_,j) => j !== i))} aria-label="Delete template" style={{
              // Audit-2026-05-09 a11y M4: 32×32 → 44×44 to meet WCAG 2.5.5
              // / iOS HIG tap-target floor. Visual ✕ stays the same size.
              width:44, height:44, borderRadius:6, background:'#FEE2E2', color:'#991B1B', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="New template…" style={{
          flex:1, height:36, borderRadius:6, border:'1px solid rgba(11,31,59,0.15)', padding:'0 10px', fontSize:14, color:NAVY, fontFamily:'inherit',
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

// ── ScheduledMessagesStrip ────────────────────────────────────────────
// Shows queued scheduled messages for the active contact above the
// compose bar. Each row shows the body preview + "in 2h" + cancel.
// Subscribes to crm-scheduled-msg-changed so toggles update without a
// full re-render.
function ScheduledMessagesStrip({ contactId }) {
  const [queue, setQueue] = React.useState(() => window.readSchedQueue?.() || []);
  React.useEffect(() => {
    const refresh = () => setQueue(window.readSchedQueue?.() || []);
    window.addEventListener('crm-scheduled-msg-changed', refresh);
    window.addEventListener('storage', refresh);
    // Refresh every 30s so "in 1h" countdowns stay fresh.
    const tick = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener('crm-scheduled-msg-changed', refresh);
      window.removeEventListener('storage', refresh);
      clearInterval(tick);
    };
  }, []);
  const mine = queue.filter(m => m.contactId === contactId).sort((a, b) => new Date(a.at) - new Date(b.at));
  if (mine.length === 0) return null;

  const niceTime = (iso) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < 0) return 'sending now…';
    if (ms < 3600 * 1000) return `in ${Math.max(1, Math.round(ms / 60000))} min`;
    if (ms < 86400 * 1000) return `in ${Math.round(ms / 3600000)} hr`;
    return new Date(iso).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  };

  return (
    <div style={{ margin:'8px 16px 0', display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
      {mine.map(m => (
        <div key={m.id} style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'8px 10px',
          background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8,
          fontSize:12, color:'#1E40AF',
        }}>
          <span style={{ fontSize:13 }}>⏰</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700 }}>Scheduled · {niceTime(m.at)}</div>
            <div style={{ color:'#1E3A8A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{m.body || '(media-only)'}</div>
          </div>
          <button
            onClick={() => {
              window.cancelScheduledMessage?.(m.id);
              window.showToast?.('Scheduled message cancelled');
            }}
            style={{
              fontSize:11, fontWeight:700, color:'#991B1B',
              background:'white', border:'1px solid #FECACA', borderRadius:6,
              padding:'4px 8px', cursor:'pointer', fontFamily:'inherit',
            }}
          >Cancel</button>
        </div>
      ))}
    </div>
  );
}

// ── SendButton (split: send now / schedule later) ─────────────────────
// Default tap = send now. Tap the chevron to open the schedule menu
// with presets (1hr, tomorrow 9am, tomorrow 7pm) + a Custom datetime
// picker. Survives reload via the localStorage queue + 60s poller in
// crm-shared.jsx.
function SendButton({ onSend, onSchedule }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const tomorrowAt = (hour, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

  const presets = [
    { label:'In 1 hour',         at: inHours(1) },
    { label:'In 4 hours',        at: inHours(4) },
    { label:'Tomorrow 9 AM',     at: tomorrowAt(9, 0) },
    { label:'Tomorrow 7 PM',     at: tomorrowAt(19, 0) },
  ];

  const customSchedule = () => {
    const def = new Date(Date.now() + 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    const defaultLocal = `${def.getFullYear()}-${pad(def.getMonth()+1)}-${pad(def.getDate())} ${pad(def.getHours())}:${pad(def.getMinutes())}`;
    const v = window.prompt('Send at (YYYY-MM-DD HH:MM, 24-hour):', defaultLocal);
    if (!v) return;
    const cleaned = v.trim().replace(' ', 'T') + ':00';
    const at = new Date(cleaned);
    if (isNaN(at.getTime()) || at.getTime() < Date.now()) {
      window.showToast?.('Pick a future date+time');
      return;
    }
    setMenuOpen(false);
    onSchedule?.(at.toISOString());
  };

  return (
    <div ref={wrapRef} style={{ position:'relative', display:'flex', flexShrink:0 }}>
      <button
        onClick={onSend}
        aria-label="Send"
        style={{
          width:36, height:36,
          borderTopLeftRadius:8, borderBottomLeftRadius:8,
          borderTopRightRadius:0, borderBottomRightRadius:0,
          background:'#ffba00', color:NAVY, border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
      <button
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Send later options"
        title="Send later"
        style={{
          width:22, height:36,
          borderTopRightRadius:8, borderBottomRightRadius:8,
          borderTopLeftRadius:0, borderBottomLeftRadius:0,
          background:'#FFC933', color:NAVY,
          border:'none', borderLeft:'1px solid rgba(11,31,59,0.18)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {menuOpen && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 6px)', right:0,
          width:180, background:'white',
          border:'1px solid rgba(27,43,75,0.12)', borderRadius:10,
          boxShadow:'0 8px 24px rgba(27,43,75,0.16)',
          padding:6, zIndex:60,
        }}>
          <div style={{ padding:'4px 10px 6px', fontSize:10, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em' }}>Send later</div>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setMenuOpen(false); onSchedule?.(p.at); }}
              style={{
                width:'100%', textAlign:'left',
                padding:'6px 10px', fontSize:13, fontWeight:500, color:NAVY,
                background:'none', border:'none', borderRadius:6,
                cursor:'pointer', fontFamily:'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8F8F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >{p.label}</button>
          ))}
          <div style={{ height:1, background:'rgba(27,43,75,0.08)', margin:'4px 4px' }} />
          <button
            onClick={customSchedule}
            style={{
              width:'100%', textAlign:'left',
              padding:'6px 10px', fontSize:13, fontWeight:500, color:NAVY,
              background:'none', border:'none', borderRadius:6,
              cursor:'pointer', fontFamily:'inherit',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8F8F6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Pick date + time…</button>
        </div>
      )}
    </div>
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
  const [starredManagerOpen, setStarredManagerOpen] = React.useState(false);
  const fetchSuggestions = async () => {
    if (suggestionsLoading) return;
    setSuggestionsLoading(true);
    setSuggestionsErr('');
    try {
      const { data, error } = await CRM.__invokeFn('suggest-reply', { body: { contactId: contact.id } });
      if (error || !data) {
        // supabase-js wraps non-2xx as a generic "Edge Function returned a
        // non-2xx status code". The actual error JSON lives on
        // `error.context` (a Response) — read it so Key sees what broke.
        let detail = error?.message || 'unknown';
        try {
          const body = await error?.context?.json?.();
          if (body?.error) detail = body.error + (body.detail ? ` — ${body.detail}` : '');
        } catch (_) {}
        setSuggestionsErr(`Failed: ${detail}`);
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
  // suggest-reply calls weight it heavily. Toast offers a 5s undo so a
  // mis-tapped star isn't a permanent vote on the prompt's voice corpus.
  const starSuggestion = async (body) => {
    try {
      const { data, error } = await CRM.__db?.from('reply_suggestion_stars')
        .insert({ body, contact_id: contact.id })
        .select()
        .single();
      if (error) {
        window.showToast?.(`Star failed: ${error.message}`);
        return;
      }
      window.showToast?.('Saved as example', {
        undo: async () => {
          if (!data?.id) return;
          await CRM.__db?.from('reply_suggestion_stars').delete().eq('id', data.id);
          window.showToast?.('Star removed');
        },
        duration: 5000,
      });
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

  // Mark inbound messages as read whenever this thread is opened. Without
  // this the unread badge / inbox badge / "needs reply" pill never clear,
  // even after Key has obviously seen the conversation. Optimistic — flips
  // the in-memory rows immediately so the UI updates without a refetch,
  // then patches Supabase in the background.
  React.useEffect(() => {
    if (!CRM.__db) return;
    const unread = (CRM.messages || []).filter(m =>
      m.contact_id === contact.id &&
      m.direction === 'in' &&
      m.read_at == null
    );
    if (unread.length === 0) return;
    const stamp = new Date().toISOString();
    const ids = unread.map(m => m.id);
    // Optimistic UI update — mutate in-place so the existing CRM data
    // pipeline (signal map, inbox badges) sees fresh values immediately.
    for (const m of unread) m.read_at = stamp;
    // Fire the change event so anything that derives from the messages
    // array (badge counts, "needs reply" filter, signal map) re-renders.
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    // Persist. .in() handles the chunk in one round-trip; if the patch
    // fails we revert the optimistic write so badges stay accurate.
    CRM.__db.from('messages').update({ read_at: stamp }).in('id', ids).then(({ error }) => {
      if (error) {
        for (const m of unread) m.read_at = null;
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        console.warn('[CRM] mark-as-read failed:', error.message);
      }
    });
  }, [contact.id, thread.length]);

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

  // Combined view = persisted + optimistic. Dedupe by body+minute-bucket
  // so once realtime delivers the persisted row, the optimistic bubble
  // collapses into it instead of the user seeing the same message twice
  // until they switch contacts. (Server-side message ids are uuids that
  // don't match the local 'n' + Date.now() id, so id-based dedupe alone
  // doesn't work — body + minute-bucket of the persisted row is a
  // reliable match for an optimistic row Key just sent.)
  const allMsgs = React.useMemo(() => {
    const persistedKeys = new Set();
    for (const m of sortedThread) {
      if (m.direction !== 'out') continue;
      const minute = Math.floor(new Date(m.sent_at).getTime() / 60000);
      persistedKeys.add(`${(m.body || '').trim()}::${minute}`);
    }
    const live = localMsgs.filter(m => {
      const minute = Math.floor(new Date(m.sent_at).getTime() / 60000);
      const key = `${(m.body || '').trim()}::${minute}`;
      return !persistedKeys.has(key);
    });
    return [...sortedThread, ...live];
  }, [sortedThread, localMsgs]);

  // Garbage-collect optimistic bubbles that the realtime channel has now
  // mirrored into sortedThread. Without this, localMsgs grows unbounded
  // for a long-lived contact session and the dedupe runs against ever-
  // larger arrays. Tied to sortedThread.length so it fires on every
  // realtime push without a separate effect.
  React.useEffect(() => {
    if (localMsgs.length === 0) return;
    const persistedKeys = new Set();
    for (const m of sortedThread) {
      if (m.direction !== 'out') continue;
      const minute = Math.floor(new Date(m.sent_at).getTime() / 60000);
      persistedKeys.add(`${(m.body || '').trim()}::${minute}`);
    }
    const surviving = localMsgs.filter(m => {
      const minute = Math.floor(new Date(m.sent_at).getTime() / 60000);
      return !persistedKeys.has(`${(m.body || '').trim()}::${minute}`);
    });
    if (surviving.length !== localMsgs.length) setLocalMsgs(surviving);
  }, [sortedThread.length]);

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
        // Peek at error.context.json() so failures show the real reason
        // (Twilio code, DNC block, rate-limit) instead of the wrapper's
        // generic "Edge Function returned a non-2xx status code".
        setLocalMsgs(m => m.filter(x => x.id !== tempId));
        setMsg(body);
        let detail = data?.error || error?.message || 'unknown';
        try {
          const errBody = error?.context ? await error.context.json() : null;
          if (errBody?.error) detail = errBody.error + (errBody.detail ? ` — ${errBody.detail}` : '');
        } catch (_) {}
        window.showToast?.(`Send failed: ${detail}`);
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
          <span style={{ fontSize:10, fontWeight:700, color:'#5B21B6', alignSelf:'center', whiteSpace:'nowrap', letterSpacing:'0.05em' }}>SUGGESTED</span>
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
        <button
          onClick={() => setStarredManagerOpen(true)}
          aria-label="Manage starred examples"
          title="Manage starred examples"
          style={{
            height:30, width:30, borderRadius:6,
            border:'1px solid #DDD6FE', background:'white', color:'#5B21B6',
            cursor:'pointer', fontFamily:'inherit', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
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
      {starredManagerOpen && <StarredExamplesManager onClose={() => setStarredManagerOpen(false)} />}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={{ padding:'6px 12px 0', background:'transparent', display:'flex', gap:5, flexWrap:'wrap', flexShrink:0 }}>
          {attachments.map((a,i) => (
            <div key={i} style={{ position:'relative' }}>
              {a.type==='image'
                ? <img src={a.url} alt={a.name} style={{ width:52, height:52, borderRadius:6, objectFit:'cover' }}/>
                : <div style={{ width:52, height:52, borderRadius:6, background:'white', border:'1px solid rgba(11,31,59,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📎</div>}
              <button onClick={()=>setAttachments(a => a.filter((_,j) => j !== i))} style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:'50%', background:'#E53E3E', border:'2px solid white', color:'white', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', lineHeight:1 }}>✕</button>
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

      <ScheduledMessagesStrip contactId={contact.id} />

      {/* Compose. v10.1.27: padding-bottom uses --vvs which collapses to 0
          when the keyboard is open (visualViewport.height < 600), restoring
          to env(safe-area-inset-bottom) when keyboard closed. Eliminates
          the chin gap below compose when keyboard is up. */}
      {!isDnc && (
        <div style={{ padding:'10px 16px calc(14px + var(--vvs, env(safe-area-inset-bottom, 0px)))', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
          {/* v10.1.29: 1-line default, auto-grow to 3 lines, then scroll.
              Sets row=1 + measures scrollHeight on every input to expand. */}
          <textarea value={msg}
            ref={(el) => {
              // Desktop autofocus on first mount so Key can type immediately
              // when navigating to Messages — saves a tap-to-focus per visit.
              // Skip on mobile to avoid forcing the keyboard up.
              if (el && window.innerWidth >= 768 && !el.dataset.bppAutofocused) {
                el.dataset.bppAutofocused = '1';
                setTimeout(() => el.focus({ preventScroll: true }), 50);
              }
            }}
            rows={1}
            onChange={e => {
              setMsg(e.target.value);
              const ta = e.target;
              ta.style.height = 'auto';
              ta.style.height = Math.min(ta.scrollHeight, 92) + 'px';
            }}
            onKeyDown={e=>{
              // Desktop: Enter sends, Shift+Enter newline. Mobile: Return
              // ALWAYS newlines (iOS-native textarea behavior). Send button
              // is the only way to send on mobile.
              const isMobile = window.innerWidth < 768;
              if (e.key==='Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); send(); }
            }}
            placeholder="Message…"
            enterKeyHint="send"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck={true}
            style={{
              flex:1, minHeight:36, maxHeight:92,
              borderRadius:8, border:'1px solid rgba(11,31,59,0.15)',
              padding:'8px 12px', fontSize:16, fontFamily:'inherit', resize:'none', outline:'none',
              color:NAVY, lineHeight:1.35, boxSizing:'border-box', background:'white',
              overflowY:'auto',
            }}
          />
          <SendButton
            onSend={send}
            onSchedule={(atIso) => {
              const body = msg.trim();
              if (!body && !attachments.length) return;
              window.scheduleMessage?.({ contactId: contact.id, body, atIso, attachments: [...attachments] });
              setMsg('');
              setAttachments([]);
              sessionStorage.removeItem(draftKey);
              const niceTime = new Date(atIso).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
              window.showToast?.('Scheduled for ' + niceTime);
            }}
          />
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

  // Clear voicemail badge on view — same class as the mark-message-read
  // pattern shipped 2026-05-09 for messages. Whenever this tab mounts or
  // the call list updates, mark every unlistened voicemail listened_at=now.
  // Optimistic + revert on error.
  React.useEffect(() => {
    if (!CRM.__db) return;
    const unlistened = (CRM.calls || []).filter(c =>
      c.contact_id === contact.id &&
      c.voicemail_url &&
      c.listened_at == null
    );
    if (unlistened.length === 0) return;
    const stamp = new Date().toISOString();
    const ids = unlistened.map(c => c.id);
    for (const c of unlistened) c.listened_at = stamp;
    window.dispatchEvent(new CustomEvent('crm-data-changed'));
    CRM.__db.from('calls').update({ listened_at: stamp }).in('id', ids).then(({ error }) => {
      if (error) {
        for (const c of unlistened) c.listened_at = null;
        window.dispatchEvent(new CustomEvent('crm-data-changed'));
        console.warn('[CRM] mark-voicemail-listened failed:', error.message);
      }
    });
  }, [contact.id, calls.length]);

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
    // Audit-2026-05-09 a11y M1: focus trap. Without this, a keyboard-
    // only user pressing Tab past the last focusable element in a modal
    // moves focus into the underlying contact list / message thread /
    // nav buttons. Cycle Tab inside the modal; Shift+Tab from the first
    // focusable wraps to the last.
    const onTab = (e) => {
      if (e.key !== 'Tab' || !cardRef.current) return;
      const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const els = Array.from(cardRef.current.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null /* visible */ );
      if (els.length === 0) { e.preventDefault(); cardRef.current.focus(); return; }
      const first = els[0];
      const last  = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !cardRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      __popModalLock(closeFn);
      document.removeEventListener('keydown', onTab);
    };
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

// ── New Proposal Modal / Inline Composer (V3, sketch 2026-05-08) ───────
// Single creator: amp pills → length slider → 4 toggle pills (cord, inlet,
// permit, peace of mind) → +Line Item / +Discount with drag-reorder →
// total + deposit toggle → Send. PoM is creator-side only; when offered,
// the client sees an opt-in checkbox on proposal.html (NOT pre-checked,
// NOT in displayed total). Cord/inlet/permit are creator-only toggles —
// flipping off subtracts from total + adds a discreet "customer providing
// own X" line on the rendered proposal (price decrease never shown).
//
// Edit mode: passing editingProposal rehydrates the form. v2 proposals
// lift cleanly into v3 fields; saving rewrites as creator_version='v3'.
function NewProposalModal({ contact, onClose, inline = false, editingProposal = null }) {
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');
  const isEdit = !!editingProposal;
  const ep = editingProposal || {};

  // Default amp from existing proposal, otherwise the contact's panel spec.
  const [amp, setAmp] = React.useState(() => {
    if (isEdit && ['30','50'].includes(String(ep.amp_type))) return String(ep.amp_type);
    return ['30','50'].includes(String(contact.panel_amps)) ? String(contact.panel_amps) : '30';
  });
  const [lengthFt,       setLengthFt]      = React.useState(() => isEdit ? (Number(ep.length_ft) || 5) : 5);
  const [includeCord,    setIncludeCord]   = React.useState(() => isEdit ? ep.include_cord    !== false : true);
  const [includeInlet,   setIncludeInlet]  = React.useState(() => isEdit ? ep.include_inlet   !== false : true);
  const [includePermit,  setIncludePermit] = React.useState(() => isEdit ? ep.include_permit  !== false : true);
  const [pomOffered,     setPomOffered]    = React.useState(() => isEdit ? !!ep.pom_offered : false);
  const [requireDeposit, setRequireDeposit]= React.useState(() => isEdit ? !!ep.require_deposit : false);
  const [notes,          setNotes]         = React.useState(() => isEdit ? (ep.notes || '') : '');
  // Line items: { id, kind: 'item'|'discount', name, amount, checked, discountType }.
  const [lineItems, setLineItems] = React.useState(() => {
    if (!isEdit) return [];
    const items = (Array.isArray(ep.extra_line_items) ? ep.extra_line_items : []).map(li => ({
      id: li.id || ('i_' + Math.random().toString(36).slice(2,8)),
      kind: 'item',
      name: li.name || '',
      amount: Number(li.amount) || 0,
      checked: li.checked !== false,
    }));
    if (ep.discount_type && Number(ep.discount_value) > 0) {
      items.push({
        id: 'd_' + Math.random().toString(36).slice(2,8),
        kind: 'discount', name: 'Discount',
        discountType: ep.discount_type,
        amount: Number(ep.discount_value),
        checked: true,
      });
    }
    return items;
  });
  const [busy, setBusy] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState(null);
  // ref shadow so onDrop reads the live value, not the stale closure value.
  // React state updates from onDragStart aren't visible to onDrop's render
  // when the events fire close together — the ref bypasses that race.
  const dragIdxRef = React.useRef(null);

  const total = React.useMemo(() => quoteV3Total({
    amp, lengthFt, includeCord, includeInlet, includePermit, lineItems,
  }), [amp, lengthFt, includeCord, includeInlet, includePermit, lineItems]);

  const hasDiscount = lineItems.some(li => li.kind === 'discount');
  const addItem = () => setLineItems(prev => [...prev, {
    id: 'i_' + Math.random().toString(36).slice(2,8),
    kind: 'item', name: '', amount: 0, checked: true,
  }]);
  const addDiscount = () => {
    if (hasDiscount) return;
    setLineItems(prev => [...prev, {
      id: 'd_' + Math.random().toString(36).slice(2,8),
      kind: 'discount', name: 'Discount', discountType: 'dollar', amount: 0, checked: true,
    }]);
  };
  // 2026-05-09: Quick Add — one-click pre-filled line items for the most
  // common adders (panel work, surge, adapter). Sourced from V3_PRICING
  // so the dollar amounts stay in sync with QuickQuoteModal. The user
  // can edit name/amount/checked on the resulting row exactly like a
  // hand-typed line item — these rows aren't system-locked.
  const QA_PRICES = (window.V3_PRICING) || {};
  // Surge combo discount: when PoM is also offered, surge drops by $25.
  // The tile shows the live amount, and the existing surge row (if any)
  // auto-adjusts on PoM toggle via the useEffect below.
  const surgeBase   = QA_PRICES.surge         || 446;
  const surgeOff    = QA_PRICES.surgeDiscount || 25;
  const surgeAmount = surgeBase - (pomOffered ? surgeOff : 0);
  const QA = [
    { key:'mainBreaker', name:'Main breaker replacement',  amount: QA_PRICES.mainBreaker || 225, show: true },
    { key:'twinQuad',    name:'Panel space (twin / quad)', amount: QA_PRICES.twinQuad    || 125, show: true },
    { key:'surge',       name:'Surge protector',           amount: surgeAmount,                  show: true },
    { key:'adapter',     name:'30→50A cord adapter',       amount: QA_PRICES.adapter     || 150, show: amp === '50' },
  ];
  // Hide a Quick Add tile (dim to 'added' state) if a row with the same
  // name already exists, so Key doesn't double-add by accident.
  const lineItemNames = new Set(lineItems.filter(li => li.kind === 'item').map(li => (li.name || '').toLowerCase()));
  const addQuickItem = (qa) => {
    if (lineItemNames.has(qa.name.toLowerCase())) return;
    setLineItems(prev => [...prev, {
      id: 'qa_' + Math.random().toString(36).slice(2,8),
      kind: 'item', name: qa.name, amount: qa.amount, checked: true,
    }]);
  };
  // When PoM toggles, auto-adjust an existing surge row's amount between
  // the two known states (446 base ↔ 421 combo). Preserves user-edited
  // amounts (only flips when matching one of the two known prices).
  React.useEffect(() => {
    setLineItems(prev => {
      let changed = false;
      const next = prev.map(li => {
        if (li.kind !== 'item') return li;
        if (!/surge/i.test(li.name || '')) return li;
        if (pomOffered && li.amount === surgeBase) {
          changed = true;
          return { ...li, amount: surgeBase - surgeOff };
        }
        if (!pomOffered && li.amount === surgeBase - surgeOff) {
          changed = true;
          return { ...li, amount: surgeBase };
        }
        return li;
      });
      return changed ? next : prev;
    });
  }, [pomOffered]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateItem = (i, patch) => setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, ...patch } : li));
  const removeItem = (i) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const moveItem = (from, to) => setLineItems(prev => {
    if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });

  const submit = async () => {
    if (busy) return;
    if (!isEdit && contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (!CRM.__db || !CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    setBusy(true);
    try {
      const discountItem = lineItems.find(li => li.kind === 'discount');
      const extraLI = lineItems.filter(li => li.kind !== 'discount').map(li => ({
        id: li.id, name: li.name || '', amount: Number(li.amount) || 0, checked: li.checked !== false,
      }));
      const payload = {
        contact_id:      contact.id,
        contact_name:    contact.name    || '',
        contact_email:   contact.email   || '',
        contact_phone:   contact.phone   || '',
        contact_address: contact.address || '',
        creator_version: 'v3',
        amp_type:        amp,
        selected_amp:    amp,
        length_ft:       lengthFt,
        run_ft:          lengthFt,                // legacy mirror
        include_cord:    !!includeCord,
        cord_included:   !!includeCord,           // legacy mirror
        include_inlet:   !!includeInlet,
        include_permit:  !!includePermit,
        include_surge:   false,
        pom_offered:     !!pomOffered,
        // Audit-2026-05-09 M9: in edit mode `ep` was captured at modal
        // mount; if the customer accepts PoM via the proposal page
        // (realtime flips proposals.pom_accepted) WHILE the modal is
        // open, saving any tweak silently overwrites the customer's
        // choice with the stale false. Re-resolve from the live
        // CRM.proposals row at submit time so we always merge in the
        // latest server value.
        pom_accepted:    (() => {
          if (!isEdit) return false;
          const live = (window.CRM?.proposals || []).find(p => p.id === ep.id);
          if (live && typeof live.pom_accepted === 'boolean') return live.pom_accepted;
          return !!ep.pom_accepted;
        })(),
        include_pom:     false,                    // never auto-included; opt-in on client page
        selected_pom:    false,
        pom_price:       (window.V3_PRICING?.pom) || 447,
        require_deposit: !!requireDeposit,
        discount_type:   discountItem ? discountItem.discountType : null,
        discount_value:  discountItem ? Number(discountItem.amount) || 0 : null,
        discount_amount: discountItem && discountItem.discountType === 'dollar' ? Number(discountItem.amount) || 0 : 0,
        extra_line_items: extraLI,
        custom_items:    extraLI.map(li => ({ title: li.name, price: li.amount })), // legacy mirror
        total,
        price_base:      total,
        price_cord:      0, price_surge: 0,
        notes:           notes.trim(),
      };
      let data, error;
      if (isEdit) {
        ({ data, error } = await CRM.__db.from('proposals').update(payload).eq('id', ep.id).select().single());
      } else {
        // Initial status 'Created' (renders as Draft pill via mapProposal). The
        // Send button on the FinanceRow is the trigger for SMS dispatch — Create
        // just saves the document, leaving Key in control of cadence.
        ({ data, error } = await CRM.__db.from('proposals').insert([{ ...payload, status: 'Created' }]).select().single());
      }
      if (error || !data) {
        window.showToast?.(`${isEdit ? 'Update' : 'Create'} failed: ${error?.message || 'unknown'}`);
        setBusy(false);
        return;
      }
      // Optimistically push the new proposal into CRM.proposals so the
      // row renders immediately. Realtime would do this eventually, but
      // there's a perceptible gap where the modal closes and the user
      // sees an empty / stale list. Mirror the shape mapProposal returns
      // so DealCard renders without missing fields.
      const dollars = Number(data.total) || 0;
      const mapped = {
        id: data.id, token: data.token, contact_id: data.contact_id,
        tier: data.pricing_tier || 'standard',
        amount_cents: Math.round(dollars * 100),
        amp_spec: data.amp_type ? data.amp_type + 'A' : null,
        status: isEdit ? (
          ({ Sent:'sent', Copied:'sent', Created:'draft', Signed:'approved', Approved:'approved', Cancelled:'declined' })[data.status] ||
          (data.status||'sent').toLowerCase()
        ) : 'draft',
        sent_at: data.copied_at || data.created_at,
        viewed_at: data.viewed_at || null,
        approved_at: data.signed_at || null,
        label: data.amp_type ? `Generator inlet, ${data.amp_type}A` : 'Generator inlet',
        creator_version: data.creator_version || 'v3',
        length_ft: data.length_ft != null ? Number(data.length_ft) : null,
        include_cord: data.include_cord !== false,
        include_inlet: data.include_inlet !== false,
        include_permit: data.include_permit !== false,
        pom_offered: !!data.pom_offered,
        pom_accepted: !!data.pom_accepted,
        require_deposit: !!data.require_deposit,
        extra_line_items: Array.isArray(data.extra_line_items) ? data.extra_line_items : [],
        discount_type: data.discount_type || null,
        discount_value: data.discount_value != null ? Number(data.discount_value) : null,
        notes: data.notes || '',
        amp_type: data.amp_type || null,
      };
      const arr = (window.CRM.proposals = window.CRM.proposals || []);
      const idx = arr.findIndex(p => p.id === mapped.id);
      if (idx >= 0) arr[idx] = mapped; else arr.unshift(mapped);
      // Bump contact stage NEW → QUOTED on first proposal create.
      // Audit-2026-05-09 H7: this was fire-and-forget — submit() called
      // onClose() before the stage write resolved, so a failure toast
      // landed after the modal had closed AND a subsequent close+open
      // could race with the original write. Now awaited + rolled back
      // before onClose so the user actually sees the failure feedback.
      if (!isEdit && contact.stage === 'new') {
        const numQuoted = CRM.STAGE_STR_TO_NUM?.quoted ?? 2;
        contact.stage = 'quoted';
        try {
          const { error: stageErr } = await CRM.__db.from('contacts').update({ stage: numQuoted }).eq('id', contact.id);
          if (stageErr) {
            contact.stage = 'new';
            window.dispatchEvent(new CustomEvent('crm-data-changed'));
            window.showToast?.(`Stage update failed: ${stageErr.message}`, { kind:'error' });
          }
        } catch (err) {
          contact.stage = 'new';
          window.dispatchEvent(new CustomEvent('crm-data-changed'));
          window.showToast?.(`Stage update failed: ${err?.message || err}`, { kind:'error' });
        }
      }
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(isEdit ? 'Proposal updated' : 'Proposal created');
      onClose();
    } catch (e) {
      window.showToast?.(`Failed: ${e.message || e}`);
      setBusy(false);
    }
  };

  // ── UI primitives (scoped to this component) ──────────────────────────
  // V3 polish: pills accept a `withCheck` prop to show a checkbox-style icon
  // on the left, indicating toggle state at a glance (matches the Claude
  // Design polish pass — checkbox-in-pill is more legible than fill-only).
  const Pill = ({ on, onClick, children, accent, withCheck = false }) => (
    <button onClick={onClick} style={{
      flex:1, minHeight:38, padding:'0 14px', borderRadius:8,
      background: on ? (accent || NAVY) : 'white',
      color: on ? (accent === GOLD ? NAVY : 'white') : NAVY,
      border: on ? 'none' : '1px solid rgba(11,31,59,0.15)',
      fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      boxShadow: on ? '0 1px 0 rgba(11,31,59,0.04), 0 0 0 1px rgba(11,31,59,0.04)' : 'none',
      transition:'background 120ms, color 120ms',
    }}>
      {withCheck && (
        <span aria-hidden="true" style={{
          width:14, height:14, borderRadius:3, flexShrink:0,
          border: on ? '1.5px solid currentColor' : '1.5px solid rgba(11,31,59,0.35)',
          background: on ? 'transparent' : 'white',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          color: 'currentColor',
        }}>
          {on && (
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,6.5 5,9 10,3" />
            </svg>
          )}
        </span>
      )}
      {children}
    </button>
  );

  const renderLineRow = (li, i) => {
    const isDiscount = li.kind === 'discount';
    return (
      <div
        key={li.id}
        draggable
        onDragStart={() => { dragIdxRef.current = i; setDragIdx(i); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = dragIdxRef.current;
          if (from != null) moveItem(from, i);
          dragIdxRef.current = null;
          setDragIdx(null);
        }}
        onDragEnd={() => { dragIdxRef.current = null; setDragIdx(null); }}
        style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'9px 10px',
          background: isDiscount ? '#FFF8E0' : 'white',
          border: '1px solid ' + (isDiscount ? GOLD : 'rgba(11,31,59,0.10)'),
          borderRadius:8,
          opacity: dragIdx === i ? 0.5 : 1,
          boxShadow: dragIdx === i ? 'none' : (isDiscount
            ? '0 1px 2px rgba(255,186,0,0.18)'
            : '0 1px 2px rgba(11,31,59,0.05)'),
          cursor: dragIdx === i ? 'grabbing' : 'default',
          transition:'box-shadow 120ms, opacity 120ms',
        }}
      >
        <span title="Drag to reorder" style={{ cursor:'grab', color:'#9CA3AF', userSelect:'none', fontSize:15, padding:'0 2px', letterSpacing:'-0.05em' }}>⋮⋮</span>
        {isDiscount ? (
          <span style={{ display:'inline-flex', gap:1, background:'rgba(11,31,59,0.06)', padding:2, borderRadius:6, marginRight:2 }}>
            <button type="button" onClick={() => updateItem(i, { discountType: 'dollar' })} style={{
              padding:'4px 8px', border:'none', borderRadius:5,
              background: li.discountType === 'dollar' ? GOLD : 'transparent',
              color: li.discountType === 'dollar' ? NAVY : '#6B7280',
              fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'inherit', minWidth:22,
            }}>$</button>
            <button type="button" onClick={() => updateItem(i, { discountType: 'percent' })} style={{
              padding:'4px 8px', border:'none', borderRadius:5,
              background: li.discountType === 'percent' ? GOLD : 'transparent',
              color: li.discountType === 'percent' ? NAVY : '#6B7280',
              fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'inherit', minWidth:22,
            }}>%</button>
          </span>
        ) : (
          <input
            type="checkbox"
            checked={li.checked !== false}
            onChange={(e) => updateItem(i, { checked: e.target.checked })}
            title="Pre-checked for client (client can uncheck)"
            style={{ width:16, height:16, accentColor: NAVY, flexShrink:0, cursor:'pointer' }}
          />
        )}
        <input
          type="text"
          value={li.name}
          onChange={(e) => updateItem(i, { name: e.target.value })}
          placeholder={isDiscount ? 'Discount label' : 'Service name'}
          style={{ flex:1, minWidth:0, padding:'5px 6px', border:'none', background:'transparent',
                   fontSize:13, color:NAVY, fontFamily:'inherit', outline:'none', fontWeight:500 }}
        />
        <span style={{ color:'#9CA3AF', fontSize:13, fontWeight:600 }}>{isDiscount ? '−$' : '$'}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0" step="1"
          value={li.amount}
          onChange={(e) => updateItem(i, { amount: parseFloat(e.target.value) || 0 })}
          style={{ width:64, padding:'5px 8px', border:'1px solid rgba(11,31,59,0.10)', borderRadius:6,
                   fontSize:13, textAlign:'right', fontWeight:700, color:NAVY,
                   fontFamily:"'JetBrains Mono','DM Mono',monospace", background:'white' }}
        />
        <button type="button" onClick={() => removeItem(i)} aria-label="Remove" style={{
          background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', padding:'4px 6px',
          fontSize:14, lineHeight:1, fontFamily:'inherit', borderRadius:4,
        }}>✕</button>
      </div>
    );
  };

  const formBody = (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* 1. Amp toggle */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Amperage</div>
        <div style={{ display:'flex', gap:8 }}>
          <Pill on={amp === '30'} onClick={() => setAmp('30')}>30A</Pill>
          <Pill on={amp === '50'} onClick={() => setAmp('50')}>50A</Pill>
        </div>
      </div>
      {/* 2. Length slider — gradient-filled track shows progress visually */}
      <div>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Length</span>
          <span style={{ fontSize:14, fontWeight:700, color:NAVY, fontFamily:"'JetBrains Mono','DM Mono',monospace" }}>{lengthFt}'</span>
        </div>
        {(() => {
          const pct = Math.round(((lengthFt - 5) / 95) * 100);
          return (
            <input
              type="range" min="5" max="100" step="5" value={lengthFt}
              onChange={(e) => setLengthFt(parseInt(e.target.value, 10) || 5)}
              className="cv3-range"
              style={{
                width:'100%', height:6, WebkitAppearance:'none', appearance:'none',
                background: `linear-gradient(to right, ${NAVY} 0%, ${NAVY} ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`,
                borderRadius:6, outline:'none', accentColor: NAVY,
              }}
            />
          );
        })()}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#999', marginTop:2 }}>
          <span>5'</span><span>100'</span>
        </div>
      </div>
      {/* 3. 4 toggle pills with embedded check icons (per design polish) */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Scope</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Pill on={includeCord}    onClick={() => setIncludeCord(v => !v)}    withCheck>Cord</Pill>
          <Pill on={includeInlet}   onClick={() => setIncludeInlet(v => !v)}   withCheck>Inlet</Pill>
          <Pill on={includePermit}  onClick={() => setIncludePermit(v => !v)}  withCheck>Permit</Pill>
          <Pill on={pomOffered}     onClick={() => setPomOffered(v => !v)} accent={GOLD} withCheck>Peace of Mind</Pill>
        </div>
        {pomOffered && (
          <div style={{
            fontSize:11, color:'#92400E', fontStyle:'italic', marginTop:8,
            padding:'8px 12px', background:'#FFFBEB', border:'1px solid #FDE68A',
            borderLeft:`3px solid ${GOLD}`, borderRadius:6,
          }}>
            Visible to client as opt-in (not pre-checked, not in displayed total).
          </div>
        )}
      </div>
      {/* 4. Quick Add — one-tap pre-filled rows for the most common adders.
          Sourced from V3_PRICING so amounts stay in sync with the Quick
          Quote calculator. Tile dims to 'added' state once a row with
          matching name exists in the list. */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Quick add</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:6 }}>
          {QA.filter(qa => qa.show).map(qa => {
            const added = lineItemNames.has(qa.name.toLowerCase());
            return (
              <button
                key={qa.key} type="button"
                onClick={() => addQuickItem(qa)}
                disabled={added}
                title={added ? 'Already on this proposal' : `Add "${qa.name}" line item`}
                style={{
                  height:42, padding:'0 10px', borderRadius:8,
                  background: added ? '#F0FDF4' : 'white',
                  border: '1px dashed ' + (added ? '#86EFAC' : 'rgba(11,31,59,0.18)'),
                  color: added ? '#166534' : NAVY,
                  fontSize:12, fontWeight:600, fontFamily:'inherit',
                  cursor: added ? 'default' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
                  textAlign:'left',
                }}
              >
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, minWidth:0 }}>
                  <span aria-hidden="true" style={{ fontSize:14, fontWeight:700, lineHeight:1, flexShrink:0 }}>
                    {added ? '✓' : '+'}
                  </span>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {qa.name.replace(' replacement','')}
                  </span>
                </span>
                <span style={{ color: added ? '#166534' : '#666', fontSize:11, fontFamily:"'JetBrains Mono','DM Mono',monospace", fontWeight:700, flexShrink:0 }}>
                  ${qa.amount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {/* 5. + Line Item / + Discount */}
      <div>
        <div style={{ display:'flex', gap:8 }}>
          <button type="button" onClick={addItem} style={{
            flex:1, height:36, padding:'0 12px', borderRadius:8, background:'white',
            border:'1px dashed rgba(11,31,59,0.25)', color:'#666',
            fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>+ Line Item</button>
          <button type="button" onClick={addDiscount} disabled={hasDiscount} style={{
            flex:1, height:36, padding:'0 12px', borderRadius:8,
            background: hasDiscount ? '#F5F5F5' : 'white',
            border:'1px dashed rgba(11,31,59,0.25)',
            color: hasDiscount ? '#bbb' : '#666',
            fontSize:12, fontWeight:600, fontFamily:'inherit',
            cursor: hasDiscount ? 'not-allowed' : 'pointer',
          }}>+ Discount</button>
        </div>
        {lineItems.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
            {lineItems.map((li, i) => renderLineRow(li, i))}
          </div>
        )}
      </div>
      {/* Notes */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
          Notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special instructions, access notes…"
          rows={2}
          style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EBEBEA', borderRadius:8,
                   fontSize:14, color:NAVY, fontFamily:'inherit', outline:'none', resize:'vertical',
                   boxSizing:'border-box' }}
        />
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:5, fontSize:11, color:'#9CA3AF' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Visible to customer
        </div>
      </div>
    </div>
  );

  const footerRow = (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
      padding:'10px 12px', borderRadius:8, background:'#F9FAFB',
      borderTop:`2px solid ${NAVY}`,
    }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em' }}>Total</div>
        <div style={{ fontSize:24, fontWeight:700, color:NAVY, fontFamily:"'JetBrains Mono','DM Mono',monospace", letterSpacing:'-0.01em' }}>
          ${total.toLocaleString()}
        </div>
        {pomOffered && (
          <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>
            +${(window.V3_PRICING?.pom) || 447} if client opts into Peace of Mind
          </div>
        )}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button type="button" onClick={() => setRequireDeposit(v => !v)} style={{
          height:38, padding:'0 14px', borderRadius:8,
          background: requireDeposit ? GOLD : 'white',
          color: requireDeposit ? NAVY : '#6B7280',
          border: requireDeposit ? 'none' : '1px solid rgba(11,31,59,0.15)',
          fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
          display:'inline-flex', alignItems:'center', gap:5,
        }}>{requireDeposit && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6.5 5,9 10,3" />
          </svg>
        )}50% deposit</button>
        <button
          onClick={submit}
          disabled={busy || (!isEdit && contact.do_not_contact)}
          style={{
            height:42, padding:'0 18px', borderRadius:8,
            background: busy || (!isEdit && contact.do_not_contact) ? '#E5E5E5' : '#ffba00',
            color: busy || (!isEdit && contact.do_not_contact) ? '#999' : NAVY,
            border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
            cursor: busy || (!isEdit && contact.do_not_contact) ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', gap:7,
            boxShadow: busy || (!isEdit && contact.do_not_contact) ? 'none' : '0 1px 2px rgba(255,186,0,0.3)',
          }}
        >
          {busy ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create proposal')}
          {!busy && !(!isEdit && contact.do_not_contact) && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div data-card style={{
        background:'white', border:'1px solid rgba(11,31,59,0.12)', borderRadius:8,
        marginBottom:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px 10px', borderBottom:'1px solid rgba(11,31,59,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:NAVY }}>{isEdit ? 'Edit proposal' : 'New proposal'}</div>
          <button onClick={onClose} aria-label="Cancel" style={{
            // Audit-2026-05-09 a11y M4: 32×32 → 44×44.
            width:44, height:44, borderRadius:6, border:'none', background:'transparent',
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
      title={`${isEdit ? 'Edit proposal' : 'New proposal'} — ${contact.name || formatPhone(contact.phone)}`}
      footer={footerRow}
    >
      {formBody}
    </ModalShell>
  );
}

// ── New Invoice Modal (V3, sketch 2026-05-08) ─────────────────────────
// Same line-items + discount editing model as the proposal creator, but
// no deposit toggle (per Key's spec). Type picker (Deposit/Final/Balance)
// is a one-click preset that pre-fills line items; Key can then add /
// remove / reorder / discount before sending.
function NewInvoiceModal({ contact, latestSignedProposal, invoices, onClose, inline = false, editingInvoice = null }) {
  const firstName = ((contact.name || '').trim().split(/\s+/)[0] || 'there');
  const isEdit = !!editingInvoice;
  const ei = editingInvoice || {};

  const proposalTotal = (latestSignedProposal?.amount_cents || 0) / 100;
  const billedSum = invoices
    // In edit mode the invoice being edited is still in the list; counting
    // it would shrink `remaining` by its own amount and break the Final
    // preset (it would suggest $0 even when room exists). Exclude self.
    .filter(i => i.id !== ei.id && !['voided', 'refunded', 'draft', 'declined'].includes(i.status))
    .reduce((s,i) => s + (i.amount_cents || 0), 0) / 100;
  const remaining = Math.max(0, proposalTotal - billedSum);

  const [lineItems, setLineItems] = React.useState(() => {
    if (isEdit) {
      const items = (Array.isArray(ei.line_items) ? ei.line_items : []).map(li => ({
        id: li.id || ('i_' + Math.random().toString(36).slice(2,8)),
        kind: li.kind || (li.discountType ? 'discount' : 'item'),
        name: li.name || '',
        amount: Number(li.amount) || 0,
        checked: li.checked !== false,
        discountType: li.discountType || null,
      }));
      return items;
    }
    // Default preset: 50% deposit if there's an approved proposal, otherwise empty.
    if (proposalTotal > 0) {
      return [{
        id: 'i_' + Math.random().toString(36).slice(2,8),
        kind: 'item', name: '50% deposit', amount: Math.round(proposalTotal * 0.5), checked: true,
      }];
    }
    return [];
  });
  const [busy, setBusy] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState(null);
  // ref shadow so onDrop reads the live value, not the stale closure value.
  // React state updates from onDragStart aren't visible to onDrop's render
  // when the events fire close together — the ref bypasses that race.
  const dragIdxRef = React.useRef(null);

  const total = React.useMemo(() => {
    let t = 0;
    for (const li of lineItems) {
      if (li.kind === 'discount') {
        if (li.discountType === 'percent') t -= Math.round(t * (Number(li.amount) || 0) / 100);
        else                                 t -= Number(li.amount) || 0;
      } else {
        t += Number(li.amount) || 0;
      }
    }
    return Math.max(0, Math.round(t));
  }, [lineItems]);

  const hasDiscount = lineItems.some(li => li.kind === 'discount');
  const addItem = () => setLineItems(prev => [...prev, {
    id: 'i_' + Math.random().toString(36).slice(2,8),
    kind: 'item', name: '', amount: 0, checked: true,
  }]);
  const addDiscount = () => {
    if (hasDiscount) return;
    setLineItems(prev => [...prev, {
      id: 'd_' + Math.random().toString(36).slice(2,8),
      kind: 'discount', name: 'Discount', discountType: 'dollar', amount: 0, checked: true,
    }]);
  };
  const updateItem = (i, patch) => setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, ...patch } : li));
  const removeItem = (i) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const moveItem = (from, to) => setLineItems(prev => {
    if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
    const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next;
  });

  // Quick presets — replace current line items with the preset.
  const applyPreset = (kind) => {
    const id = () => 'i_' + Math.random().toString(36).slice(2,8);
    if (kind === 'deposit' && proposalTotal > 0) {
      setLineItems([{ id: id(), kind: 'item', name: '50% deposit', amount: Math.round(proposalTotal * 0.5), checked: true }]);
    } else if (kind === 'final') {
      setLineItems([{ id: id(), kind: 'item', name: 'Final balance', amount: Math.round(remaining), checked: true }]);
    } else if (kind === 'balance') {
      setLineItems([{ id: id(), kind: 'item', name: 'Balance due', amount: 0, checked: true }]);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (total <= 0) {
      window.showToast?.('Total must be greater than 0');
      return;
    }
    if (!isEdit && contact.do_not_contact) {
      window.showToast?.('Marked do not contact — cannot send');
      return;
    }
    if (!CRM.__db || !CRM.__invokeFn) {
      window.showToast?.('Supabase not loaded');
      return;
    }
    setBusy(true);
    try {
      // Stored line_items keep the kind/discountType so editor can rehydrate.
      const storedItems = lineItems.map(li => ({
        id: li.id, kind: li.kind, name: li.name || '',
        amount: Number(li.amount) || 0,
        checked: li.checked !== false,
        discountType: li.discountType || undefined,
      }));
      const payload = {
        contact_id: contact.id,
        proposal_id: latestSignedProposal?.id || (isEdit ? ei.proposal_id || null : null),
        contact_name:    contact.name    || '',
        contact_email:   contact.email   || '',
        contact_phone:   contact.phone   || '',
        contact_address: contact.address || '',
        creator_version: 'v3',
        line_items: storedItems,
        total,
      };
      let data, error;
      if (isEdit) {
        ({ data, error } = await CRM.__db.from('invoices').update(payload).eq('id', ei.id).select().single());
      } else {
        // Initial status 'draft' so the invoice doesn't surface as a live
        // bill before Key actually sends it. The Send button on the
        // FinanceRow flips status='unpaid' and dispatches SMS.
        ({ data, error } = await CRM.__db.from('invoices').insert([{ ...payload, status: 'draft' }]).select().single());
      }
      if (error || !data) {
        window.showToast?.(`${isEdit ? 'Update' : 'Create'} failed: ${error?.message || 'unknown'}`);
        setBusy(false);
        return;
      }
      // Optimistically push the new invoice into CRM.invoices so it shows
      // up immediately. Realtime would do this eventually but there's a
      // gap where the modal closes and the row hasn't materialized yet.
      const cents = Math.round(Number(data.total) * 100);
      const mapped = {
        id: data.id, token: data.token, contact_id: data.contact_id,
        proposal_id: data.proposal_id || null,
        amount_cents: cents,
        kind: data.kind || (cents >= 150000 ? 'final' : 'deposit'),
        status: isEdit ? (data.status === 'unpaid' ? 'sent' : (data.status||'sent').toLowerCase()) : 'draft',
        sent_at: data.sent_at || data.created_at,
        viewed_at: data.viewed_at || null,
        paid_at: data.paid_at || null,
        line_items: Array.isArray(data.line_items) ? data.line_items : [],
        creator_version: data.creator_version || 'v3',
      };
      const arr = (window.CRM.invoices = window.CRM.invoices || []);
      const idx = arr.findIndex(i => i.id === mapped.id);
      if (idx >= 0) arr[idx] = mapped; else arr.unshift(mapped);
      window.dispatchEvent(new CustomEvent('crm-data-changed'));
      window.showToast?.(isEdit ? 'Invoice updated' : 'Invoice created');
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

  const renderLineRow = (li, i) => {
    const isDiscount = li.kind === 'discount';
    return (
      <div
        key={li.id}
        draggable
        onDragStart={() => { dragIdxRef.current = i; setDragIdx(i); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = dragIdxRef.current;
          if (from != null) moveItem(from, i);
          dragIdxRef.current = null;
          setDragIdx(null);
        }}
        onDragEnd={() => { dragIdxRef.current = null; setDragIdx(null); }}
        style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'9px 10px',
          background: isDiscount ? '#FFF8E0' : 'white',
          border: '1px solid ' + (isDiscount ? GOLD : 'rgba(11,31,59,0.10)'),
          borderRadius:8,
          opacity: dragIdx === i ? 0.5 : 1,
          boxShadow: dragIdx === i ? 'none' : (isDiscount
            ? '0 1px 2px rgba(255,186,0,0.18)'
            : '0 1px 2px rgba(11,31,59,0.05)'),
          cursor: dragIdx === i ? 'grabbing' : 'default',
          transition:'box-shadow 120ms, opacity 120ms',
        }}
      >
        <span title="Drag to reorder" style={{ cursor:'grab', color:'#9CA3AF', userSelect:'none', fontSize:15, padding:'0 2px', letterSpacing:'-0.05em' }}>⋮⋮</span>
        {isDiscount ? (
          <span style={{ display:'inline-flex', gap:1, background:'rgba(11,31,59,0.06)', padding:2, borderRadius:6, marginRight:2 }}>
            <button type="button" onClick={() => updateItem(i, { discountType: 'dollar' })} style={{
              padding:'4px 8px', border:'none', borderRadius:5,
              background: li.discountType === 'dollar' ? GOLD : 'transparent',
              color: li.discountType === 'dollar' ? NAVY : '#6B7280',
              fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'inherit', minWidth:22,
            }}>$</button>
            <button type="button" onClick={() => updateItem(i, { discountType: 'percent' })} style={{
              padding:'4px 8px', border:'none', borderRadius:5,
              background: li.discountType === 'percent' ? GOLD : 'transparent',
              color: li.discountType === 'percent' ? NAVY : '#6B7280',
              fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'inherit', minWidth:22,
            }}>%</button>
          </span>
        ) : (
          <input
            type="checkbox"
            checked={li.checked !== false}
            onChange={(e) => updateItem(i, { checked: e.target.checked })}
            title="Pre-checked for client"
            style={{ width:16, height:16, accentColor: NAVY, flexShrink:0, cursor:'pointer' }}
          />
        )}
        <input
          type="text"
          value={li.name}
          onChange={(e) => updateItem(i, { name: e.target.value })}
          placeholder={isDiscount ? 'Discount label' : 'Line item'}
          style={{ flex:1, minWidth:0, padding:'5px 6px', border:'none', background:'transparent',
                   fontSize:13, color:NAVY, fontFamily:'inherit', outline:'none', fontWeight:500 }}
        />
        <span style={{ color:'#9CA3AF', fontSize:13, fontWeight:600 }}>{isDiscount ? '−$' : '$'}</span>
        <input
          type="number" inputMode="decimal" min="0" step="1"
          value={li.amount}
          onChange={(e) => updateItem(i, { amount: parseFloat(e.target.value) || 0 })}
          style={{ width:64, padding:'5px 8px', border:'1px solid rgba(11,31,59,0.10)', borderRadius:6,
                   fontSize:13, textAlign:'right', fontWeight:700, color:NAVY,
                   fontFamily:"'JetBrains Mono','DM Mono',monospace", background:'white' }}
        />
        <button type="button" onClick={() => removeItem(i)} aria-label="Remove" style={{
          background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', padding:'4px 6px',
          fontSize:14, lineHeight:1, fontFamily:'inherit', borderRadius:4,
        }}>✕</button>
      </div>
    );
  };

  const formBody = (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Reference proposal */}
      {latestSignedProposal ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:BG, borderRadius:8 }}>
          <span style={{ fontSize:12, color:'#666' }}>Linked to approved proposal</span>
          <span style={{ fontSize:12, fontWeight:600, color:NAVY, fontFamily:"'DM Mono', monospace" }}>${proposalTotal.toLocaleString()}</span>
        </div>
      ) : !isEdit && (
        <div style={{ padding:'8px 12px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
          No approved proposal — use Balance preset for custom amount.
        </div>
      )}
      {/* Quick presets (skip on edit) */}
      {!isEdit && (
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Quick preset</div>
          <div style={{ display:'flex', gap:8 }}>
            <Seg on={false} onClick={() => applyPreset('deposit')} label="Deposit" sub="50%" />
            <Seg on={false} onClick={() => applyPreset('final')}   label="Final"   sub="Remainder" />
            <Seg on={false} onClick={() => applyPreset('balance')} label="Balance" sub="Custom" />
          </div>
        </div>
      )}
      {/* Line items + discount */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em' }}>Line items</span>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom: lineItems.length > 0 ? 8 : 0 }}>
          <button type="button" onClick={addItem} style={{
            flex:1, height:36, padding:'0 12px', borderRadius:8, background:'white',
            border:'1px dashed rgba(11,31,59,0.25)', color:'#666',
            fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>+ Line Item</button>
          <button type="button" onClick={addDiscount} disabled={hasDiscount} style={{
            flex:1, height:36, padding:'0 12px', borderRadius:8,
            background: hasDiscount ? '#F5F5F5' : 'white',
            border:'1px dashed rgba(11,31,59,0.25)',
            color: hasDiscount ? '#bbb' : '#666',
            fontSize:12, fontWeight:600, fontFamily:'inherit',
            cursor: hasDiscount ? 'not-allowed' : 'pointer',
          }}>+ Discount</button>
        </div>
        {lineItems.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {lineItems.map((li, i) => renderLineRow(li, i))}
          </div>
        )}
      </div>
    </div>
  );

  const footerRow = (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      padding:'10px 12px', borderRadius:8, background:'#F9FAFB',
      borderTop:`2px solid ${NAVY}`,
    }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em' }}>Total</div>
        <div style={{ fontSize:24, fontWeight:700, color:NAVY, fontFamily:"'JetBrains Mono','DM Mono',monospace", letterSpacing:'-0.01em' }}>${total.toLocaleString()}</div>
      </div>
      <button
        onClick={submit}
        disabled={busy || (!isEdit && contact.do_not_contact) || total <= 0}
        style={{
          height:42, padding:'0 18px', borderRadius:8,
          background: busy || (!isEdit && contact.do_not_contact) || total <= 0 ? '#E5E5E5' : '#ffba00',
          color: busy || (!isEdit && contact.do_not_contact) || total <= 0 ? '#999' : NAVY,
          border:'none', fontSize:14, fontWeight:700, fontFamily:'inherit',
          cursor: busy || (!isEdit && contact.do_not_contact) || total <= 0 ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', gap:7,
          boxShadow: busy || (!isEdit && contact.do_not_contact) || total <= 0 ? 'none' : '0 1px 2px rgba(255,186,0,0.3)',
        }}
      >
        {busy ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create invoice')}
        {!busy && !(!isEdit && contact.do_not_contact) && total > 0 && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
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
            {isEdit ? 'Edit invoice' : (latestSignedProposal ? 'Generate invoice' : 'New invoice')}
          </div>
          <button onClick={onClose} aria-label="Cancel" style={{
            // Audit-2026-05-09 a11y M4: 32×32 → 44×44.
            width:44, height:44, borderRadius:6, border:'none', background:'transparent',
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
      title={`${isEdit ? 'Edit invoice' : 'New invoice'} — ${contact.name || formatPhone(contact.phone)}`}
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

// ── ActivityTimelineCard ──────────────────────────────────────────────
// Unified chronological feed: every message, call, proposal change,
// invoice change, calendar event, and stage transition for a contact —
// in one timeline. Lets Key reconstruct a deal's full history without
// hopping between tabs. Collapsed-by-default, expand on click.
function ActivityTimelineCard({ contact, messages = [], calls = [], proposals = [], invoices = [], events = [], onOpenTab }) {
  const [expanded, setExpanded] = React.useState(false);
  const stageHistory = (window.CRM?.stageHistory || []).filter(r => r.contact_id === contact.id);

  // Build a flat list of {at, type, label, meta, color, action}.
  const items = React.useMemo(() => {
    const out = [];
    // Messages
    for (const m of messages) {
      const at = m.created_at || m.sent_at || m.received_at;
      if (!at) continue;
      const dir = m.direction === 'in' ? 'in' : 'out';
      out.push({
        at, type:'message',
        label: dir === 'in' ? 'Inbound message' : 'Outbound message',
        meta: (m.body || '').slice(0, 70) + ((m.body || '').length > 70 ? '…' : ''),
        color: dir === 'in' ? '#1E40AF' : '#065F46',
        icon: dir === 'in' ? '📥' : '📤',
        onClick: () => onOpenTab?.('messages'),
      });
    }
    // Calls
    for (const c of calls) {
      const at = c.created_at || c.started_at;
      if (!at) continue;
      const direction = c.direction || 'unknown';
      const isMissed = direction === 'missed' || c.status === 'missed';
      out.push({
        at, type:'call',
        label: isMissed ? 'Missed call' : direction === 'in' ? 'Inbound call' : direction === 'out' ? 'Outbound call' : 'Call',
        meta: c.duration_sec > 0 ? formatDuration(c.duration_sec) : (c.status || ''),
        color: isMissed ? '#991B1B' : '#065F46',
        icon: isMissed ? '📵' : '📞',
        onClick: () => onOpenTab?.('calls'),
      });
    }
    // Proposals
    for (const p of proposals) {
      if (p.created_at) out.push({
        at: p.created_at, type:'proposal',
        label: 'Quote drafted',
        meta: p.amp_spec ? `${p.amp_spec}A` : '',
        color: '#666',
        icon: '📝',
        onClick: () => onOpenTab?.('finance'),
      });
      if (p.sent_at) out.push({
        at: p.sent_at, type:'proposal',
        label: 'Quote sent',
        meta: p.amp_spec ? `${p.amp_spec}A` : '',
        color: '#1E40AF',
        icon: '📤',
        onClick: () => onOpenTab?.('finance'),
      });
      if (p.viewed_at) out.push({
        at: p.viewed_at, type:'proposal',
        label: 'Quote viewed',
        meta: 'Customer opened proposal',
        color: '#1E40AF',
        icon: '👀',
        onClick: () => onOpenTab?.('finance'),
      });
      if (p.approved_at) out.push({
        at: p.approved_at, type:'proposal',
        label: 'Quote approved',
        meta: '',
        color: '#065F46',
        icon: '✅',
        onClick: () => onOpenTab?.('finance'),
      });
      if (p.cancelled_at || p.cancellation_at) out.push({
        at: p.cancelled_at || p.cancellation_at, type:'proposal',
        label: 'Quote cancelled',
        meta: p.cancellation_reason || '',
        color: '#991B1B',
        icon: '❌',
        onClick: () => onOpenTab?.('finance'),
      });
    }
    // Invoices
    for (const inv of invoices) {
      if (inv.created_at) out.push({
        at: inv.created_at, type:'invoice',
        label: 'Invoice drafted',
        meta: formatMoneyCents(inv.amount_cents || 0),
        color: '#666',
        icon: '📄',
        onClick: () => onOpenTab?.('finance'),
      });
      if (inv.sent_at) out.push({
        at: inv.sent_at, type:'invoice',
        label: 'Invoice sent',
        meta: formatMoneyCents(inv.amount_cents || 0),
        color: '#1E40AF',
        icon: '📨',
        onClick: () => onOpenTab?.('finance'),
      });
      if (inv.paid_at) out.push({
        at: inv.paid_at, type:'invoice',
        label: 'Invoice paid',
        meta: formatMoneyCents(inv.amount_cents || 0),
        color: '#065F46',
        icon: '💰',
        onClick: () => onOpenTab?.('finance'),
      });
      if (inv.voided_at) out.push({
        at: inv.voided_at, type:'invoice',
        label: 'Invoice voided',
        meta: '',
        color: '#991B1B',
        icon: '🚫',
        onClick: () => onOpenTab?.('finance'),
      });
    }
    // Calendar events
    for (const e of events) {
      if (!e.start_at) continue;
      out.push({
        at: e.created_at || e.start_at, type:'event',
        label: capitalize(e.kind || 'event') + (e.status === 'cancelled' ? ' cancelled' : ' scheduled'),
        meta: formatDate(e.start_at) + ' ' + (e.start_at ? formatTime(e.start_at) : ''),
        color: e.status === 'cancelled' ? '#991B1B' : '#92400E',
        icon: e.status === 'cancelled' ? '🚫' : '📅',
        onClick: () => onOpenTab?.('calendar'),
      });
    }
    // Stage transitions
    for (const r of stageHistory) {
      if (!r.changed_at) continue;
      const fromLbl = (window.CRM?.STAGE_LABELS || {})[(window.CRM?.STAGE_NUM_TO_STR || {})[r.from_stage]] || `Stage ${r.from_stage}`;
      const toLbl = (window.CRM?.STAGE_LABELS || {})[(window.CRM?.STAGE_NUM_TO_STR || {})[r.to_stage]] || `Stage ${r.to_stage}`;
      out.push({
        at: r.changed_at, type:'stage',
        label: 'Stage changed',
        meta: `${fromLbl} → ${toLbl}`,
        color: '#1E40AF',
        icon: '🔁',
      });
    }
    out.sort((a, b) => new Date(b.at) - new Date(a.at));
    return out;
  }, [messages, calls, proposals, invoices, events, stageHistory.length, contact.id]);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 5);

  return (
    <InfoSection title={`Activity (${items.length})`} editAction={null}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {visible.map((it, i) => (
          <button
            key={i}
            onClick={it.onClick}
            disabled={!it.onClick}
            style={{
              display:'flex', gap:10, alignItems:'flex-start',
              background:'none', border:'none', textAlign:'left',
              padding:'4px 0', fontFamily:'inherit',
              cursor: it.onClick ? 'pointer' : 'default',
              borderRadius:6,
            }}
            onMouseEnter={e => { if (it.onClick) e.currentTarget.style.background = '#F8F8F6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <span style={{ fontSize:14, lineHeight:'18px', flexShrink:0, width:18 }}>{it.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:600, color: it.color }}>{it.label}</span>
                <span style={{ fontSize:11, color: MUTED, fontVariantNumeric:'tabular-nums' }}>{formatRelative(it.at)}</span>
              </div>
              {it.meta && (
                <div style={{ fontSize:12, color:'#444', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.meta}</div>
              )}
            </div>
          </button>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop:8, fontSize:11, fontWeight:600, color: NAVY,
            background:'none', border:'none', cursor:'pointer', padding:'4px 0',
            textTransform:'uppercase', letterSpacing:'0.04em',
          }}
        >{expanded ? 'Show less ↑' : `Show ${items.length - 5} more ↓`}</button>
      )}
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
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="street-address"
        style={style}
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
        {/* Audit-2026-05-09 a11y M5: each input wrapped in <label> so
            tap-on-label focuses the input and screen readers associate
            them. Same pattern as ContactNotesSection edit form. */}
        <label style={{ display:'block', cursor:'text' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Name</div>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) { e.preventDefault(); submit(); } }}
            placeholder="Full name" autoComplete="name" autoCapitalize="words" autoFocus style={inputStyle} />
        </label>
        <label style={{ display:'block', cursor:'text' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Phone</div>
          <input value={phone} onChange={e=>setPhone(formatPhoneInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) { e.preventDefault(); submit(); } }}
            placeholder="(864) 555-0192" type="tel" inputMode="tel" autoComplete="tel" style={inputStyle} />
        </label>
        <label style={{ display:'block', cursor:'text' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Address (optional)</div>
          <AddressAutocomplete value={address} onChange={setAddress} placeholder="123 Main St, Spartanburg" style={inputStyle} />
        </label>
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
        {/* Audit-2026-05-09 a11y M5: <label> wrap on each form control. */}
        <label style={{ display:'block', cursor:'pointer' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Contact</div>
          <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
            <option value="">— pick a contact —</option>
            {pickable.map(c => <option key={c.id} value={c.id}>{c.name || formatPhone(c.phone) || c.id.slice(0,4)}</option>)}
          </select>
        </label>
        <label style={{ display:'block', cursor:'pointer' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#666', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Kind</div>
          <select value={kind} onChange={e => setKind(e.target.value)} style={inputStyle}>
            {KIND_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </label>
        <DatePresetRow value={date} onChange={setDate} />
        <div style={{ display:'flex', gap:8 }}>
          <input type="date" aria-label="Event date" value={date} min={todayMin} max="2099-12-31" onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }} />
          <input type="time" aria-label="Event time" value={time} step="900" onChange={e => setTime(e.target.value)} style={{ ...inputStyle, flex:'1 1 0', minWidth:0 }} />
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
