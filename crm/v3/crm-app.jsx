// crm-app.jsx — Root component + mount

// SignInGate — direct email/password sign-in into the same Supabase
// project. Replaces the prior "go sign in on v2 first" splash since v2
// is being retired. After a successful sign-in the page reloads so the
// data loader runs from scratch with the new session.
function SignInGate() {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setErr('');
    if (!email.trim() || !pw) { setErr('Email and password required'); return; }
    if (!window.CRM?.__db) { setErr('Supabase not loaded — refresh and try again'); return; }
    setBusy(true);
    try {
      const { error } = await window.CRM.__db.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });
      if (error) {
        setErr(error.message || 'Sign in failed');
        setBusy(false);
        return;
      }
      // Fresh page so the data loader picks up the new session cleanly.
      window.location.reload();
    } catch (e2) {
      setErr(String(e2?.message || e2));
      setBusy(false);
    }
  };

  return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f6f9', fontFamily:'DM Sans', padding:24 }}>
      <form onSubmit={submit} style={{
        background:'white', border:'1px solid rgba(11,31,59,0.10)', borderRadius:12,
        padding:'28px 24px', maxWidth:360, width:'100%',
        boxShadow:'0 8px 24px rgba(11,31,59,0.06)',
        display:'flex', flexDirection:'column', gap:14,
      }}>
        <div style={{ textAlign:'center', fontSize:22, fontWeight:700, color:'#0b1f3b', marginBottom:4 }}>
          BPP CRM
        </div>
        <div style={{ textAlign:'center', fontSize:13, color:'#6B7280', marginBottom:6 }}>
          Sign in to continue
        </div>
        <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            style={{ height:44, padding:'0 12px', border:'1.5px solid #EBEBEA', borderRadius:8, fontSize:16, color:'#0b1f3b', outline:'none', fontFamily:'inherit', background:'white' }}
          />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={busy}
            style={{ height:44, padding:'0 12px', border:'1.5px solid #EBEBEA', borderRadius:8, fontSize:16, color:'#0b1f3b', outline:'none', fontFamily:'inherit', background:'white' }}
          />
        </label>
        {err && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#991B1B', padding:'8px 12px', borderRadius:8, fontSize:12 }}>
            {err}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            height:46, marginTop:6, borderRadius:8,
            background: busy ? '#E5E5E5' : '#ffba00',
            color: busy ? '#999' : '#0b1f3b',
            border:'none', fontSize:15, fontWeight:700, fontFamily:'inherit',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function Root() {
  // Live-data load state — flips true after crm-data.js dispatches 'crm-data-ready'.
  const [loaded, setLoaded] = React.useState(window.CRM?.loaded === true);
  const [authed, setAuthed] = React.useState(window.CRM?.authed === true);
  React.useEffect(() => {
    const onReady = (e) => {
      setLoaded(true);
      setAuthed(!!e.detail?.authed);
      // One-time backfill: migrate any localStorage tags map → contacts.tags
      // Same bug class as the pin backfill below — caught by audit-crm
      // 2026-05-09. Idempotent: subsequent loads find an empty key
      // and no-op.
      try {
        const tagRaw = localStorage.getItem('bpp_v3_tags');
        if (tagRaw) {
          const map = JSON.parse(tagRaw);
          if (map && typeof map === 'object') {
            const liveContacts = window.CRM?.contacts || [];
            const writes = [];
            for (const [cid, tags] of Object.entries(map)) {
              if (!Array.isArray(tags) || tags.length === 0) continue;
              const c = liveContacts.find(x => x.id === cid);
              if (!c) continue;
              const merged = Array.from(new Set([...(c.tags || []), ...tags]));
              if (merged.length === (c.tags || []).length) continue;
              c.tags = merged; // optimistic
              writes.push(window.CRM?.__db?.from('contacts').update({ tags: merged }).eq('id', cid));
            }
            if (writes.length > 0) {
              Promise.all(writes).then((results) => {
                const failed = results.filter(r => r && r.error);
                if (failed.length === 0) {
                  localStorage.removeItem('bpp_v3_tags');
                  console.log(`[CRM] migrated tags on ${writes.length} contacts from localStorage to DB`);
                } else {
                  console.warn('[CRM] tags backfill partial:', failed.length, 'of', writes.length, 'failed');
                }
                window.dispatchEvent(new CustomEvent('crm-data-changed'));
                window.dispatchEvent(new CustomEvent('crm-tags-changed'));
              });
            } else {
              localStorage.removeItem('bpp_v3_tags');
            }
          } else {
            localStorage.removeItem('bpp_v3_tags');
          }
        }
      } catch (err) {
        console.warn('[CRM] tags backfill error:', err?.message || err);
      }

      // One-time backfill: migrate any localStorage pins → contacts.pinned
      // so users who starred contacts before the column existed don't
      // lose their pins. Runs once at first load after this ships;
      // subsequent loads find an empty localStorage and no-op.
      try {
        const raw = localStorage.getItem('bpp_v3_pinned_contacts');
        if (!raw) return;
        const ids = JSON.parse(raw);
        if (!Array.isArray(ids) || ids.length === 0) {
          localStorage.removeItem('bpp_v3_pinned_contacts');
          return;
        }
        // Only backfill ids whose live contact row isn't already pinned.
        const liveContacts = window.CRM?.contacts || [];
        const toUpdate = ids.filter(id => {
          const c = liveContacts.find(x => x.id === id);
          return c && !c.pinned;
        });
        if (toUpdate.length > 0 && window.CRM?.__db) {
          window.CRM.__db.from('contacts')
            .update({ pinned: true })
            .in('id', toUpdate)
            .then(({ error }) => {
              if (error) {
                console.warn('[CRM] pinned backfill failed (will retry next load):', error.message);
                return;
              }
              // Mirror into local state so the UI updates immediately
              for (const id of toUpdate) {
                const c = liveContacts.find(x => x.id === id);
                if (c) c.pinned = true;
              }
              window.dispatchEvent(new CustomEvent('crm-pin-changed'));
              window.dispatchEvent(new CustomEvent('crm-data-changed'));
              localStorage.removeItem('bpp_v3_pinned_contacts');
              console.log(`[CRM] migrated ${toUpdate.length} pinned contacts from localStorage to DB`);
            });
        } else {
          // Either nothing to migrate or every id was already pinned in
          // DB. Either way, drop the localStorage record so we don't
          // keep retrying.
          localStorage.removeItem('bpp_v3_pinned_contacts');
        }
      } catch (err) {
        console.warn('[CRM] pinned backfill error:', err?.message || err);
      }
    };
    window.addEventListener('crm-data-ready', onReady);
    return () => window.removeEventListener('crm-data-ready', onReady);
  }, []);
  // Realtime: bump on any data change (contacts/messages) so derived views re-render.
  React.useEffect(() => {
    const onChange = () => setBump(n => n + 1);
    window.addEventListener('crm-data-changed', onChange);
    return () => window.removeEventListener('crm-data-changed', onChange);
  }, []);

  // Left panel has its own tab state
  const [leftTab, setLeftTab] = React.useState('contacts');

  // EmptyHero (right-pane "Today" dashboard) dispatches navigation
  // events when a tile is clicked. Route them to the matching left-pane
  // lens here at the Root level since EmptyHero doesn't have direct
  // access to setLeftTab.
  React.useEffect(() => {
    const onAction = (e) => {
      const lens = e?.detail?.lens;
      if (lens === 'today')   setLeftTab('calendar');
      else if (lens === 'inbox') setLeftTab('messages');
      else if (lens === 'rotting') {
        setLeftTab('contacts');
        // Defer so ContactsList re-mounts with the chip selected.
        setTimeout(() => window.dispatchEvent(new CustomEvent('crm-set-stage-filter', { detail: { stage: 'rotting' } })), 30);
      }
    };
    window.addEventListener('crm-empty-hero-action', onAction);
    return () => window.removeEventListener('crm-empty-hero-action', onAction);
  }, []);

  // v10.1.16 mobile fix: when the user navigates between tabs, blur any
  // active text input so the iOS keyboard dismisses. Without this, leaving
  // Messages while a textarea has focus leaves the keyboard floating over
  // the next tab. Affects keyboard, autoFocus, AND helps when accessibility
  // services have stuck focus.
  // v10.1.17: blur on mobileView change too, not just leftTab. The keyboard
  // was sticking when swiping from Messages (right pane) back to Contacts
  // (left pane) because the textarea retained focus across the pane swap.

  // URL state: hydrate active contact + right-tab from query string on
  // first load. Pull-to-refresh on iOS Safari, accidental tab close, or
  // a shared link can then restore the prior context. Format:
  //   ?c=<contactId>&t=<rightTab>&lt=<leftTab>
  // Match the NavBar order — Contact, Messages, Finance, Calendar, Phone.
  const VALID_TABS = ['contacts','messages','finance','calendar','calls'];
  const initialQuery = React.useMemo(() => {
    if (typeof window === 'undefined') return {};
    const p = new URLSearchParams(window.location.search);
    // Reject unknown tab values from URL — `?t=garbage` would render
    // a blank right pane otherwise.
    const t = p.get('t');
    const lt = p.get('lt');
    return {
      c: p.get('c'),
      t: VALID_TABS.includes(t) ? t : null,
      lt: VALID_TABS.includes(lt) ? lt : null,
    };
  }, []);
  // Right panel has its own tab state, independent
  const [rightTab, setRightTab] = React.useState(() => initialQuery.t || 'contacts');
  const [activeContact, setActiveContact] = React.useState(() => initialQuery.c || null);
  React.useEffect(() => {
    if (initialQuery.lt) setLeftTab(initialQuery.lt);
  }, []);
  // Auto-pick the first contact once data lands. Skip if a contact is
  // already chosen via URL state.
  React.useEffect(() => {
    if (loaded && authed && !activeContact && CRM.contacts.length > 0) {
      setActiveContact(CRM.contacts[0].id);
    }
  }, [loaded, authed, activeContact]);
  // Validate the URL-provided contact id once data has loaded — if the
  // contact was archived or deleted, fall back to the first contact and
  // surface a toast so a stale shared link doesn't silently switch the
  // operator to a different contact mid-conversation.
  React.useEffect(() => {
    if (!loaded || !activeContact) return;
    const exists = CRM.contacts.some(c => c.id === activeContact);
    if (!exists) {
      // Only toast when the URL was hydrated from query string (vs the
      // auto-pick-first effect above writing to it) — avoid noise on
      // first load when the contact list briefly empty-states.
      if (initialQuery.c === activeContact) {
        window.showToast?.('Contact not found — opened first instead');
      }
      setActiveContact(CRM.contacts[0]?.id || null);
    }
  }, [loaded, activeContact]);
  // Sync URL on every state change. Use replaceState to avoid clogging
  // history (back-button still navigates the underlying domain).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (activeContact) p.set('c', activeContact); else p.delete('c');
    if (rightTab && rightTab !== 'contacts') p.set('t', rightTab); else p.delete('t');
    if (leftTab && leftTab !== 'contacts') p.set('lt', leftTab); else p.delete('lt');
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? '?' + qs : ''}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', next);
    }
  }, [activeContact, rightTab, leftTab]);
  const [highlightId, setHighlightId] = React.useState(null);
  // Force re-render after in-place CRM mutations (archive / DNC / delete)
  const [bump, setBump] = React.useState(0);
  const bumpData = React.useCallback(() => setBump(n => n + 1), []);
  // Mobile: 'left' or 'right'
  const [mobileView, setMobileView] = React.useState('left');
  // v10.1.17 mobile fix: blur the focused input whenever the user changes
  // tab OR swaps panes, so the iOS keyboard dismisses. Without this, leaving
  // Messages while the textarea has focus leaves the keyboard floating over
  // the Contacts list (Key feedback 2026-05-04).
  React.useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [leftTab, mobileView]);
  const [dncSet, setDncSet] = React.useState(new Set());
  // Seed dncSet from the DB-flagged contacts so the UI's compose-bar lock,
  // DNC pill, and call-button gate match reality. Refresh on every realtime
  // tick because contact.do_not_contact can change from another tab/source.
  // This is TCPA-compliance-critical — without seeding, a do_not_contact
  // contact appears messageable in the UI even though sends are blocked.
  React.useEffect(() => {
    const sync = () => {
      const next = new Set((window.CRM?.contacts || []).filter(c => c.do_not_contact).map(c => c.id));
      setDncSet(prev => {
        // Same membership? skip — prevents needless re-renders.
        if (prev.size === next.size && [...prev].every(id => next.has(id))) return prev;
        return next;
      });
    };
    sync();
    const onChanged = () => sync();
    window.addEventListener('crm-data-changed', onChanged);
    window.addEventListener('crm-data-ready', onChanged);
    return () => {
      window.removeEventListener('crm-data-changed', onChanged);
      window.removeEventListener('crm-data-ready', onChanged);
    };
  }, []);
  // Responsive: pick a layout based on viewport. Re-renders on resize.
  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const toggleDnc = id => {
    const isOn = dncSet.has(id);
    setDncSet(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    window.showToast?.(isOn ? 'Do-not-contact removed' : 'Marked do-not-contact');
  };

  // Recompute on every render so realtime updates flow through. Cheap — these
  // are tiny array filters over <500 rows. Hardcoded date string was a v1 demo
  // leftover; using TODAY (which is reset on every page load).
  // Local-timezone YYYY-MM-DD — toISOString() returns UTC and silently
  // shifts to "tomorrow" every evening after 8 PM EDT.
  const todayStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);
  // Left navbar shows GLOBAL counts across all contacts — that's the
  // inbox-style badge ("how much work is on my plate?").
  const badgeCounts = {
    messages: CRM.messages.filter(m => m.direction === 'in' && m.read_at == null).length,
    // Calls badge = unheard voicemails (listened_at == null). Otherwise
    // the badge stays lit forever and loses signal value.
    calls: CRM.calls.filter(c => c.voicemail_url && c.listened_at == null).length,
    calendar: CRM.events.filter(e => (e.start_at || '').slice(0,10) === todayStr && e.status === 'scheduled').length,
    finance: CRM.invoices.filter(i => i.status === 'overdue').length,
  };
  // Right navbar is per-contact — sharing the global object made every
  // contact's tab show 396 unread even when that contact had zero. Scope
  // each count to the active contact id; falls back to {} when no contact
  // is selected so we don't render misleading badges on the empty state.
  const contactBadgeCounts = React.useMemo(() => {
    if (!activeContact) return {};
    return {
      messages: CRM.messages.filter(m =>
        m.contact_id === activeContact && m.direction === 'in' && m.read_at == null
      ).length,
      calls: CRM.calls.filter(c =>
        c.contact_id === activeContact && c.voicemail_url && c.listened_at == null
      ).length,
      calendar: CRM.events.filter(e =>
        e.contact_id === activeContact && (e.start_at || '').slice(0,10) === todayStr && e.status === 'scheduled'
      ).length,
      finance: CRM.invoices.filter(i =>
        i.contact_id === activeContact && i.status === 'overdue'
      ).length,
    };
  }, [activeContact, bump, todayStr]);

  // Tapping a row opens the contact on the right, switches right tab to match context
  const handleOpen = (contactId, openTab, targetId) => {
    setActiveContact(contactId);
    if (openTab) setRightTab(openTab);
    setMobileView('right');
    // Recently-viewed: keep the last 6 in localStorage, most-recent first.
    // ContactsList renders a pill row from this so Key can re-open a
    // contact he just had open without re-searching.
    try {
      const KEY = 'bpp_v3_recent_contacts';
      const prev = JSON.parse(localStorage.getItem(KEY) || '[]').filter(id => id !== contactId);
      const next = [contactId, ...prev].slice(0, 6);
      window.safeSetItem?.(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('crm-recent-changed'));
    } catch {}
    if (targetId) {
      setHighlightId(targetId);
      setTimeout(() => {
        const el = document.querySelector(`[data-target-id="${targetId}"]`);
        if (el && el.parentElement) {
          const scrollParent = el.closest('[style*="overflowY"]') || el.parentElement;
          const top = el.offsetTop - scrollParent.offsetTop - 40;
          if (scrollParent.scrollTo) scrollParent.scrollTo({ top, behavior:'smooth' });
        }
      }, 80);
      setTimeout(() => setHighlightId(null), 2200);
    }
  };

  // (contactName helper unused at root level; ContactStrip handles display)

  // Loading splash — shown until crm-data.js fires the ready event.
  if (!loaded) {
    return (
      <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f6f9', color:'#666', fontFamily:'DM Sans', fontSize:14 }}>
        Loading…
      </div>
    );
  }

  // Sign-in form — surfaced when no Supabase session is active.
  if (!authed) {
    return <SignInGate />;
  }

  // ?canvas=1 forces the side-by-side mobile+desktop preview (useful when
  // iterating on the design without two browser windows).
  const showCanvas = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('canvas') === '1';
  const isMobile = vw < 900;

  // ── Mobile production layout (full viewport, no device chrome) ──
  // v10.1.27: height: 100% rides on body which is sized to --vvh
  // (visualViewport.height) by index.html JS. When keyboard opens, body
  // shrinks → mobileApp shrinks → compose bar at panel bottom lands above
  // the keyboard automatically.
  const mobileApp = (
    <div style={{ height:'100%', flex:1, display:'flex', flexDirection:'column', background:'transparent', overflow:'hidden', minHeight:0 }}>
      {mobileView === 'left' ? (
        <NavBar tab={leftTab} onTab={(t) => { setLeftTab(t); setRightTab(t); }} badgeCounts={badgeCounts} />
      ) : (
        <NavBar
          tab={rightTab}
          onTab={t => { if (t === rightTab) setMobileView('left'); else setRightTab(t); }}
          badgeCounts={contactBadgeCounts}
          showBack
          onBack={() => setMobileView('left')}
        />
      )}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }} className="mobile-panel"
        onTouchStart={e => { window._swipeX = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - window._swipeX;
          // Swipe-right on the RIGHT pane goes back to the contact list
          // (matches iOS Mail's natural back gesture). The LEFT pane is
          // intentionally swipe-disabled — Key found left-pane swipes
          // misfired during list scroll on iPhone, switching panes when
          // he was just trying to scroll the contacts list.
          if (mobileView === 'right' && dx > 60) setMobileView('left');
        }}
      >
        <div style={{
          position:'absolute', inset:0, display:'flex',
          transform: mobileView === 'right' ? 'translateX(-50%)' : 'translateX(0)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          width:'200%',
        }}>
          <div style={{ width:'50%', height:'100%', overflow:'hidden', position:'relative', display:'flex', flexDirection:'column' }}>
            <LeftPanel tab={leftTab} onOpen={handleOpen} dncSet={dncSet} activeContactId={activeContact} />
          </div>
          <div style={{ width:'50%', height:'100%', overflow:'hidden', position:'relative', display:'flex', flexDirection:'column' }}>
            <RightPanel contactId={activeContact} tab={rightTab} dncSet={dncSet} toggleDnc={toggleDnc} highlightId={highlightId} bumpData={bumpData} onOpenTab={setRightTab} />
          </div>
        </div>
      </div>
      <ToastHost />
      <ConfirmHost />
    </div>
  );

  // ── Desktop production layout (full viewport split) ──
  // Left column 400px fixed (room for name + status pill + jurisdiction).
  // Right column fills the rest of the viewport — no empty bars on either side.
  const desktopApp = (
    <div style={{ height:'100%', flex:1, display:'flex', flexDirection:'row', background:'#f4f6f9', overflow:'hidden', minHeight:0 }}>
      <div style={{ width:480, borderRight:'1px solid rgba(11,31,59,0.12)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0, background:'#F8F8F6' }}>
        <NavBar tab={leftTab} onTab={(t) => { setLeftTab(t); setRightTab(t); }} badgeCounts={badgeCounts} compact />
        <LeftPanel tab={leftTab} onOpen={handleOpen} dncSet={dncSet} activeContactId={activeContact} />
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, background:'#F8F8F6' }}>
        <NavBar tab={rightTab} onTab={setRightTab} badgeCounts={contactBadgeCounts} compact />
        <RightPanel contactId={activeContact} tab={rightTab} dncSet={dncSet} toggleDnc={toggleDnc} highlightId={highlightId} bumpData={bumpData} onOpenTab={setRightTab} />
      </div>
      <ToastHost />
      <ConfirmHost />
    </div>
  );

  if (showCanvas) {
    // Side-by-side preview canvas (for design iteration only). Wrapped in
    // device-frame chrome to make the comparison feel intentional.
    return (
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#f4f6f9', overflow:'hidden', maxWidth:'100vw' }}>
        <div style={{ flex:1, display:'flex', overflow:'hidden', padding:20, gap:32, alignItems:'center', justifyContent:'center', maxWidth:'100vw' }}>
          <div style={{
            width:390, height:'calc(100dvh - 40px)', maxHeight:844,
            borderRadius:16, overflow:'hidden',
            border:'1px solid rgba(11,31,59,0.12)',
            display:'flex', flexDirection:'column', flexShrink:0,
            background:'white', position:'relative',
          }}>
            <div style={{ background: NAVY, height:44, display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'0 24px 8px', flexShrink:0 }}>
              <span style={{ color:'white', fontSize:13, fontWeight:600 }}>9:14</span>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                <svg width="16" height="12" viewBox="0 0 16 12" fill="white"><rect x="0" y="3" width="3" height="9" rx="1"/><rect x="4.5" y="2" width="3" height="10" rx="1"/><rect x="9" y="0" width="3" height="12" rx="1"/><rect x="13.5" y="1" width="2.5" height="11" rx="1" opacity="0.3"/></svg>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="white"><path d="M7.5 2C5 2 2.8 3.1 1.2 4.8L0 3.5C2 1.3 4.6 0 7.5 0s5.5 1.3 7.5 3.5L13.8 4.8C12.2 3.1 10 2 7.5 2z"/><path d="M7.5 5c-1.7 0-3.2.7-4.3 1.9L2 5.7C3.4 4.1 5.3 3 7.5 3s4.1 1.1 5.5 2.7L11.8 6.9C10.7 5.7 9.2 5 7.5 5z"/><circle cx="7.5" cy="10" r="2"/></svg>
                <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.35"/><rect x="2" y="2" width="16" height="8" rx="2" fill="white"/><path d="M23 4v4a2 2 0 0 0 0-4z" fill="white" fillOpacity="0.4"/></svg>
              </div>
            </div>
            {mobileApp}
          </div>
          <div style={{
            flex:1, height:'calc(100dvh - 40px)', maxHeight:844, maxWidth:900, minWidth:0,
            borderRadius:12, overflow:'hidden',
            border:'1px solid rgba(11,31,59,0.12)',
            display:'flex',
          }}>
            {desktopApp}
          </div>
        </div>
      </div>
    );
  }

  // Production: render only the layout that fits the viewport.
  return isMobile ? mobileApp : desktopApp;
}

// Start the scheduled-SMS queue runner once at app load. Idempotent —
// re-mounting (React strict-mode, hot-reload) won't double-init the
// poller. Reads/sends every 60s after a 5s initial delay.
window.startScheduledQueueRunner?.();

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
