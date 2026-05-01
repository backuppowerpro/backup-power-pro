// crm-app.jsx — Root component + mount

function Root() {
  // Live-data load state — flips true after crm-data.js dispatches 'crm-data-ready'.
  const [loaded, setLoaded] = React.useState(window.CRM?.loaded === true);
  const [authed, setAuthed] = React.useState(window.CRM?.authed === true);
  React.useEffect(() => {
    const onReady = (e) => {
      setLoaded(true);
      setAuthed(!!e.detail?.authed);
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
  // Right panel has its own tab state, independent
  const [rightTab, setRightTab] = React.useState('contacts');
  const [activeContact, setActiveContact] = React.useState(null);
  // Auto-pick the first contact once data lands.
  React.useEffect(() => {
    if (loaded && authed && !activeContact && CRM.contacts.length > 0) {
      setActiveContact(CRM.contacts[0].id);
    }
  }, [loaded, authed, activeContact]);
  const [highlightId, setHighlightId] = React.useState(null);
  // Force re-render after in-place CRM mutations (archive / DNC / delete)
  const [, setBump] = React.useState(0);
  const bumpData = React.useCallback(() => setBump(n => n + 1), []);
  // Mobile: 'left' or 'right'
  const [mobileView, setMobileView] = React.useState('left');
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
  const badgeCounts = {
    messages: CRM.messages.filter(m => m.direction === 'in' && m.read_at == null).length,
    calls: CRM.calls.filter(c => c.voicemail_url).length,
    calendar: CRM.events.filter(e => (e.start_at || '').slice(0,10) === todayStr && e.status === 'scheduled').length,
    finance: CRM.invoices.filter(i => i.status === 'overdue').length,
  };

  // Tapping a row opens the contact on the right, switches right tab to match context
  const handleOpen = (contactId, openTab, targetId) => {
    setActiveContact(contactId);
    if (openTab) setRightTab(openTab);
    setMobileView('right');
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

  // Sign-in prompt — surfaced when no Supabase session is active.
  if (!authed) {
    return (
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f4f6f9', fontFamily:'DM Sans', gap:16, padding:24, textAlign:'center' }}>
        <div style={{ fontSize:24, fontWeight:600, color:'#0b1f3b' }}>BPP CRM</div>
        <div style={{ fontSize:14, color:'#666', maxWidth:360 }}>
          Sign in on the existing CRM at /crm/v2/ first, then come back here. v3 reuses the same Supabase session cookie.
        </div>
        <a href="/crm/v2/" style={{ background:'#ffba00', color:'#0b1f3b', padding:'10px 18px', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14 }}>
          Go to /crm/v2/
        </a>
      </div>
    );
  }

  // ?canvas=1 forces the side-by-side mobile+desktop preview (useful when
  // iterating on the design without two browser windows).
  const showCanvas = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('canvas') === '1';
  const isMobile = vw < 900;

  // ── Mobile production layout (full viewport, no device chrome) ──
  const mobileApp = (
    <div style={{ height:'100%', flex:1, display:'flex', flexDirection:'column', background:'#f4f6f9', overflow:'hidden', minHeight:0 }}>
      {mobileView === 'left' ? (
        <NavBar tab={leftTab} onTab={setLeftTab} badgeCounts={badgeCounts} />
      ) : (
        <NavBar
          tab={rightTab}
          onTab={t => { if (t === rightTab) setMobileView('left'); else setRightTab(t); }}
          badgeCounts={badgeCounts}
        />
      )}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }} className="mobile-panel"
        onTouchStart={e => { window._swipeX = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - window._swipeX;
          if (dx > 60 && mobileView === 'right') setMobileView('left');
          if (dx < -60 && mobileView === 'left') setMobileView('right');
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
        <NavBar tab={leftTab} onTab={setLeftTab} badgeCounts={badgeCounts} compact />
        <LeftPanel tab={leftTab} onOpen={handleOpen} dncSet={dncSet} activeContactId={activeContact} />
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, background:'#F8F8F6' }}>
        <NavBar tab={rightTab} onTab={setRightTab} badgeCounts={badgeCounts} compact />
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

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
