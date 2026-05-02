// crm-shared.jsx — primitives, icons, nav bar
// Exports: NavBar, TabIcon, ContactAvatar, StatusPill, GoldDot, fmt

const NAVY = '#1B2B4B';
// Brand gold per CLAUDE.md — same #ffba00 used on backuppowerpro.com.
// Was '#C9A048' (muted olive) which read sickly next to other yellow
// buttons that hardcoded the brand value.
const GOLD = '#ffba00';

// Corner-radius scale — every rounded surface in the app picks from this
// set so visual rhythm stays consistent. Anti-pattern: ad-hoc 5/7/9/14
// values that creep in over time.
const RADIUS = {
  xs: 4,    // tiny chips, tooltip arrows, kbd
  sm: 6,    // small ghost buttons, tag/kind chips
  md: 8,    // primary cards, buttons, inputs (most common)
  lg: 12,   // modals (desktop), hero cards
  xl: 16,   // bottom-sheet modals (mobile)
  pill: 20, // pills, status chips, FilterChips
  full: 9999, // avatars, dots, circular buttons
};
const BG   = '#F8F8F6';
const CARD = '#FFFFFF';
// Gray-500 — 4.69:1 on white, passes WCAG AA for body text (was #8892A0
// at 3.15:1 which failed). Used pervasively for timestamps, eyebrow
// labels, address subtitles, FilterChip counts, etc — all communicate
// real info, so AA matters even for "muted" text.
const MUTED = '#6B7280';

function fmt(obj) {
  if (!obj) return {};
  Object.assign(window, { NAVY, GOLD, BG, CARD, MUTED });
  return obj;
}

