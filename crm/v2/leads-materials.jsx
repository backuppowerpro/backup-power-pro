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

const MAT_LABELS = ['Inlet box','Interlock','Cord','Breaker','Surge'];

function MiniAvatar({ initials, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, flex: '0 0 auto',
      background: 'var(--navy)',
      borderRadius: '50%',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 600,
        color: '#fff', fontSize: size <= 28 ? 10 : 11,
      }}>{initials}</span>
    </div>
  );
}

function AmpSwitch({ amp, mobile = false }) {
  const w = mobile ? '100%' : 96;
  const h = mobile ? 40 : 36;
  return (
    <div style={{
      display: 'flex', width: w, height: h,
      background: 'var(--card)',
      boxShadow: 'var(--ring)',
      borderRadius: 'var(--radius-pill)',
      padding: 3,
    }}>
      {[30, 50].map(v => {
        const on = v === amp;
        return (
          <button key={v} style={{
            flex: 1, height: '100%',
            background: on ? 'var(--navy)' : 'transparent',
            color: on ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: on ? 700 : 500,
            fontSize: 13,
            borderRadius: 'var(--radius-pill)',
            border: 'none', cursor: 'pointer',
            transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
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
      background: on ? 'color-mix(in srgb, var(--green) 14%, var(--card))' : 'var(--sunken)',
      color: on ? 'var(--green)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--ring)',
    }}>
      {MAT_ICONS.check}
    </div>
  );
}

function OrderedPill({ status }) {
  const MAP = {
    notyet:   { label:'Not ordered', tone: 'red' },
    pending:  { label:'Pending · 2d', tone: 'gold' },
    received: { label:'Received', tone: 'green' },
  };
  const m = MAP[status];
  return <span className={`smart-chip smart-chip--${m.tone}`}>{m.label}</span>;
}

function OrderButton({ status }) {
  const common = {
    minHeight: 44, padding: '0 18px',
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
    letterSpacing: '0.01em',
    borderRadius: 'var(--radius-pill)',
    border: 'none', cursor: 'pointer',
    transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
  };
  if (status === 'notyet') {
    return (
      <button style={{
        ...common,
        background: 'var(--gold)', color: 'var(--navy)',
        boxShadow: 'var(--shadow-gold)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)' }}
      >Order now</button>
    );
  }
  if (status === 'received') {
    return (
      <button style={{
        ...common,
        background: 'var(--green)', color: '#fff',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--green)' }}
      >Mark used</button>
    );
  }
  return (
    <button style={{
      ...common,
      background: 'var(--card)', color: 'var(--text-muted)',
      boxShadow: 'var(--ring)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--sunken)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
    >View order</button>
  );
}

function MatHeaderCol({ label }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontWeight: 600,
      fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>{label}</span>
  );
}

function SurgeAddon() {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11,
      color: 'var(--gold)', marginTop: 4,
    }}>+$375</span>
  );
}

/* ────── Desktop toolbar ────── */
function MatToolbar() {
  const subs = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'list',     label: 'List' },
    { id: 'permits',  label: 'Permits' },
    { id: 'mat',      label: 'Materials', active: true },
  ];
  const amps = [
    { id: 'a30', label: '30A' },
    { id: 'a50', label: '50A' },
    { id: 'all', label: 'All', active: true },
  ];
  const sts = [
    { id: 'need', label: 'Needed',   active: true },
    { id: 'ord',  label: 'Ordered' },
    { id: 'rec',  label: 'Received' },
  ];
  const pillStyle = (active) => ({
    minHeight: 44, padding: '0 16px',
    background: active ? 'var(--navy)' : 'var(--card)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
    letterSpacing: '0.01em',
    borderRadius: 'var(--radius-pill)',
    boxShadow: active ? 'var(--shadow-sm)' : 'var(--ring)',
    border: 'none', cursor: 'pointer',
    flex: '0 0 auto',
    transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
  });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '16px 16px 10px',
    }}>
      <div style={{
        display: 'flex', height: 52,
        background: 'var(--card)', boxShadow: 'var(--ring)',
        borderRadius: 'var(--radius-pill)', padding: 4,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {subs.map(s => (
          <button key={s.id} style={{
            ...pillStyle(s.active),
            minHeight: 44, boxShadow: s.active ? 'var(--shadow-sm)' : 'none',
            background: s.active ? 'var(--navy)' : 'transparent',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {amps.map(a => (<button key={a.id} style={pillStyle(a.active)}>{a.label}</button>))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {sts.map(s => (<button key={s.id} style={pillStyle(s.active)}>{s.label}</button>))}
      </div>
    </div>
  );
}

function MatBadges() {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '0 16px 8px',
      justifyContent: 'flex-end', flexWrap: 'wrap',
    }}>
      <span className="smart-chip smart-chip--red"   style={{ height: 28, fontSize: 11 }}>3 to order</span>
      <span className="smart-chip smart-chip--gold"  style={{ height: 28, fontSize: 11 }}>2 pending</span>
      <span className="smart-chip smart-chip--green" style={{ height: 28, fontSize: 11 }}>2 received</span>
    </div>
  );
}

/* ────── Drawer (expanded row) ────── */
function Drawer({ drawer }) {
  return (
    <div style={{
      margin: '6px 14px 14px 60px',
      padding: '16px 18px',
      background: 'var(--sunken)',
      boxShadow: 'var(--ring)',
      borderRadius: 'var(--radius-md)',
      display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 20,
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 6,
        }}>Panel brand</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{drawer.panel}</div>
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 6,
        }}>Generator</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{drawer.gen}</div>
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 6,
        }}>Notes</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{drawer.notes}</div>
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
      <div style={{ padding: '0 16px 88px', flex: 1, overflow: 'auto' }}>
        <div style={{
          background: 'var(--card)',
          boxShadow: 'var(--shadow-sm), var(--ring)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          {/* header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '280px 120px repeat(5, 64px) 140px 140px',
            height: 42, alignItems: 'center',
            padding: '0 18px', gap: 12,
            borderBottom: '1px solid var(--divider-faint)',
            background: 'var(--sunken)',
          }}>
            {['Customer','Amp'].map((h, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
                textAlign: i === 1 ? 'center' : 'left',
              }}>{h}</span>
            ))}
            {MAT_LABELS.map((l, i) => <MatHeaderCol key={i} label={l} />)}
            {['Ordered','Action'].map((h, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
                textAlign: i === 1 ? 'right' : 'left',
              }}>{h}</span>
            ))}
          </div>

          {MAT_ROWS.map((r, i) => (
            <React.Fragment key={i}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '280px 120px repeat(5, 64px) 140px 140px',
                minHeight: 76, alignItems: 'center',
                padding: '12px 18px', gap: 12,
                borderBottom: !r.expanded ? '1px solid var(--divider-faint)' : 'none',
                background: r.expanded ? 'var(--sunken)' : 'var(--card)',
                transition: 'background var(--dur) var(--ease)',
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
                  background: 'var(--sunken)',
                  padding: '0 0 6px',
                  borderBottom: i < MAT_ROWS.length - 1 ? '1px solid var(--divider-faint)' : 'none',
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
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'list',     label: 'List' },
    { id: 'permits',  label: 'Permits' },
    { id: 'mat',      label: 'Materials', active: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 12px 6px' }}>
        <div style={{
          display: 'flex', height: 48,
          background: 'var(--card)', boxShadow: 'var(--ring)',
          borderRadius: 'var(--radius-pill)', padding: 4,
          maxWidth: '100%',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {subs.map(s => (
            <button key={s.id} style={{
              minHeight: 40, padding: '0 16px',
              background: s.active ? 'var(--navy)' : 'transparent',
              color: s.active ? '#fff' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: s.active ? 700 : 500, fontSize: 13,
              borderRadius: 'var(--radius-pill)',
              border: 'none', cursor: 'pointer',
              flex: '0 0 auto',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '6px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="smart-chip smart-chip--red">3 to order</span>
        <span className="smart-chip smart-chip--gold">2 pending</span>
        <span className="smart-chip smart-chip--green">2 received</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px calc(96px + env(safe-area-inset-bottom))' }}>
        {MAT_ROWS.map((r, i) => (
          <div key={i} style={{
            background: 'var(--card)',
            boxShadow: 'var(--shadow-sm), var(--ring)',
            borderRadius: 'var(--radius-md)',
            padding: 14, marginBottom: 12,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MiniAvatar initials={r.initials} size={36} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.addr}</span>
              </div>
            </div>
            <AmpSwitch amp={r.amp} mobile />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {r.mats.map((m, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <MatCell on={m} size={44} />
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>{MAT_LABELS[j]}</span>
                  {j === 4 && !m && r.surgeAddon && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10, color: 'var(--gold)' }}>+$375</span>
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
                marginTop: 4, padding: 12,
                background: 'var(--sunken)',
                boxShadow: 'var(--ring)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>Panel / gen</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {r.drawer.panel} · {r.drawer.gen}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>Notes</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{r.drawer.notes}</div>
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
