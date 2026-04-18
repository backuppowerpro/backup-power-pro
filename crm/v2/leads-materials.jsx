/* global React */
// Leads — Materials sub-view. 30A/50A + 5-cell checklist per lead.

const MAT_ICONS = {
  check: <svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 8 L7 12 L13 4"/></svg>,
};

const MAT_ROWS = [
  { name:'Sarah M',  initials:'SM', addr:'412 Laurel Ridge Rd',
    amp:30, mats:[true,true,true,false,false], surgeAddon:true, ordered:'pending' },
  { name:'Robert K', initials:'RK', addr:'89 Willowbrook Ln',
    amp:50, mats:[true,true,true,true,true],  surgeAddon:false, ordered:'received' },
  { name:'Mark L',   initials:'ML', addr:'902 Stonebrook Fairway',
    amp:30, mats:[true,true,true,true,false], surgeAddon:true, ordered:'notyet' },
  { name:'Mike J',   initials:'MJ', addr:'118 Mcdaniel Ave',
    amp:50, mats:[true,false,false,false,false], surgeAddon:true, ordered:'notyet' },
  { name:'Helen S',  initials:'HS', addr:'17 Knollwood Ct',
    amp:30, mats:[true,true,true,true,true],  surgeAddon:false, ordered:'received', expanded:true,
    drawer: { panel:'SQUARE D', gen:'HONDA EU7000iS', notes:'Exterior wall garage install, 25ft cord run.' } },
  { name:'Carl W',   initials:'CW', addr:'54 Pelham Rd',
    amp:50, mats:[true,true,true,true,true],  surgeAddon:false, ordered:'pending' },
];

const MAT_LABELS = ['INLET BOX','INTERLOCK','CORD','BREAKER','SURGE'];

function MiniAvatar({ initials, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, flex: '0 0 auto',
      background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-chrome)', fontWeight: 700,
        color: 'var(--gold)', fontSize: size <= 28 ? 10 : 11, letterSpacing: '.04em',
      }}>{initials}</span>
    </div>
  );
}

function AmpSwitch({ amp, mobile = false }) {
  const w = mobile ? '100%' : 88;
  const h = mobile ? 40 : 36;
  return (
    <div style={{
      display: 'flex', width: w, height: h,
      boxShadow: 'var(--raised-2)',
    }}>
      {[30, 50].map(v => {
        const on = v === amp;
        return (
          <button key={v} style={{
            flex: 1, height: '100%',
            background: on ? 'var(--navy)' : 'transparent',
            color: on ? '#fff' : 'var(--text)',
            boxShadow: on ? 'var(--pressed-2)' : 'none',
            fontFamily: 'var(--font-pixel)', fontSize: 16,
            letterSpacing: '.06em',
          }}>{v}A</button>
        );
      })}
    </div>
  );
}

function MatCell({ on, size = 32 }) {
  return (
    <div style={{
      width: size, height: size,
      display: 'grid', placeItems: 'center',
      background: 'var(--card)',
      boxShadow: on ? 'var(--pressed-2)' : 'var(--raised-2)',
      color: on ? 'var(--ms-2)' : 'transparent',
    }}>
      {MAT_ICONS.check}
    </div>
  );
}

function OrderedPill({ status }) {
  const MAP = {
    notyet:   { label:'NOT ORDERED', color:'var(--lcd-red)',   glow:'var(--lcd-glow-red)',   sub:null },
    pending:  { label:'PENDING · 2D',color:'var(--lcd-amber)', glow:'var(--lcd-glow-amber)', sub:null },
    received: { label:'RECEIVED',    color:'var(--lcd-green)', glow:'var(--lcd-glow-green)', sub:null },
  };
  const m = MAP[status];
  return (
    <span style={{
      height: 24, padding: '0 8px',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
      color: m.color, textShadow: m.glow,
      fontFamily: 'var(--font-chrome)', fontWeight: 700,
      fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, background: m.color, boxShadow: `0 0 4px ${m.color}` }} />
      {m.label}
    </span>
  );
}

