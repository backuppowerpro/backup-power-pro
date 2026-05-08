/**
 * request-permit-mailing — fires when the customer clicks "Mail it to me"
 * in the permit-document email.
 *
 * Action sequence on a valid click:
 *   1. Verify HMAC token + look up contact
 *   2. Generate the 8.5x11 mailing insert PDF (matches spec at
 *      wiki/Operations/Mailing Insert Template.md): return address +
 *      customer address positioned for #10 double-window envelope, fold
 *      lines at 3.667in / 7.333in, body letter in middle panel, Times
 *      Roman 11pt.
 *   3. Upload PDF to Supabase storage at permit-mailers/{contact_id}-{ts}.pdf
 *   4. Sign URL valid 14 days
 *   5. Stamp contact qualification_data + notes
 *   6. Text Key with the request + signed PDF URL so he can tap, save,
 *      print, fold, mail.
 *   7. Render BPP-branded "Got it" page back to the customer.
 *
 * The customer NEVER sees the mailer layout — that's Key's print-and-mail
 * artifact only. The customer just clicks the email button and gets a
 * confirmation page.
 *
 * Auth: public endpoint, signed-token gated (HMAC-SHA256 of contact_id +
 * timestamp, MAIL_REQUEST_SECRET env). 14-day TTL on tokens.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SECRET = Deno.env.get('MAIL_REQUEST_SECRET') || ''
const KEY_CELL = Deno.env.get('KEY_PHONE') || '+19414417996'

// SMS providers
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') || ''
const QUO_API_KEY = Deno.env.get('QUO_API_KEY') || ''
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'
const OPENPHONE_TEST_PHONES = (Deno.env.get('ASHLEY_OPENPHONE_TEST_PHONES') || '')
  .split(',').map(s => s.trim()).filter(Boolean)

// Hardcoded BPP return address. Mirror of crm/crm.html MAILING_RETURN_ADDRESS.
const RETURN_ADDR = {
  name: 'Key Goodson',
  company: 'Backup Power Pro',
  street: '22 Kimbell Ct',
  cityStateZip: 'Greenville, SC 29617',
}

const MAX_TOKEN_AGE_SEC = 14 * 24 * 3600

const html = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

// ── Token verification ──────────────────────────────────────────────
function base64UrlDecode(s: string): string {
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  return atob(s)
}
async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
async function verifyToken(contact_id: string, token: string): Promise<boolean> {
  if (!SECRET || !token) return false
  try {
    const decoded = base64UrlDecode(token)
    const dot = decoded.indexOf('.')
    if (dot < 0) return false
    const ts = parseInt(decoded.slice(0, dot), 10)
    const sig = decoded.slice(dot + 1)
    if (!ts || !sig) return false
    const ageSec = Math.floor(Date.now() / 1000) - ts
    if (ageSec < 0 || ageSec > MAX_TOKEN_AGE_SEC) return false
    const expected = await hmacSha256Hex(SECRET, `${contact_id}.${ts}`)
    return timingSafeEqual(sig, expected)
  } catch {
    return false
  }
}

// ── Mailing insert PDF generator ────────────────────────────────────
//
// Layout (Times Roman 11pt, US Letter portrait):
//   Return address: 0.38in top, 0.7in left  (top window of #10 envelope)
//   Customer addr:  2.00in top, 0.7in left  (bottom window of #10 envelope)
//   Fold line 1:    3.667in (dashed gray, with "fold" label)
//   Fold line 2:    7.333in (dashed gray, with "fold" label)
//   Letter body:    4.05in top, 0.85in left, 6.8in wide
//
// pdf-lib origin is bottom-left; we convert from "top-down inches" by
// computing y = pageHeight - (topInches * 72).
//
// Customer address spans up to 4 lines. Letter body wraps at ~6.8in.
async function buildMailingInsertPdf(args: {
  customerName: string
  customerStreet: string
  customerCityStateZip: string
}): Promise<Uint8Array> {
  const PAGE_W = 8.5 * 72
  const PAGE_H = 11 * 72
  const inToY = (topIn: number) => PAGE_H - topIn * 72
  const inToX = (leftIn: number) => leftIn * 72

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PAGE_W, PAGE_H])
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.73, 0.73, 0.73)

  // ── Return address (top-left) ─────────────────────────────────────
  let y = inToY(0.38) - 8.5  // first line baseline a bit below "0.38in top"
  const retX = inToX(0.7)
  const retSize = 8.5
  for (const line of [
    RETURN_ADDR.name,
    RETURN_ADDR.company,
    RETURN_ADDR.street,
    RETURN_ADDR.cityStateZip,
  ]) {
    page.drawText(line, { x: retX, y, size: retSize, font, color: black })
    y -= retSize * 1.35
  }

  // ── Customer address (bottom window of envelope) ──────────────────
  y = inToY(2.0) - 10.5
  const custX = inToX(0.7)
  const custSize = 10.5
  const custLines = [
    args.customerName,
    args.customerStreet,
    args.customerCityStateZip,
  ].filter(Boolean)
  for (const line of custLines) {
    page.drawText(line, { x: custX, y, size: custSize, font, color: black })
    y -= custSize * 1.55
  }

  // ── Fold lines (dashed gray) ──────────────────────────────────────
  for (const [topIn, label] of [[3.667, 'fold'], [7.333, 'fold']] as const) {
    const lineY = inToY(topIn)
    page.drawLine({
      start: { x: inToX(0.15), y: lineY },
      end: { x: PAGE_W - inToX(0.15), y: lineY },
      thickness: 0.75,
      color: gray,
      dashArray: [3, 3],
    })
    // tiny "fold" label below the line, centered
    const labelSize = 5.5
    const labelW = font.widthOfTextAtSize(`-- ${label} --`, labelSize)
    page.drawText(`-- ${label} --`, {
      x: (PAGE_W - labelW) / 2,
      y: lineY - 8,
      size: labelSize,
      font,
      color: gray,
    })
  }

  // ── Letter body (middle panel) ────────────────────────────────────
  // Wrap at ~6.8 inches wide.
  const bodyX = inToX(0.85)
  const bodyW = (8.5 - 0.85 - 0.85) * 72  // 6.8 in
  const bodySize = 11
  const lineHeight = bodySize * 1.65

  type Run = { text: string; bold?: boolean }
  type Para = Run[]
  const firstName = args.customerName.split(/\s+/)[0] || 'there'
  const paras: Para[] = [
    [{ text: `Hey ${firstName}!` }],
    [{ text: 'Enclosed is your permit documentation for the generator connection system we installed at your home. Please keep this document for your records, it is your official proof that the work was permitted and officially approved.' }],
    [
      { text: 'About your upcoming inspection: ', bold: true },
      { text: 'You will most likely need to be home when the inspector arrives to verify the work. Unfortunately, we are not able to choose a specific time of day, only the weekday.' },
    ],
    [
      { text: 'We recommend ', bold: true },
      { text: 'placing the enclosed permit copy inside your electrical panel door. When the inspector opens the panel, they will find it immediately, this keeps things moving smoothly with no delays on your end.' },
    ],
    [{ text: "If you have any questions before or after the inspection, don't hesitate to reach out. It was great working with you!" }],
    [{ text: 'Best,' }],
    [{ text: 'Key Goodson' }],
    [{ text: 'Backup Power Pro' }],
    [{ text: '(864) 400-5302' }],
  ]

  // Word-wrap a single Para with mixed bold runs.
  // We tokenize as "word + trailing whitespace" units so pdf-lib renders
  // each token's whitespace inline (drawing whitespace as a SEPARATE
  // drawText call eats it). This preserves spaces at bold/plain run
  // boundaries which the prior split(/(\s+)/) approach was losing.
  function wrapParagraph(para: Para, fontPlain: typeof font, fontBold: typeof bold, size: number, maxWidth: number): { runs: Run[]; widths: number[] }[] {
    const lines: { runs: Run[]; widths: number[] }[] = []
    let curLine: { runs: Run[]; widths: number[] } = { runs: [], widths: [] }
    let curWidth = 0
    for (const run of para) {
      const f = run.bold ? fontBold : fontPlain
      // Match each non-whitespace word plus any trailing whitespace
      // attached to that word. Final word in run may have no trailing ws.
      const words = run.text.match(/\S+\s*/g) || []
      for (const w of words) {
        const wWidth = f.widthOfTextAtSize(w, size)
        if (curWidth + wWidth > maxWidth && curWidth > 0) {
          // Strip the trailing whitespace from the previous-line last word
          // so the line ending isn't visually padded into the right margin.
          // Then push, start a fresh line with this word's stripped form
          // (drop its leading position-equivalent ws — it's already a
          // word-with-trailing-ws unit, no leading ws to worry about).
          lines.push(curLine)
          curLine = { runs: [], widths: [] }
          curWidth = 0
        }
        curLine.runs.push({ text: w, bold: run.bold })
        curLine.widths.push(wWidth)
        curWidth += wWidth
      }
    }
    if (curLine.runs.length) lines.push(curLine)
    return lines
  }

  let bodyY = inToY(4.05)
  for (let pi = 0; pi < paras.length; pi++) {
    const para = paras[pi]
    const isClosingBlock = pi >= 5  // "Best," and after
    const lines = wrapParagraph(para, font, bold, bodySize, bodyW)
    for (const line of lines) {
      let xCursor = bodyX
      for (let i = 0; i < line.runs.length; i++) {
        const run = line.runs[i]
        page.drawText(run.text, {
          x: xCursor,
          y: bodyY,
          size: bodySize,
          font: run.bold ? bold : font,
          color: black,
        })
        xCursor += line.widths[i]
      }
      bodyY -= lineHeight
    }
    // Paragraph spacing: extra space between paragraphs except inside the closing signature block
    if (pi < paras.length - 1 && !(isClosingBlock && pi >= 5)) {
      bodyY -= 0.16 * 72 - lineHeight + lineHeight  // ~0.16in extra
    }
    if (pi === 4) {
      // Big gap before "Best,"
      bodyY -= 0.18 * 72
    }
  }

  return await pdf.save()
}

