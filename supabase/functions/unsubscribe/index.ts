/**
 * unsubscribe — public endpoint for the {{unsubscribe_url}} variable in
 * email footers + the RFC 8058 one-click List-Unsubscribe header.
 *
 * GET  ?cid=<contact_id>&t=<template> → renders BPP-branded confirm page
 *                                        with Undo button
 * POST ?cid=<contact_id>&t=<template> → RFC 8058 one-click. Bulk-mail
 *                                        clients hit this directly when
 *                                        the user clicks unsubscribe in
 *                                        Gmail/Apple Mail. Must respond
 *                                        without GET round-trip.
 *
 * Behavior:
 *   - Marketing-class template (anniversary, referral-nudge,
 *     storm-prep-reminder, pdf-download): adds __email_marketing_off
 *     so ALL marketing-class emails stop. (The single most common ask.)
 *   - Transactional template (proposal, invoice, install-reminder): noop
 *     visually but adds __email_transactional_off for audit. We continue
 *     to send transactional per CAN-SPAM exemption — the customer needs
 *     install info even if they unsubbed from marketing.
 *
 * Auth: PUBLIC. Customer cid is a UUID (not enumerable). Worst-case
 * attack: someone unsubscribes a real customer → annoying, reversible
 * via /preferences. Acceptable trade-off.
 *
 * Mail-client integration: send-email automatically adds the headers
 *   List-Unsubscribe: <https://.../unsubscribe?cid=X&t=Y>, <mailto:unsubscribe@bpp.com?subject=cid=X>
 *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
 * which makes Gmail show the "Unsubscribe" button at the top of the
 * email natively. This endpoint must accept POST without a body.
 *
 * STATUS: deployable + idle until first email is sent live.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const html = (status: number, body: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const MARKETING_TEMPLATES = new Set([
  'anniversary', 'referral-nudge', 'storm-prep-reminder', 'pdf-download',
])

function confirmPage(firstName: string, kind: 'marketing' | 'transactional', cid: string, template: string) {
  const headline = kind === 'marketing'
    ? "We won't bother you with marketing emails again."
    : "Got it, you're noted."
  const body = kind === 'marketing'
    ? "We've removed you from anniversary, referral, and seasonal emails. You'll still get transactional emails (proposal, invoice, install reminders) for any active install or quote. Per CAN-SPAM, we have to send those, no way around it."
    : "Just so you know, this email is transactional, it's required for service. We can't fully unsubscribe you from things like install reminders or invoices while you have an active project. But we've noted your preference, and a quick text to (864) 863-7800 will pause everything."
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unsubscribed · Backup Power Pro</title>
<style>
  body { margin: 0; min-height: 100vh; background: #f4f6fa; color: #14172a;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    display: flex; align-items: center; justify-content: center; padding: 24px; -webkit-font-smoothing: antialiased; }
  .card { width: 100%; max-width: 540px; background: #ffffff; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(11,31,59,0.10); overflow: hidden; }
  .top { background: #0b1f3b; padding: 18px 28px; border-bottom: 3px solid #ffba00;
    color: #fff; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; }
  .top .pro { color: #ffba00; }
  .body { padding: 36px 32px; }
  .pill { display: inline-block; background: #fff8e0; border: 1.5px solid #ffba00; border-radius: 100px;
    padding: 6px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; color: #8a5a00; margin-bottom: 18px; }
  h1 { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 28px; line-height: 1.15;
    letter-spacing: -0.02em; color: #0b1f3b; margin: 0 0 16px 0; }
  p { font-size: 16px; line-height: 1.55; color: #14172a; margin: 0 0 14px 0; }
  .undo { display: inline-block; margin-top: 18px; padding: 12px 22px; background: transparent; color: #0b1f3b;
    border: 2px solid #0b1f3b; border-radius: 8px; text-decoration: none; font-family: 'Outfit', sans-serif;
    font-weight: 700; font-size: 14px; cursor: pointer; }
  .ghost { display: inline-block; margin-top: 12px; padding: 10px 20px; background: transparent;
    color: #0b1f3b; text-decoration: underline; font-size: 13px; }
  .foot { padding: 14px 28px; background: #fafbfc; border-top: 1px solid rgba(11,31,59,0.06);
    font-size: 12px; color: #6b7280; text-align: center; }
</style></head>
<body>
<div class="card">
  <div class="top">Backup Power <span class="pro">Pro</span></div>
  <div class="body">
    <span class="pill">★ Unsubscribed</span>
    <h1>${headline}${firstName ? ' Take care, ' + firstName + '.' : ''}</h1>
    <p>${body}</p>
    <p>
      <a class="undo" href="javascript:fetch('/functions/v1/unsubscribe?cid=${cid}&t=${template}&undo=1', {method:'POST'}).then(()=>location.href='/preferences/?cid=${cid}')">Undo</a>
      <a class="ghost" href="/preferences/?cid=${cid}">Manage all preferences</a>
    </p>
  </div>
  <div class="foot">Backup Power Pro · SC Licensed Electrician · Greenville, SC</div>
</div>
</body></html>`
}

const ERR_HTML = `<!doctype html><html><head><meta charset="utf-8" /><title>Hmm</title>
<style>body{font-family:-apple-system,sans-serif;padding:48px 24px;max-width:540px;margin:0 auto;color:#14172a}h1{color:#0b1f3b;font-size:22px}</style></head>
<body><h1>That link didn't resolve</h1><p>Text Key at (864) 863-7800 and we'll handle it directly.</p></body></html>`

async function processUnsub(cid: string, template: string, undo: boolean): Promise<{ ok: boolean; firstName?: string; kind?: 'marketing' | 'transactional' }> {
  if (!cid) return { ok: false }
  const sb = createClient(SUPABASE_URL, SR)
  const { data: c } = await sb.from('contacts')
    .select('id, name, notes')
    .eq('id', cid)
    .maybeSingle()
  if (!c) return { ok: false }

  const isMarketing = MARKETING_TEMPLATES.has(template)
  const marker = isMarketing ? '__email_marketing_off' : '__email_transactional_off'
  const stamp = `${marker}: ${new Date().toISOString()} (template=${template})`
  let newNotes = String(c.notes || '')

  if (undo) {
    // Strip the marker(s)
    newNotes = newNotes.split('\n').filter(line => !line.startsWith(marker)).join('\n')
  } else if (!newNotes.includes(marker)) {
    newNotes = (newNotes ? newNotes + '\n' : '') + stamp
  }

  await sb.from('contacts').update({ notes: newNotes }).eq('id', cid)
  const firstName = String(c.name || '').split(/\s+/)[0]
  return { ok: true, firstName, kind: isMarketing ? 'marketing' : 'transactional' }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const cid = url.searchParams.get('cid') || ''
  const template = url.searchParams.get('t') || ''
  const undo = url.searchParams.get('undo') === '1'

  if (!cid) {
    if (req.method === 'POST') return json(400, { error: 'cid required' })
    return html(400, ERR_HTML)
  }

  const result = await processUnsub(cid, template, undo)

  if (!result.ok) {
    if (req.method === 'POST') return json(404, { error: 'not_found' })
    return html(404, ERR_HTML)
  }

  // RFC 8058 one-click expects 200 + minimal body, NO redirect, NO confirmation page
  if (req.method === 'POST') {
    return json(200, { ok: true, undone: undo, kind: result.kind })
  }

  // GET shows the human-friendly confirmation page
  return html(200, confirmPage(result.firstName || '', result.kind || 'marketing', cid, template))
})