// ── SVG Icons ────────────────────────────────────────────────────
const Icons = {
  contacts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  calendar: (
    // Heroicons solid calendar — a SINGLE filled path. No strokes, no
    // intersections, no anti-aliased overlap brightening anywhere.
    // Previous attempts with stroked outlines + filled tabs all had some
    // version of the lighter-pixel artifact Key kept flagging. Going
    // fully filled kills the entire class of bug.
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z"/>
    </svg>
  ),
  finance: (
    // Single combined path so the vertical $ stem and the S-curve render
    // as one stroke pass — no anti-aliased intersection brightening.
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.04 12.04 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.272.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  search: (
    // Geometrically balanced — circle at (10.5, 10.5) and handle to
    // (19, 19) so the visual center of mass falls at (12, 12), the
    // exact midpoint of the 24×24 viewBox. Asymmetric original (cx=11,
    // handle to 21,21) rendered visibly above-left of the input baseline.
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="7"/><path d="m19 19-4.35-4.35"/>
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  ),
  sparky: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  plus: (
    // Filled rects so the center crossing is a solid pixel, not a lighter
    // anti-aliased overlap.
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="11" y="5" width="2" height="14" rx="1"/>
      <rect x="5" y="11" width="14" height="2" rx="1"/>
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="m22 2-11 11"/>
    </svg>
  ),
  voicemail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="11.5" r="4.5"/><circle cx="18.5" cy="11.5" r="4.5"/><path d="M5.5 16h13"/>
    </svg>
  ),
  hash: (
    // Filled rects (not strokes) so the four bar intersections render solid
    // pixels instead of lighter anti-aliased overlaps.
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="9" y="3" width="2" height="18" rx="0.5"/>
      <rect x="14" y="3" width="2" height="18" rx="0.5"/>
      <rect x="3" y="9" width="18" height="2" rx="0.5"/>
      <rect x="3" y="14" width="18" height="2" rx="0.5"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
};

// ── Top Nav Bar ───────────────────────────────────────────────────
function NavBar({ tab, onTab, showBack, onBack, badgeCounts = {}, compact, contextLabel }) {
  const tabs = ['contacts','calendar','finance','messages','calls'];
  return (
    <div style={{
      background: NAVY,
      display: 'flex',
      alignItems: 'center',
      // Add iOS safe-area top inset so the notch / Dynamic Island doesn't
      // overlap tab buttons when standalone PWA + viewport-fit=cover.
      // height stays 'auto' since paddingTop pushes the row down.
      minHeight: compact ? 52 : 60,
      padding: '0 4px',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      flexShrink: 0,
      gap: 0,
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      {contextLabel && (
        <div style={{
          width: '100%',
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          paddingBottom: 2,
          paddingTop: 6,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '4px 16px 0',
        }}>{contextLabel}</div>
      )}
      <div style={{ display:'flex', alignItems:'center', width:'100%', height: 48 }}>
        {showBack ? (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'white',
            width: 44, height: 44, display:'flex', alignItems:'center', justifyContent:'center',
            cursor: 'pointer', flexShrink: 0, borderRadius: 8,
          }}><div style={{ width: 22, height: 22 }}>{Icons.back}</div></button>
        ) : (
          <div style={{ width: 44, flexShrink: 0 }} />
        )}

        <div style={{ flex: 1, display:'flex', justifyContent:'center', alignItems:'center', gap: 0 }}>
          {tabs.map(t => {
            const active = tab === t;
            const badge = badgeCounts[t] || 0;
            return (
              <button key={t} onClick={() => onTab(t)} style={{
                background: active ? 'rgba(255,255,255,0.12)' : 'none',
                border: 'none',
                color: active ? 'white' : 'rgba(255,255,255,0.5)',
                width: 44, height: 44,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', borderRadius: 8, position:'relative',
                flexShrink: 0,
              }}>
                <div style={{ width: 22, height: 22 }}>{Icons[t]}</div>
                {badge > 0 && (
                  <div style={{
                    position:'absolute', top: 6, right: 6,
                    background: '#E53E3E', color:'white',
                    width: 16, height: 16, borderRadius: '50%',
                    fontSize: 9, fontWeight: 700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border: `2px solid ${NAVY}`,
                  }}>{badge}</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ width: 44, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Contact Avatar ────────────────────────────────────────────────
// Public-restricted Street View Static API key — same one used in v2,
// proposal.html, invoice.html. Only mints image URLs; no geocoding/routing/
// places/billing exposure. Safe to ship in client code.
// Google Maps Street View Static API key — referrer-restricted in
// Google Cloud Console to backuppowerpro.com / localhost. Designed for
// public browser use; not a secret and not a CLAUDE.md "AIza" violation.
// Audits that grep for AIza will re-flag this — leave the comment.
const SV_KEY = 'AIzaSyB0xWm71ZDzS7ei5-vFx15rNP_lR1ZKbJs';

// Returns a Street View Static URL only when the address looks like an
// actual street — has a number AND a road word (drive/street/lane/etc).
// Test contacts with junk addresses (e.g. just "(800) 555-0007 ·") would
// otherwise fetch Google's "no imagery available" placeholder, which
// renders as the watermark cropped inside the avatar circle. Better to
// fall back to the initials avatar for those.
const ROAD_RE = /\b(st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|blvd|boulevard|way|hwy|highway|pkwy|parkway|cir|circle|trl|trail|pl|place|pt|point|ter|terrace|loop|run|crossing|ridge|hill)\b\.?/i;
function isAddressableStreet(address) {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();
  if (a.length < 8) return false;
  if (!/\d/.test(a)) return false; // need a number
  return ROAD_RE.test(a);
}
function streetViewUrlFor(address, size = 80) {
  if (!isAddressableStreet(address)) return null;
  // Always request the API max (640x640 + scale=2 = ~1280px source). The
  // browser scales down to the avatar's actual rendered size — that's
  // sharper than letting Google return a smaller image and the browser
  // upscale. CSS object-fit crops Google's bottom-left watermark.
  return `https://maps.googleapis.com/maps/api/streetview?size=640x640` +
         `&scale=2&location=${encodeURIComponent(address.trim())}` +
         `&fov=80&pitch=5&source=outdoor&key=${SV_KEY}`;
}

// Curated avatar palette — Gmail/Material-style. Hand-picked rich
// 600-shade colors that all read cleanly with bold white text and avoid
// muddy or sickly tones. Hash → index keeps the same name on the same
// color across renders/sessions.
const AVATAR_PALETTE = [
  '#DC2626', // red
  '#EA580C', // orange
  '#D97706', // amber
  '#059669', // emerald
  '#0D9488', // teal
  '#0891B2', // cyan
  '#2563EB', // blue
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#9333EA', // purple
  '#DB2777', // pink
  '#E11D48', // rose
];
function colorFromString(s) {
  // FNV-1a — better distribution than `h*31+c` for short strings,
  // which clustered short first-name-only contacts on the same hue.
  const str = String(s || '');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// Street View imagery presence cache. The Places metadata API is free
// and returns instantly with `status: "OK"` if a panorama exists at the
// address, or "ZERO_RESULTS" if not. We cache the result per-address so
// we don't re-check on every render. Without this check, Google returns
// HTTP 200 with a gray placeholder for no-imagery addresses, and our
// onError handler never fires — leaving an empty-looking avatar.
const __svImageryCache = new Map(); // address → 'ok' | 'none' | Promise
async function checkSvImagery(address) {
  if (!address) return 'none';
  if (__svImageryCache.has(address)) {
    const v = __svImageryCache.get(address);
    if (typeof v === 'string') return v;
    return v; // pending promise
  }
  const promise = (async () => {
    try {
      const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(address)}&source=outdoor&key=${SV_KEY}`;
      const r = await fetch(url);
      if (!r.ok) return 'none';
      const j = await r.json();
      return j?.status === 'OK' ? 'ok' : 'none';
    } catch {
      return 'none';
    }
  })().then(result => {
    __svImageryCache.set(address, result);
    return result;
  });
  __svImageryCache.set(address, promise);
  return promise;
}

function ContactAvatar({ contact, size = 40 }) {
  // Defensive: contact can be null/undefined when a proposal/invoice references
  // a contact that's been archived or wasn't returned in the 500-row contacts
  // window. Show as anonymous in that case rather than crashing.
  const isAnon = !contact || !contact.name;
  const bg = isAnon ? '#E8EAF0' : colorFromString(contact.name || contact.id || 'X');
  // Street View URL: built only when the address looks addressable
  // (number + road word). Real imagery is verified async via metadata
  // — until then, we show colored initials. This avoids rendering
  // Google's gray "no imagery" placeholder for un-mapped addresses.
  const addr = !isAnon ? contact.address : null;
  const addressable = addr && isAddressableStreet(addr);
  const svUrl = addressable ? streetViewUrlFor(addr, size) : null;
  const cached = addressable ? __svImageryCache.get(addr) : null;
  const initialReady = cached === 'ok';
  const initialNone = cached === 'none';
  const [hasImagery, setHasImagery] = React.useState(initialReady);
  const [verified, setVerified] = React.useState(initialReady || initialNone);

  React.useEffect(() => {
    if (!addressable) return;
    let cancelled = false;
    (async () => {
      const result = await checkSvImagery(addr);
      if (cancelled) return;
      setHasImagery(result === 'ok');
      setVerified(true);
    })();
    return () => { cancelled = true; };
  }, [addr, addressable]);

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg,
      color: isAnon ? MUTED : 'white',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      letterSpacing: '0.02em',
      position:'relative', overflow:'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
    }}>
      {/* Colored initials sit underneath as the base — visible while SV
          metadata is verifying, and the only thing visible if SV has no
          imagery for this address. */}
      {isAnon ? <div style={{width: size*0.42, height: size*0.42}}>{Icons.hash}</div> : contact.avatar}
      {svUrl && hasImagery && (
        <img
          src={svUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setHasImagery(false)}
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover', objectPosition:'70% 30%', display:'block',
            filter: 'saturate(1.25) contrast(1.08) brightness(1.02)',
          }}
        />
      )}
    </div>
  );
}

// ── Gold Dot (premium tier) ───────────────────────────────────────
function GoldDot() {
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background: GOLD, marginRight: 5, flexShrink:0, marginTop:1 }} />;
}

// ── Status Pills ──────────────────────────────────────────────────
// DB-shape lowercase enums: proposals (draft/sent/viewed/approved/expired/declined),
// invoices (draft/sent/viewed/paid/overdue/refunded/voided), events (scheduled/done/cancelled),
// event kinds (install/inspect/follow_up/pickup/meeting).
const PILL_STYLES = {
  // Proposal statuses
  draft:      { bg:'#F3F4F6', color:'#374151' },
  sent:       { bg:'#EFF6FF', color:'#1E40AF' },
  viewed:     { bg:'#EEF2FF', color:'#3730A3' },
  approved:   { bg:'#ECFDF5', color:'#065F46' },
  expired:    { bg:'#F3F4F6', color:'#6B7280' },
  declined:   { bg:'#FEF2F2', color:'#991B1B' },
  // Invoice statuses (paid/overdue/sent shared with above)
  paid:       { bg:'#ECFDF5', color:'#065F46' },
  overdue:    { bg:'#FEF2F2', color:'#991B1B' },
  refunded:   { bg:'#F3F4F6', color:'#6B7280' },
  voided:     { bg:'#F3F4F6', color:'#6B7280' },
  declined:   { bg:'#FEF2F2', color:'#991B1B' }, // proposal "Cancelled" surface
  // Event statuses
  scheduled:  { bg:'#EFF6FF', color:'#1E40AF' },
  done:       { bg:'#ECFDF5', color:'#065F46' },
  cancelled:  { bg:'#FEF2F2', color:'#991B1B' },
  // Event kinds
  install:    { bg:'#F0FDF4', color:'#166534' },
  inspect:    { bg:'#F5F3FF', color:'#5B21B6' },
  follow_up:  { bg:'#FFF7ED', color:'#C2410C' },
  pickup:     { bg:'#F0FDF4', color:'#166534' },
  meeting:    { bg:'#F5F3FF', color:'#5B21B6' },
  // Misc
  today:      { bg:'#FFFBEB', color:'#92400E' },
};

// Status → human label override map. Some DB statuses don't read well
// when capitalized verbatim ("Declined" sounds like a customer rejection,
// but in practice Key uses it to cancel a pending proposal — so we
// surface it as "Cancelled"). Used by both StatusPill (left pane) and
// the right-pane FIN_PILL so the two pane views show the SAME label
// for the same status.
const STATUS_LABELS = {
  declined: 'Cancelled',
  // Legacy v1/v2 paths write `cancelled` instead of `declined`/`voided`.
  // Render them as Cancelled so the operator sees "what they did" not
  // the underlying schema sprawl.
  cancelled: 'Cancelled',
  voided: 'Voided',
  refunded: 'Refunded',
  expired: 'Expired',
  permit_submit: 'Submitted',
  permit_waiting: 'Waiting',
  permit_approved: 'Approved',
  follow_up: 'Follow-up',
};

function StatusPill({ status, label }) {
  const s = PILL_STYLES[status] || { bg:'#F3F4F6', color:'#374151' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      whiteSpace: 'nowrap',
    }}>{label || STATUS_LABELS[status] || capitalize(status)}</span>
  );
}

// ── Sparky FAB ────────────────────────────────────────────────────
function SparkyFAB({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Open assistant" style={{
      position:'absolute', bottom: 20, right: 16,
      width: 52, height: 52, borderRadius: '50%',
      background: GOLD, border: 'none',
      color: NAVY, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow: '0 4px 16px rgba(201,160,72,0.5)',
      zIndex: 50,
    }}>
      <div style={{width:24,height:24}}>{Icons.sparky}</div>
    </button>
  );
}

// ── Sparky Pill (detail view) ─────────────────────────────────────
function SparkyPill({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Open assistant" style={{
      position:'absolute', right: 0, top: '50%', transform:'translateY(-50%)',
      background: GOLD, border: 'none', color: NAVY,
      borderRadius: '20px 0 0 20px',
      padding: '10px 8px 10px 10px',
      cursor:'pointer', display:'flex', flexDirection:'column',
      alignItems:'center', gap: 4,
      boxShadow: '-2px 2px 12px rgba(201,160,72,0.4)',
      zIndex: 50,
      fontSize: 9, fontWeight: 700,
    }}>
      <div style={{width:16,height:16}}>{Icons.sparky}</div>
      <span style={{writingMode:'vertical-rl', transform:'rotate(180deg)', letterSpacing:1}}>SPARKY</span>
    </button>
  );
}

// ── Toast system ──────────────────────────────────────────────────
function ToastHost() {
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    window.showToast = (msg, opts = {}) => {
      const id = 't' + Date.now() + Math.random();
      setToasts(t => [...t, { id, msg, kind: opts.kind || 'info', undo: opts.undo }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 2600);
    };
  }, []);
  return (
    <div style={{ position:'absolute', top:60, left:'50%', transform:'translateX(-50%)', zIndex:100, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none', alignItems:'center' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.kind==='error'?'#991B1B':NAVY, color:'white',
          fontSize:12, fontWeight:600, padding:'8px 14px', borderRadius:20,
          boxShadow:'0 4px 16px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:10,
          pointerEvents:'auto', animation:'toastIn 0.24s cubic-bezier(0.16,1,0.3,1)',
          maxWidth:280,
        }}>
          <span>{t.msg}</span>
          {t.undo && <button onClick={() => { t.undo(); setToasts(ts=>ts.filter(x=>x.id!==t.id)); }} style={{ background:'none',border:'none',color:GOLD,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',padding:0 }}>Undo</button>}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────
function ConfirmHost() {
  const [c, setC] = React.useState(null);
  React.useEffect(() => {
    window.confirmAction = (opts) => new Promise(resolve => {
      setC({ ...opts, resolve });
    });
  }, []);
  if (!c) return null;
  const close = (v) => { c.resolve(v); setC(null); };
  return (
    <div onClick={() => close(false)} style={{ position:'absolute', inset:0, background:'rgba(15,26,46,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.18s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:12, padding:'22px 22px 16px', maxWidth:300, width:'85%', boxShadow:'0 20px 60px rgba(0,0,0,0.4)', animation:'popIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ fontSize:16, fontWeight:700, color:NAVY, marginBottom:6 }}>{c.title}</div>
        <div style={{ fontSize:13, color:MUTED, lineHeight:1.5, marginBottom:16 }}>{c.body}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={()=>close(false)} style={{ height:34, padding:'0 14px', borderRadius:8, background:'none', border:'1.5px solid #EBEBEA', color:MUTED, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={()=>close(true)} style={{ height:34, padding:'0 14px', borderRadius:8, background: c.destructive?'#991B1B':NAVY, border:'none', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{c.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ── Empty Hero (no contact selected) ──────────────────────────────
function EmptyHero() {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:BG, flexDirection:'column', gap:14, padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:36, height:36, borderRadius:8, background:NAVY, display:'flex', alignItems:'center', justifyContent:'center', color:GOLD, fontSize:14, fontWeight:800, letterSpacing:'-0.02em' }}>BPP</div>
        <div style={{ fontSize:18, fontWeight:700, color:NAVY, letterSpacing:'-0.01em' }}>Backup Power Pros</div>
      </div>
      <div style={{ fontSize:13, color:MUTED, textAlign:'center', maxWidth:240, lineHeight:1.5 }}>Select a contact to start, or pick a row from the list on the left.</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'white', border:'1px solid #EBEBEA', fontSize:11, color:MUTED, fontWeight:600 }}>
        <kbd style={{ background:BG, border:'1px solid #EBEBEA', borderRadius:4, padding:'1px 5px', fontSize:10, fontFamily:'inherit', color:NAVY }}>⌘K</kbd>
        <span>to search</span>
      </div>
    </div>
  );
}

// ── Display helpers ───────────────────────────────────────────────
// Re-evaluated on every module load — i.e. on every page refresh. For Key's
// daily use on iPhone Safari + macOS Chrome this is fine; longer-running
// sessions will see "1m ago" times slowly drift to "1h ago" without ticking,
// which is the v1 behavior anyway.
const NOW = new Date();

// Capitalize a snake_case or lowercase enum: 'premium_plus' → 'Premium plus', 'sent' → 'Sent'
function capitalize(s) {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

// E.164 (+18645550192) → "(864) 555-0192"
function formatPhone(e164) {
  if (!e164) return '';
  const d = String(e164).replace(/\D/g, '');
  // Strip leading "1" for US numbers
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`;
}

// Robust clipboard write with execCommand fallback. The bare
// navigator.clipboard API requires a secure context AND document
// focus; in iframes or some Safari edges it silently rejects.
// Fallback to the legacy textarea-select approach when that happens
// so the Copy buttons actually copy instead of always toasting failure.
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = String(text || '');
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Live phone-input mask — "8648637" → "(864) 863-7", grows with input.
// US-format. Detects E.164 / international input (leading + or 11+
// digits with leading 1) and either strips the country prefix or
// passes the raw value through to avoid mangling international numbers
// into the wrong area code. Pasting "+18648637800" no longer yields
// "(186) 486-3780".
function formatPhoneInput(raw) {
  const s = String(raw || '');
  // Pass through international (anything with `+` that isn't +1<10 US
  // digits>). Strip non-digits otherwise, strip leading `1` if 11
  // digits, and format US-style.
  if (s.startsWith('+')) {
    const noPlus = s.slice(1).replace(/\D/g, '');
    if (noPlus.startsWith('1') && noPlus.length === 11) {
      const us = noPlus.slice(1);
      return `(${us.slice(0,3)}) ${us.slice(3,6)}-${us.slice(6)}`;
    }
    return s; // genuinely international, leave alone
  }
  let d = s.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

// Linkify a message body — phone numbers (tel:), URLs (target=_blank),
// and addressable street references (Apple Maps deeplink). Returns an
// array of React nodes; pass into a span/div as children. The light
// regex set is tuned for SMS bodies, not arbitrary text.
function linkify(body) {
  if (!body || typeof body !== 'string') return body;
  // Combined pattern — order matters: URLs first (greedy), then phones,
  // then street-pattern addresses.
  const URL_RE = /\bhttps?:\/\/[^\s]+/g;
  // Phone match — the regex used to start with `\b` and the optional
  // `(` after the boundary. That left the opening paren outside the
  // match while the closing paren stayed inside, so "(864) 555-1234"
  // rendered as "( " + linkified "864) 555-1234". Drop the `\b`, allow
  // optional country code + paren wrappers symmetrically.
  const PHONE_RE = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  const ADDR_RE = /\b(\d{2,5}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Way|Hwy|Highway|Pkwy|Parkway|Cir|Circle|Trl|Trail|Pl|Place|Ter|Terrace|Loop)\b\.?(?:,?\s+[A-Z][A-Za-z]+){0,2}(?:,?\s+SC)?(?:\s+\d{5})?)/g;

  // Build a list of {start, end, kind, match} matches, sort by start,
  // then walk and emit text/link fragments. Overlap handling: take the
  // earliest start; if two start at the same offset, longest wins.
  const matches = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(body)) !== null) matches.push({ start: m.index, end: m.index + m[0].length, kind: 'url', text: m[0] });
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(body)) !== null) matches.push({ start: m.index, end: m.index + m[0].length, kind: 'phone', text: m[0], digits: m[1]+m[2]+m[3] });
  ADDR_RE.lastIndex = 0;
  while ((m = ADDR_RE.exec(body)) !== null) matches.push({ start: m.index, end: m.index + m[0].length, kind: 'address', text: m[0] });
  matches.sort((a,b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Drop overlaps (keep the earlier-and-longer one).
  const clean = [];
  let lastEnd = 0;
  for (const x of matches) { if (x.start >= lastEnd) { clean.push(x); lastEnd = x.end; } }

  const out = [];
  let cursor = 0;
  clean.forEach((x, i) => {
    if (x.start > cursor) out.push(body.slice(cursor, x.start));
    const linkStyle = { color:'inherit', textDecoration:'underline', fontWeight:600 };
    if (x.kind === 'url') {
      out.push(<a key={'l'+i} href={x.text} target="_blank" rel="noopener noreferrer" style={linkStyle} onClick={e=>e.stopPropagation()}>{x.text}</a>);
    } else if (x.kind === 'phone') {
      out.push(<a key={'l'+i} href={`tel:${x.digits}`} style={linkStyle} onClick={e=>e.stopPropagation()}>{x.text}</a>);
    } else {
      const q = encodeURIComponent(x.text);
      out.push(<a key={'l'+i} href={`https://maps.apple.com/?q=${q}`} target="_blank" rel="noopener noreferrer" style={linkStyle} onClick={e=>e.stopPropagation()}>{x.text}</a>);
    }
    cursor = x.end;
  });
  if (cursor < body.length) out.push(body.slice(cursor));
  return out;
}

// ISO timestamp → "12m" / "2h" / "Yesterday" / "Apr 27"
function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d;
  // Future dates: render as absolute (a scheduled event tomorrow
  // shouldn't say "now"). Renders as month/day if >7d out, "Tomorrow"
  // for ~24h ahead, otherwise the absolute time.
  if (diff < 0) {
    const futureDays = Math.floor(-diff / 86400000);
    if (futureDays === 0) return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    if (futureDays === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  }
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

// cents → "$1,497"
function formatMoneyCents(cents) {
  if (cents == null) return '';
  return (cents / 100).toLocaleString('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 });
}

// ── Rot detection signals ───────────────────────────────────────────
// One pure function, called once per ContactsList render with the full
// data set, returns a Map<contactId, signals> the row renderer pulls from.
// Centralized here so the Money tab and Calendar can reuse the same
// definitions (no two-source-of-truth drift on what counts as "stale").
function buildContactSignals({ contacts, messages, calls, proposals, invoices, events, now = Date.now() }) {
  const out = new Map();
  // Index for O(1) lookups instead of O(N*M) per contact.
  const msgsByC = new Map();
  const callsByC = new Map();
  const propsByC = new Map();
  const invsByC = new Map();
  const eventsByC = new Map();
  for (const m of messages || [])  (msgsByC.get(m.contact_id) || msgsByC.set(m.contact_id, []).get(m.contact_id)).push(m);
  for (const c of calls || [])     (callsByC.get(c.contact_id) || callsByC.set(c.contact_id, []).get(c.contact_id)).push(c);
  for (const p of proposals || []) (propsByC.get(p.contact_id) || propsByC.set(p.contact_id, []).get(p.contact_id)).push(p);
  for (const i of invoices || [])  (invsByC.get(i.contact_id) || invsByC.set(i.contact_id, []).get(i.contact_id)).push(i);
  for (const e of events || [])    (eventsByC.get(e.contact_id) || eventsByC.set(e.contact_id, []).get(e.contact_id)).push(e);

  for (const c of contacts || []) {
    if (c.archived) continue;
    const cMsgs = msgsByC.get(c.id) || [];
    const cCalls = callsByC.get(c.id) || [];
    const cProps = propsByC.get(c.id) || [];
    const cInvs = invsByC.get(c.id) || [];
    const cEvents = eventsByC.get(c.id) || [];

    // Last touch — most recent outbound activity from us.
    const lastOutMsg = cMsgs.filter(m => m.direction === 'out' || m.sender_role === 'key')
      .sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''))[0];
    const lastOutCall = cCalls.filter(c => c.direction === 'out')
      .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))[0];
    const lastTouchAt = [lastOutMsg?.sent_at, lastOutCall?.started_at].filter(Boolean)
      .sort().pop() || null;
    const daysSinceTouch = lastTouchAt
      ? Math.floor((now - new Date(lastTouchAt).getTime()) / 86400000)
      : null;

    // Last inbound message (for last-message preview on row).
    const sortedMsgs = [...cMsgs].sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''));
    const lastMsg = sortedMsgs[0] || null;

    // Aging quote — proposal sent, not yet booked, not yet viewed (or
    // viewed >4d ago without acceptance). The "stale" age is calibrated
    // to the silent-prospect-followup framework (memory).
    const sentProposals = cProps
      .filter(p => p.status === 'sent' && p.sent_at)
      .sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''));
    const freshestStale = sentProposals[sentProposals.length - 1] || null;
    const proposalAgeDays = freshestStale
      ? Math.floor((now - new Date(freshestStale.sent_at).getTime()) / 86400000)
      : null;
    const stale = freshestStale && proposalAgeDays >= 3;
    const veryStale = freshestStale && proposalAgeDays >= 7;
    // Recently-viewed proposal — surface as a positive nudge.
    const recentlyViewedProposal = cProps
      .filter(p => p.viewed_at && (now - new Date(p.viewed_at).getTime()) < 24 * 3600 * 1000)
      .sort((a, b) => (b.viewed_at || '').localeCompare(a.viewed_at || ''))[0] || null;

    // Outstanding $ — the post-install rule. Sum totals on sent/overdue
    // invoices for contacts whose latest install event is in the past.
    const installed = contactHasInstalled
      ? contactHasInstalled(c, cEvents)
      : cEvents.some(e => e.kind === 'install' && e.status === 'scheduled' && new Date(e.start_at) < new Date(now));
    let outstandingCents = 0;
    let outstandingOldestDays = null;
    for (const inv of cInvs) {
      if ((inv.status === 'sent' || inv.status === 'overdue') && installed) {
        outstandingCents += inv.total || 0;
        const age = Math.floor((now - new Date(inv.sent_at || inv.created_at).getTime()) / 86400000);
        if (outstandingOldestDays == null || age > outstandingOldestDays) outstandingOldestDays = age;
      }
    }

    // Install-done-but-not-invoiced — past install event, no invoice
    // since that install. Surface on Today/Calendar so Key invoices
    // before he forgets.
    const pastInstalls = cEvents
      .filter(e => e.kind === 'install' && e.status === 'scheduled' && new Date(e.start_at).getTime() < now);
    let installNeedsInvoice = false;
    if (pastInstalls.length > 0) {
      const latestInstall = pastInstalls.sort((a, b) => (b.start_at || '').localeCompare(a.start_at || ''))[0];
      const installTs = new Date(latestInstall.start_at).getTime();
      const invoiceAfterInstall = cInvs.some(inv => {
        const sentTs = new Date(inv.sent_at || inv.created_at || 0).getTime();
        return sentTs >= installTs;
      });
      installNeedsInvoice = !invoiceAfterInstall;
    }

    out.set(c.id, {
      lastTouchAt, daysSinceTouch, lastMsg,
      stale, veryStale, proposalAgeDays, freshestStale,
      recentlyViewedProposal,
      outstandingCents, outstandingOldestDays,
      installNeedsInvoice,
    });
  }
  return out;
}

// ISO → "Apr 30" or "Sat, May 3"
function formatDate(iso, opts = { weekday:'short', month:'short', day:'numeric' }) {
  if (!iso) return '';
  // Accept either "2026-05-03" or full ISO timestamps
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00Z') : new Date(iso);
  return d.toLocaleDateString('en-US', opts);
}

// ISO → "9:00 AM"
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
}

// ISO → "9:00 AM" but compact for densely-packed calendar rows ("9:00")
function formatTimeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
          .replace(/\s?(AM|PM)$/i,'');
}

// Duration sec → "1:23" or "—"
function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), r = sec % 60;
  return m + ':' + String(r).padStart(2, '0');
}