// ── Storage upload + sign ────────────────────────────────────────────
async function uploadPdfAndSign(contactId: string, pdfBytes: Uint8Array): Promise<string | null> {
  const path = `${contactId}-${Date.now()}.pdf`
  const upResp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/permit-mailers/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SR}`,
        apikey: SR,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdfBytes,
    },
  )
  if (!upResp.ok) {
    console.warn('[permit-mailing] PDF upload failed', upResp.status, (await upResp.text()).slice(0, 200))
    return null
  }
  const signResp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/permit-mailers/${path}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${SR}`, apikey: SR, 'Content-Type': 'application/json' },
      // 14 days = 1209600 seconds. Long enough that Key has time to print + mail
      // even if he doesn't see the SMS for a few days.
      body: JSON.stringify({ expiresIn: 1209600 }),
    },
  )
  if (!signResp.ok) return null
  const sd = await signResp.json()
  return `${SUPABASE_URL}/storage/v1${sd.signedURL}`
}

// ── Notify Key (SMS) ─────────────────────────────────────────────────
async function notifyKey(message: string): Promise<void> {
  const useOpenPhone = OPENPHONE_TEST_PHONES.includes('*')
    || OPENPHONE_TEST_PHONES.includes(KEY_CELL)
  if (useOpenPhone && QUO_API_KEY) {
    try {
      await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
        body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_CELL], content: message }),
      })
      return
    } catch (e) {
      console.warn('[permit-mailing] openphone failed', e)
    }
  }
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: KEY_CELL, From: TWILIO_FROM, Body: message }).toString(),
      })
    } catch (e) {
      console.warn('[permit-mailing] twilio failed', e)
    }
  }
}