function OrderButton({ status }) {
  if (status === 'notyet') {
    return (
      <button className="tactile-raised" style={{
        height: 28, padding: '0 10px',
        background: 'var(--navy)', color: 'var(--gold)',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>ORDER NOW</button>
    );
  }
  if (status === 'received') {
    return (
      <button className="tactile-raised" style={{
        height: 28, padding: '0 10px',
        background: 'var(--green)', color: '#06201a',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>MARK USED</button>
    );
  }
  return (
    <button className="tactile-raised" style={{
      height: 28, padding: '0 10px',
      background: 'var(--card)', color: 'var(--text)',
      fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
    }}>VIEW ORDER</button>
  );
}

function MatHeaderCol({ label }) {
  return (
    <span className="chrome-label" style={{
      fontSize: 8, color: 'var(--text-muted)', textAlign: 'center',
      letterSpacing: '.06em',
    }}>{label}</span>
  );
}

function SurgeAddon() {
  return (
    <span style={{
      fontFamily: 'var(--font-pixel)', fontSize: 12,
      color: 'var(--gold)', letterSpacing: '.04em', marginTop: 4,
    }}>+$375</span>
  );
}

/* ────── Desktop toolbar ────── */
function MatToolbar() {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS', active: true },
  ];
  const amps = [
    { id: 'a30', label: '30A' },
    { id: 'a50', label: '50A' },
    { id: 'all', label: 'ALL', active: true },
  ];
  const sts = [
    { id: 'need', label: 'NEEDED',   active: true },
    { id: 'ord',  label: 'ORDERED' },
    { id: 'rec',  label: 'RECEIVED' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '16px 16px 8px',
    }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label" style={{
            height: 36, padding: '0 16px', fontSize: 12,
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? 'var(--gold)' : 'var(--text)',
            boxShadow: s.active ? 'var(--pressed-2)' : 'none',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {amps.map(a => (
          <button key={a.id} className="chrome-label" style={{
            height: 28, padding: '0 14px', fontSize: 11,
            background: a.active ? 'var(--navy)' : 'var(--card)',
            color: a.active ? '#fff' : 'var(--text)',
            boxShadow: a.active ? 'var(--pressed-2)' : 'var(--raised-2)',
            fontFamily: a.id === 'all' ? 'var(--font-chrome)' : 'var(--font-pixel)',
            fontSize: a.id === 'all' ? 11 : 14,
          }}>{a.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {sts.map(s => (
          <button key={s.id} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 11,
            background: s.active ? 'var(--navy)' : 'var(--card)',
            color: s.active ? '#fff' : 'var(--text)',
            boxShadow: s.active ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

function MatBadges() {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '0 16px 8px',
      justifyContent: 'flex-end',
    }}>
      {[
        { label:'3 TO ORDER', color:'var(--lcd-red)',   glow:'var(--lcd-glow-red)' },
        { label:'2 PENDING',  color:'var(--lcd-amber)', glow:'var(--lcd-glow-amber)' },
        { label:'2 RECEIVED', color:'var(--lcd-green)', glow:'var(--lcd-glow-green)' },
      ].map((b, i) => (
        <span key={i} style={{
          height: 26, padding: '0 10px',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: b.color, textShadow: b.glow,
          fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
        }}>◆ {b.label}</span>
      ))}
    </div>
  );
}

/* ────── Drawer (expanded row) ────── */
function Drawer({ drawer }) {
  return (
    <div style={{
      margin: '0 14px 0 56px',
      padding: '14px 16px',
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
      display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 20,
    }}>
      <div>
        <div className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>PANEL BRAND</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{drawer.panel}</div>
      </div>
      <div>
        <div className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>GENERATOR</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{drawer.gen}</div>
      </div>
      <div>
        <div className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>NOTES</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{drawer.notes}</div>
      </div>
    </div>
  );
}

/* ────── Desktop table ────── */
function MaterialsDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MatToolbar />
      <MatBadges />
      <div style={{ padding: '0 16px 88px', flex: 1, overflow: 'hidden' }}>
        <div style={{
          background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        }}>
          {/* header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '280px 120px repeat(5, 64px) 140px 140px',
            height: 36, alignItems: 'center',
            padding: '0 14px', gap: 10,
            borderBottom: '1px solid rgba(0,0,0,.15)',
          }}>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>CUSTOMER</span>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>AMP</span>
            {MAT_LABELS.map((l, i) => <MatHeaderCol key={i} label={l} />)}
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>ORDERED</span>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</span>
          </div>

          {MAT_ROWS.map((r, i) => (
            <React.Fragment key={i}>
              <div className="tactile-flat" style={{
                display: 'grid',
                gridTemplateColumns: '280px 120px repeat(5, 64px) 140px 140px',
                minHeight: 72, alignItems: 'center',
                padding: '0 14px', gap: 10,
                borderBottom: !r.expanded ? '1px solid rgba(0,0,0,.08)' : 'none',
                background: r.expanded ? 'rgba(11,31,59,.04)' : 'var(--card)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MiniAvatar initials={r.initials} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{r.addr}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <AmpSwitch amp={r.amp} />
                </div>
                {r.mats.map((m, j) => (
                  <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <MatCell on={m} />
                    {j === 4 && !m && r.surgeAddon && <SurgeAddon />}
                  </div>
                ))}
                <div><OrderedPill status={r.ordered} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <OrderButton status={r.ordered} />
                </div>
              </div>
              {r.expanded && (
                <div style={{
                  background: 'rgba(11,31,59,.04)',
                  padding: '0 0 14px',
                  borderBottom: i < MAT_ROWS.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
                }}>
                  <Drawer drawer={r.drawer} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────── Mobile card list ────── */
function MaterialsMobile() {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS' },
    { id: 'mat',      label: 'MATERIALS', active: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 8px 4px' }}>
        <div style={{ display: 'inline-flex', height: 32, boxShadow: 'var(--raised-2)' }}>
          {subs.map(s => (
            <button key={s.id} className="chrome-label" style={{
              height: 32, padding: '0 10px', fontSize: 10,
              background: s.active ? 'var(--navy)' : 'transparent',
              color: s.active ? 'var(--gold)' : 'var(--text)',
              boxShadow: s.active ? 'var(--pressed-2)' : 'none',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '4px 8px', display: 'flex', gap: 6 }}>
        {[
          { label:'3 ORDER', color:'var(--lcd-red)',   glow:'var(--lcd-glow-red)' },
          { label:'2 PEND',  color:'var(--lcd-amber)', glow:'var(--lcd-glow-amber)' },
          { label:'2 RCVD',  color:'var(--lcd-green)', glow:'var(--lcd-glow-green)' },
        ].map((b, i) => (
          <span key={i} style={{
            flex: 1,
            height: 22, padding: '0 8px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
            color: b.color, textShadow: b.glow,
            fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '.08em',
          }}>{b.label}</span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {MAT_ROWS.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)', boxShadow: 'var(--raised-2)',
            padding: 12, marginBottom: 10,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MiniAvatar initials={r.initials} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.addr}</span>
              </div>
            </div>
            <AmpSwitch amp={r.amp} mobile />
            <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
              {r.mats.map((m, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  <MatCell on={m} size={44} />
                  <span className="chrome-label" style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                    {MAT_LABELS[j].split(' ')[0]}
                  </span>
                  {j === 4 && !m && r.surgeAddon && (
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, color: 'var(--gold)' }}>+$375</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <OrderedPill status={r.ordered} />
              <OrderButton status={r.ordered} />
            </div>
            {r.expanded && (
              <div style={{
                marginTop: 2, padding: 10,
                background: 'var(--card)', boxShadow: 'var(--pressed-2)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div>
                  <div className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)' }}>PANEL / GEN</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    {r.drawer.panel} · {r.drawer.gen}
                  </div>
                </div>
                <div>
                  <div className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)' }}>NOTES</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>{r.drawer.notes}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MaterialsDesktop, MaterialsMobile });