// Date-only key for grouping in LOCAL time. Splitting an ISO timestamp
// on 'T' returns the UTC date portion — comparing that against TODAY
// (built from local-TZ Date components) goes off-by-one any time the
// UTC date is different from local. After ~8 PM EDT the UTC date is
// already tomorrow → tonight's installs grouped under the wrong day.
function dayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Backwards-compat aliases (keep old names working during migration)
const relTime = formatRelative;
const fmtTime = formatTime;
const fmtDate = formatDate;

// ── Has-installed helper ──────────────────────────────────────────────
// Per Key's billing rule: customers don't owe anything until after the
// install. An invoice for a contact with no past install + stage < install
// is pre-billing (queued / pending), NOT outstanding.
function contactHasInstalled(contact, events = []) {
  if (!contact) return false;
  if (contact.stage === 'install' || contact.stage === 'done') return true;
  const now = Date.now();
  return events.some(e =>
    e.contact_id === contact.id &&
    e.kind === 'install' &&
    e.start_at &&
    new Date(e.start_at).getTime() < now
  );
}

// ── localStorage with quota fallback ──────────────────────────────────
// Wraps setItem with eviction-on-quota. When localStorage hits its 5MB
// limit (typical browser limit), we evict any bpp_v3_geocode: or
// bpp_v3_drive: cache entries (which we can re-fetch) before retrying.
// Pinned-contacts and the like persist because they live under different
// prefixes the eviction sweep doesn't touch.
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      try {
        const evictPrefixes = ['bpp_v3_geocode:', 'bpp_v3_drive:', 'bpp_v3_job_photos:'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (evictPrefixes.some(p => k.startsWith(p))) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(key, value);
        return true;
      } catch { return false; }
    }
    return false;
  }
}