// ── HTML responses ──────────────────────────────────────────────────
const SUCCESS_HTML = (firstName: string, addressOnFile: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Got it · Backup Power Pro</title>
<style>
  body { margin: 0; min-height: 100vh; background: #f4f6fa; color: #14172a;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { width: 100%; max-width: 540px; background: #ffffff; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(11,31,59,0.10); overflow: hidden; }
  .top { background: #0b1f3b; padding: 18px 28px; border-bottom: 3px solid #ffba00;
    color: #ffffff; font-family: 'Outfit', 'Inter', sans-serif; font-weight: 800; font-size: 18px;
    letter-spacing: -0.02em; }
  .top .pro { color: #ffba00; }
  .body { padding: 36px 32px; }
  .pill { display: inline-block; background: #fff8e0; border: 1.5px solid #ffba00; border-radius: 100px;
    padding: 6px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; color: #8a5a00; margin-bottom: 18px; }
  h1 { font-family: 'Outfit', 'Inter', sans-serif; font-weight: 800; font-size: 30px; line-height: 1.15;
    letter-spacing: -0.02em; color: #0b1f3b; margin: 0 0 16px 0; }
  p { font-size: 16px; line-height: 1.55; color: #14172a; margin: 0 0 14px 0; }
  .meta { background: #f4f6fa; border: 1px solid rgba(11,31,59,0.07); border-radius: 10px;
    padding: 18px 20px; font-size: 14px; color: #14172a; margin-top: 18px; }
  .meta strong { color: #0b1f3b; font-weight: 600; }
  .foot { padding: 14px 28px; background: #fafbfc; border-top: 1px solid rgba(11,31,59,0.06);
    font-size: 12px; color: #6b7280; }
</style></head>
<body>
<div class="card">
  <div class="top">Backup Power <span class="pro">Pro</span></div>
  <div class="body">
    <span class="pill">★ Got it</span>
    <h1>Coming your way${firstName ? ', ' + firstName : ''}.</h1>
    <p>I'll drop your permit documentation in the mail today, with a pre-stamped envelope back to me. Should land in 2 to 4 business days.</p>
    <p>Sign the bottom in black or blue pen, drop it in the return envelope, that's it.</p>
    <div class="meta">
      <strong>Mailing to:</strong><br />
      ${addressOnFile || '(address on file)'}
    </div>
    <p style="margin-top: 18px; font-size: 13px; color: #6b7280;">If something looks wrong with that address, just reply to the email I sent or text me at (864) 863-7800.</p>
  </div>
  <div class="foot">Backup Power Pro · SC Licensed Electrician · Greenville, SC</div>
</div>
</body></html>`

const ERROR_HTML = (msg: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Hmm · Backup Power Pro</title>
<style>body { font-family: -apple-system, sans-serif; padding: 48px 24px; max-width: 540px; margin: 0 auto; color: #14172a; }
h1 { color: #0b1f3b; font-size: 24px; margin: 0 0 12px 0; }
p { line-height: 1.55; color: #4a4a5a; }
a { color: #0b1f3b; }</style></head>
<body><h1>That link didn't work</h1><p>${msg}</p>
<p>Just text me at <a href="tel:+18648637800">(864) 863-7800</a> and I'll handle it directly.</p>
<p style="margin-top: 32px; font-size: 12px; color: #6b7280;">Backup Power Pro</p>
</body></html>`

// ── Address normalization helper ────────────────────────────────────
function splitAddress(full: string): { street: string; cityStateZip: string } {
  const s = (full || '').trim().replace(/\s+/g, ' ')
  if (!s) return { street: '', cityStateZip: '' }
  // Try to split at last comma. Common shape: "412 Oakmont Dr, Greenville SC 29609"
  const idx = s.lastIndexOf(',')
  if (idx > 0 && idx < s.length - 4) {
    return { street: s.slice(0, idx).trim(), cityStateZip: s.slice(idx + 1).trim() }
  }
  // Fallback: split before last "City State Zip" pattern
  const m = s.match(/^(.*?)\s+([A-Za-z .]+ [A-Z]{2}\s+\d{5}(-\d{4})?)$/)
  if (m) return { street: m[1].trim(), cityStateZip: m[2].trim() }
  return { street: s, cityStateZip: '' }
}

// ── Server entry ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid') || ''
  const token = url.searchParams.get('t') || ''

  if (!cid || !token) return html(400, ERROR_HTML('Looks like part of the link is missing.'))

  const ok = await verifyToken(cid, token)
  if (!ok) return html(410, ERROR_HTML('That link expired (links work for 14 days). Send a fresh one and try again.'))

  const sb = createClient(SUPABASE_URL, SR)
  const { data: contact, error } = await sb.from('contacts')
    .select('id, name, phone, install_address, address, qualification_data, notes')
    .eq('id', cid)
    .maybeSingle()
  if (error || !contact) return html(404, ERROR_HTML('We could not find your record.'))

  const qd = (contact.qualification_data || {}) as Record<string, unknown>
  const lastReq = String(qd.permit_mailing_requested_at || '')
  const recentlyRequested = lastReq
    ? (Date.now() - new Date(lastReq).getTime()) < 24 * 3600 * 1000
    : false

  const firstName = String(contact.name || '').split(/\s+/)[0] || ''
  const addressFull = String(contact.install_address || contact.address || '')
  const { street, cityStateZip } = splitAddress(addressFull)

  if (recentlyRequested) {
    // Idempotent: don't re-generate or re-text Key. Just show success.
    return html(200, SUCCESS_HTML(firstName, addressFull))
  }

  // ── Generate the mailing-insert PDF ─────────────────────────────
  let pdfUrl: string | null = null
  try {
    const pdfBytes = await buildMailingInsertPdf({
      customerName: contact.name || '(name missing)',
      customerStreet: street,
      customerCityStateZip: cityStateZip,
    })
    pdfUrl = await uploadPdfAndSign(cid, pdfBytes)
  } catch (e) {
    console.error('[permit-mailing] PDF generation failed', e)
  }

  // ── Stamp contact ────────────────────────────────────────────────
  try {
    const newQd = {
      ...qd,
      permit_mailing_requested_at: new Date().toISOString(),
      permit_mailer_pdf_url: pdfUrl,
    }
    const newNotes = (contact.notes ? contact.notes + '\n' : '')
      + `__permit_mail_requested: ${new Date().toISOString()}`
      + (pdfUrl ? `\n__permit_mailer_pdf: ${pdfUrl}` : '')
    await sb.from('contacts')
      .update({ qualification_data: newQd, notes: newNotes })
      .eq('id', cid)
  } catch (e) {
    console.warn('[permit-mailing] contact stamp failed', e)
  }

  // ── SMS to Key ───────────────────────────────────────────────────
  const lastFour = (contact.phone || '').replace(/\D/g, '').slice(-4)
  const smsLines = [
    `📬 PERMIT MAIL REQUEST · ${firstName || 'Customer'}${lastFour ? ' (***' + lastFour + ')' : ''}`,
    addressFull || '(no address on file)',
    '',
    pdfUrl
      ? `Print this 8.5x11 letter:\n${pdfUrl}`
      : '⚠ PDF generation FAILED. Open CRM, click Generate Mail Insert manually.',
  ]
  await notifyKey(smsLines.join('\n'))

  return html(200, SUCCESS_HTML(firstName, addressFull))
})
