/* global React */
// Calendar — weekly grid (desktop) + daily agenda (mobile)
// Brand-aligned 2026-04-24: retired LCD-red "TODAY" glow, pixel hour
// labels, chrome-label badges. Everything uses Outfit + Inter + the
// navy/gold/status tone map.

const DAYS = [
  { abbr: 'Mon', n: 13 },
  { abbr: 'Tue', n: 14 },
  { abbr: 'Wed', n: 15 },
  { abbr: 'Thu', n: 16 },
  { abbr: 'Fri', n: 17, open: true },
  { abbr: 'Sat', n: 18 },
  { abbr: 'Sun', n: 19 },
];
const TODAY_IDX = 3; // Thu

const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19]; // 8a–7p
const HOUR_H = 56; // px per hour

// event starts at `h` (24h), runs `dur` hours, in column `day`
const EVENTS = [
  { day:1, type:'install', start:9,     dur:4,  label:'Install',    who:'Robert K' },
  { day:1, type:'follow',  start:15.75, dur:.5, label:'Follow-up',  who:'Sarah M · 3:45p' },
  { day:2, type:'inspect', start:10,    dur:1,  label:'Inspection', who:'Mark L' },
  { day:2, type:'permit',  start:14,    dur:.5, label:'Permit',     who:'Pickup', badge:true },
  { day:3, type:'install', start:8,     dur:8,  label:'Install · all day', who:'Helen S' },
  { day:5, type:'install', start:9,     dur:4,  label:'Install',    who:'Mike J' },
];

const CalIcons = {
  arrowL: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3 L4 8 L10 13"/></svg>,
  arrowR: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 3 L12 8 L6 13"/></svg>,
  key:    <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="5" cy="8" r="3"/><path d="M8 8 L14 8 M11 8 L11 11"/></svg>,
};

function EventBlock({ e }) {
  const h = Math.max(28, e.dur * HOUR_H - 4);
  const top = (e.start - HOURS[0]) * HOUR_H + 2;

  if (e.badge) {
    return (
      <div style={{
        position: 'absolute', top, left: 6, right: 6, height: 28,
        background: 'color-mix(in srgb, var(--gold) 14%, var(--card))',
        color: 'var(--gold)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--ring)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        {CalIcons.key}
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--gold)',
        }}>{e.who}</span>
      </div>
    );
  }
  if (e.type === 'follow') {
    return (
      <div style={{
        position: 'absolute', top, left: 6, right: 6, height: 24,
        background: 'color-mix(in srgb, var(--purple) 10%, var(--card))',
        borderLeft: '3px solid var(--purple)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: 'var(--purple)',
        }}>{e.label}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.who}</span>
      </div>
    );
  }
  const isInspect = e.type === 'inspect';
  return (
    <div style={{
      position: 'absolute', top, left: 6, right: 6, height: h,
      background: isInspect ? 'var(--gold)' : 'var(--navy)',
      color: isInspect ? 'var(--navy)' : '#fff',
      borderRadius: 'var(--radius-sm)',
      boxShadow: isInspect ? 'var(--shadow-gold)' : 'var(--shadow-sm)',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: isInspect ? 'var(--navy)' : 'var(--gold)',
        opacity: isInspect ? 0.8 : 1,
      }}>{e.label}</span>
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
      }}>{e.who}</span>
    </div>
  );
}

function CalHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button aria-label="Previous week" style={{
          width: 34, height: 34,
          background: 'var(--card)', color: 'var(--text-muted)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--ring)',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
        >{CalIcons.arrowL}</button>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
          letterSpacing: '-0.01em', color: 'var(--text)',
        }}>Week of Apr 13, 2026</span>
        <button aria-label="Next week" style={{
          width: 34, height: 34,
          background: 'var(--card)', color: 'var(--text-muted)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--ring)',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          transition: 'background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
        >{CalIcons.arrowR}</button>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{
          height: 34, padding: '0 16px',
          background: 'var(--gold)', color: 'var(--navy)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-gold)',
          border: 'none', cursor: 'pointer',
        }}>Today</button>
        <div style={{
          display: 'flex', height: 34,
          background: 'var(--card)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--ring)',
          padding: 3,
        }}>
          {['Day','Week','Month'].map(v => {
            const on = v === 'Week';
            return (
              <button key={v} style={{
                height: 28, padding: '0 14px',
                background: on ? 'var(--navy)' : 'transparent',
                color: on ? '#fff' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
                borderRadius: 'var(--radius-pill)',
                border: 'none', cursor: 'pointer',
                transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
              }}>{v}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CalHeader />
      <div style={{ padding: '0 20px 88px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'var(--card)',
          boxShadow: 'var(--shadow-sm), var(--ring)',
          borderRadius: 'var(--radius-md)',
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Day headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)',
            borderBottom: '1px solid var(--divider)',
            background: 'var(--sunken)',
          }}>
            <div />
            {DAYS.map((d, i) => {
              const isToday = i === TODAY_IDX;
              return (
                <div key={i} style={{
                  padding: '12px 0', textAlign: 'center',
                  borderLeft: '1px solid var(--divider-faint)',
                  background: isToday ? 'color-mix(in srgb, var(--gold) 12%, var(--sunken))' : 'transparent',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: isToday ? 'var(--gold)' : 'var(--text-muted)',
                  }}>{d.abbr}</div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
                    letterSpacing: '-0.01em', marginTop: 2,
                    color: isToday ? 'var(--navy)' : 'var(--text)',
                  }}>{d.n}</div>
                </div>
              );
            })}
          </div>
          {/* Grid body */}
          <div style={{
            display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)',
            flex: 1, overflow: 'auto', position: 'relative',
          }}>
            {/* Time column */}
            <div style={{ position: 'relative', borderRight: '1px solid var(--divider-faint)' }}>
              {HOURS.map((h, i) => (
                <div key={i} style={{ height: HOUR_H, display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0 0' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {h > 12 ? `${h-12}p` : `${h}${h===12?'p':'a'}`}
                  </span>
                </div>
              ))}
            </div>
            {/* Day columns */}
            {DAYS.map((d, di) => (
              <div key={di} style={{
                position: 'relative', borderLeft: '1px solid var(--divider-faint)',
                background: di === TODAY_IDX ? 'color-mix(in srgb, var(--gold) 4%, transparent)' : 'transparent',
              }}>
                {/* Hour grid lines */}
                {HOURS.map((_, i) => (
                  <div key={i} style={{
                    height: HOUR_H,
                    borderBottom: '1px solid var(--divider-faint)',
                  }} />
                ))}
                {d.open && (
                  <span style={{
                    position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
                    color: 'var(--text-faint)', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>Open</span>
                )}
                {EVENTS.filter(e => e.day === di).map((e, ei) => (
                  <EventBlock key={ei} e={e} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile daily agenda ── */
function CalendarMobile() {
  // Collapse events by day; only show days with events + today
  const byDay = DAYS.map((d, i) => ({ ...d, i, events: EVENTS.filter(e => e.day === i) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          letterSpacing: '-0.01em', color: 'var(--text)',
        }}>Apr 13 – 19, 2026</span>
        <button style={{
          height: 30, padding: '0 14px',
          background: 'var(--gold)', color: 'var(--navy)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-gold)',
          border: 'none', cursor: 'pointer',
        }}>Today</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
        {byDay.map((d, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'var(--card)',
              boxShadow: 'var(--ring)',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: i === TODAY_IDX ? 'var(--gold)' : 'var(--text-muted)',
              }}>{d.abbr}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                letterSpacing: '-0.01em',
                color: i === TODAY_IDX ? 'var(--navy)' : 'var(--text)',
              }}>Apr {d.n}</span>
              {i === TODAY_IDX && (
                <span className="smart-chip smart-chip--gold" style={{ marginLeft: 'auto' }}>Today</span>
              )}
              {d.events.length === 0 && i !== TODAY_IDX && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 11,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}>Open</span>
              )}
            </div>
            {d.events.map((e, ei) => {
              const timeStr = (h) => {
                const H = Math.floor(h);
                const M = Math.round((h - H) * 60);
                const p = H >= 12 ? 'p' : 'a';
                const HH = ((H + 11) % 12) + 1;
                return M ? `${HH}:${String(M).padStart(2,'0')}${p}` : `${HH}${p}`;
              };
              const isInspect = e.type === 'inspect';
              const isFollow  = e.type === 'follow';
              const bg = isInspect ? 'var(--gold)' : isFollow ? 'color-mix(in srgb, var(--purple) 8%, var(--card))' : 'var(--navy)';
              const fg = isInspect ? 'var(--navy)' : isFollow ? 'var(--text)' : '#fff';
              const lbl = isInspect ? 'var(--navy)' : isFollow ? 'var(--purple)' : 'var(--gold)';
              return (
                <div key={ei} style={{
                  display: 'flex',
                  background: 'var(--card)',
                  borderTop: '1px solid var(--divider-faint)',
                  borderRadius: ei === d.events.length - 1 ? '0 0 var(--radius-md) var(--radius-md)' : 0,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: 88, padding: '12px 12px',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    borderRight: '1px solid var(--divider-faint)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13,
                      color: 'var(--text)',
                    }}>{timeStr(e.start)}</span>
                    {e.dur >= 1 && (
                      <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 10,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}>{e.dur}h</span>
                    )}
                  </div>
                  <div style={{
                    flex: 1, background: bg, color: fg,
                    padding: '12px 14px', margin: 6, marginLeft: 8,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    boxShadow: isInspect ? 'var(--shadow-gold)' : isFollow ? 'var(--ring)' : 'var(--shadow-sm)',
                    borderLeft: isFollow ? '3px solid var(--purple)' : 'none',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: lbl,
                      opacity: isInspect ? 0.8 : 1,
                    }}>{e.label}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{e.who}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CalendarDesktop, CalendarMobile });