// ── BPP pricing engine (mirrors v1/v2 — keep in sync) ──────────────────
// QB_C = your real costs. QB_S = what the customer sees. Both in dollars.
// When v1 changes, mirror here.
const QB_C = {
  inlet30: 55, inlet50: 85, interlock: 25,
  permitActual: 75, permitCustomer: 125, licenseAmortized: 25,
  surgeProtector: 85, cord30Cost: 60, cord50Cost: 125,
  adCost: 150, minProfit: 500,
};
const QB_S = {
  base30: 1197, base50: 1497,
  longRun30perFt: 12, longRun50perFt: 14,
  surge: 375, pom: 447,
  cordValue30: 129, cordValue50: 198,
  permitCustomer: 125,
};
// Tier upgrades (additive, applied after base+addons). Standard is the floor.
const TIER_META = {
  standard:     { label: 'Standard',  uplift: 0,   tone: '#666' },
  premium:      { label: 'Premium',   uplift: 300, tone: '#0b1f3b' },
  premium_plus: { label: 'Premium+',  uplift: 600, tone: GOLD },
};
const TIER_IDS = ['standard', 'premium', 'premium_plus'];

// Total dollars for a given amp + addon set + tier.
function quickQuoteTotal({ amp, cordIncluded, includeSurge, includePom, includePermit, tier }) {
  const is50 = String(amp) === '50';
  const baseCordCost = is50 ? QB_C.cord50Cost : QB_C.cord30Cost;
  const cordValue = is50 ? QB_S.cordValue50 : QB_S.cordValue30;
  const yourSupplies =
    (is50 ? QB_C.inlet50 : QB_C.inlet30) + QB_C.interlock + QB_C.permitActual + QB_C.licenseAmortized +
    (cordIncluded ? baseCordCost : 0) +
    (includeSurge ? QB_C.surgeProtector : 0);
  const totalCost = yourSupplies + QB_C.adCost;
  const cordDiscount = cordIncluded ? 0 : cordValue;
  const addonSell =
    (includeSurge ? QB_S.surge : 0) +
    (includePom ? QB_S.pom : 0) +
    (includePermit ? QB_S.permitCustomer : 0);
  const standardSell = (is50 ? QB_S.base50 : QB_S.base30) + addonSell - cordDiscount;
  let totalSell = Math.round(Math.max(standardSell, totalCost + QB_C.minProfit));
  totalSell += (TIER_META[tier]?.uplift || 0);
  if (totalSell % 2 === 0) totalSell += 1;
  return totalSell;
}

