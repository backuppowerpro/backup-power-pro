// crm-permit-portals.jsx — 32×32 icon button with downward popover.
// Rendered inline in panel headers (e.g. Contacts) via PanelHeader's `right` slot.

function PermitPortalsButton() {
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

  const copy = async (text, label) => {
    try {
      const ok = await window.copyText(text);
      window.showToast?.(ok ? label + ' copied' : 'Copy failed');
    } catch {
      window.showToast?.('Copy failed');
    }
  };

  // Courthouse icon — 3 vertical pillars + roof line + base, navy stroke 1.5
  const courthouseIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5 L8 2 L14 5" />
      <line x1="2" y1="13.5" x2="14" y2="13.5" />
      <line x1="4.5" y1="6" x2="4.5" y2="13" />
      <line x1="8" y1="6" x2="8" y2="13" />
      <line x1="11.5" y1="6" x2="11.5" y2="13" />
    </svg>
  );

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Permit portals"
        style={{
          width:32, height:32, borderRadius:8,
          background: open ? '#F0F4FF' : 'white',
          border:'1px solid rgba(11,31,59,0.12)',
          cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:0,
        }}
      >
        {courthouseIcon}
      </button>

      {open && (
        <div style={{
          position:'absolute', right:0, top:'calc(100% + 6px)',
          width:280,
          background:'white',
          border:'1px solid rgba(27,43,75,0.12)',
          borderRadius:12,
          boxShadow:'0 8px 24px rgba(27,43,75,0.16)',
          padding:14, zIndex:50,
        }}>
          <div style={{ fontSize:13, fontWeight:600, color:NAVY, marginBottom:10 }}>Permit portals</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {CRM.jurisdictions.map((j, i) => (
              <div key={j.id} style={{ paddingTop: i ? 12 : 0, borderTop: i ? '1px solid rgba(27,43,75,0.06)' : 'none', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:500, color:NAVY, flex:1, minWidth:0 }}>{j.name}</span>
                  <button
                    onClick={() => window.open(j.portal_url, '_blank', 'noopener,width=1024,height=768')}
                    style={{ background:GOLD, color:NAVY, border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}
                  >Open</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.05em', width:30 }}>User</span>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:NAVY, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.username}</span>
                  <button
                    onClick={() => copy(j.username, 'Username')}
                    style={{ background:'white', border:'1px solid rgba(27,43,75,0.15)', borderRadius:4, padding:'3px 8px', fontSize:10, fontWeight:500, color:NAVY, fontFamily:'inherit', cursor:'pointer' }}
                  >Copy</button>
                </div>
                {/* Password row: there's no real password stored client-side
                    (publishable key context — would leak), so we surface a
                    "stored elsewhere" hint instead of the dishonest bullet
                    placeholder + Copy button that just copied "••••••••". */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'#999', textTransform:'uppercase', letterSpacing:'0.05em', width:30 }}>Pwd</span>
                  <span style={{ fontFamily:'inherit', fontSize:11, color:'#999', flex:1, fontStyle:'italic' }}>Stored in 1Password — open vault</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PermitPortalsButton });