// Build pricing_30 + pricing_50 line-item shapes that proposal.html consumes.
// Mirrors v2 quickQuoteCompute output minus the tier uplift (uplift lives on
// the top-level total field).
function quickQuoteCompute({ amp, cordIncluded, includeSurge, includePom, includePermit }) {
  const is50 = String(amp) === '50';
  const baseCordCost = is50 ? QB_C.cord50Cost : QB_C.cord30Cost;
  const cordValue = is50 ? QB_S.cordValue50 : QB_S.cordValue30;
  const yourSupplies =
    (is50 ? QB_C.inlet50 : QB_C.inlet30) + QB_C.interlock + QB_C.permitActual + QB_C.licenseAmortized +
    (cordIncluded ? baseCordCost : 0) +
    (includeSurge ? QB_C.surgeProtector : 0);
  const totalCost = yourSupplies + QB_C.adCost;
  const cordDiscount = cordIncluded ? 0 : cordValue;
  const addonSell =
    (includeSurge ? QB_S.surge : 0) +
    (includePom ? QB_S.pom : 0) +
    (includePermit ? QB_S.permitCustomer : 0);
  const standardSell = (is50 ? QB_S.base50 : QB_S.base30) + addonSell - cordDiscount;
  let totalSell = Math.round(Math.max(standardSell, totalCost + QB_C.minProfit));
  if (totalSell % 2 === 0) totalSell += 1;
  return {
    total: totalSell,
    base: is50 ? QB_S.base50 : QB_S.base30,
    cord: cordIncluded ? 0 : cordValue,
    cordIncluded: !!cordIncluded,
    mainBreaker: 0, twinQuad: 0,
    surge: includeSurge ? QB_S.surge : 0,
    pom: includePom ? QB_S.pom : 0,
    permit: includePermit ? QB_S.permitCustomer : 0,
    longRun: 0, permitInspection: 0, extraFt: 0,
    items: [],
  };
}

// Export everything
Object.assign(window, {
  NAVY, GOLD, BG, CARD, MUTED, NOW, RADIUS, contactHasInstalled,
  Icons, NavBar, ContactAvatar, GoldDot, StatusPill,
  SparkyFAB, SparkyPill, ToastHost, ConfirmHost, EmptyHero,
  capitalize, formatPhone, formatPhoneInput, linkify, formatRelative, formatMoneyCents, buildContactSignals,
  formatDate, formatTime, formatTimeShort, formatDuration, dayKey,
  relTime, fmtTime, fmtDate,
  QB_C, QB_S, TIER_META, TIER_IDS, quickQuoteTotal, quickQuoteCompute,
  safeSetItem, checkSvImagery, isAddressableStreet, copyText,
});
