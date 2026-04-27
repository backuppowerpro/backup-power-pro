import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'
import { requireAnonOrServiceRole, allowRate } from '../_shared/auth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const gate = requireAnonOrServiceRole(req); if (gate) return gate
  const clientIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (!allowRate(`deposit-checkout:${clientIp}`, 20)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: corsHeaders })
  }

  try {
    const { proposal_token, pay_full } = await req.json()
    if (!proposal_token) {
      return new Response(JSON.stringify({ error: 'Missing proposal_token' }), { status: 400, headers: corsHeaders })
    }

    // Fetch proposal
    const { data: prop, error: propErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('token', proposal_token)
      .single()

    if (propErr || !prop) {
      return new Response(JSON.stringify({ error: 'Proposal not found' }), { status: 404, headers: corsHeaders })
    }

    // Superseded gate (Apr 27): refuse to create checkout for a stale quote
    // that's been replaced by a newer one. Customer should pay the latest
    // price, not whatever was in their inbox 3 weeks ago. Already-signed
    // proposals are exempt — once signed, the price was locked.
    if (prop.superseded_by && !prop.signed_at) {
      return new Response(JSON.stringify({
        error: 'This quote was replaced by a newer one. Please use the latest link or contact (864) 400-5302.',
      }), { status: 410, headers: corsHeaders })
    }

    const total = prop.total || 0
    if (!total || total <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid proposal total' }), { status: 400, headers: corsHeaders })
    }
    const depositAmt = Math.round(total * 0.5)
    const chargeAmt = pay_full ? total : depositAmt
    const invoiceNotes = pay_full ? 'full_payment' : 'deposit'
    const lineItemName = pay_full
      ? 'Full Payment — Storm-Ready Connection System'
      : '50% Deposit — Storm-Ready Connection System'

    // Check for existing invoice of same type
    const { data: existing } = await supabase
      .from('invoices')
      .select('token, status')
      .eq('proposal_id', prop.id)
      .eq('notes', invoiceNotes)
      .maybeSingle()

    if (existing && existing.status === 'paid') {
      return new Response(JSON.stringify({ error: 'Payment already completed' }), { status: 400, headers: corsHeaders })
    }

    let invToken: string

    if (existing) {
      // Reuse existing unpaid invoice
      invToken = existing.token
    } else {
      // Create invoice
      invToken = crypto.randomUUID()

      const { error: invErr } = await supabase
        .from('invoices')
        .insert([{
          token: invToken,
          contact_id: prop.contact_id,
          proposal_id: prop.id,
          contact_name: prop.contact_name,
          contact_email: prop.contact_email || null,
          contact_phone: prop.contact_phone || null,
          contact_address: prop.contact_address || null,
          total: chargeAmt,
          status: 'sent',
          notes: invoiceNotes,
          line_items: [{ name: lineItemName, amount: chargeAmt }],
        }])

      if (invErr) {
        console.error('Failed to create invoice:', invErr.message)
        return new Response(JSON.stringify({ error: 'Failed to create invoice: ' + invErr.message }), { status: 500, headers: corsHeaders })
      }
    }

    const baseUrl = 'https://backuppowerpro.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: lineItemName,
            description: pay_full
              ? 'Permitted, inspected, single-day install of generator inlet box + interlock kit by Backup Power Pro (Key Electric LLC, SC LIC #2942).'
              : '50% upfront — second 50% due on install day. Permitted, inspected, single-day install of generator inlet box + interlock kit. Backup Power Pro · SC LIC #2942.',
          },
          unit_amount: chargeAmt * 100,
        },
        quantity: 1,
      }],
      customer_email: prop.contact_email || undefined,
      // Brand the Stripe Checkout page itself — without these the customer
      // experiences a generic stripe.com hand-off mid-flow. With these set,
      // the header reads "Backup Power Pro" and the receipt + statement-
      // descriptor lineage carries through to the customer's bank statement.
      // (Apr 27 visual audit caught the brand drop.)
      payment_intent_data: {
        statement_descriptor_suffix: 'BPP',
        description: pay_full
          ? `Backup Power Pro install — full payment (proposal ${String(prop.id).slice(0, 8)})`
          : `Backup Power Pro install — 50% deposit (proposal ${String(prop.id).slice(0, 8)})`,
      },
      metadata: {
        invoice_token: invToken,
        contact_id: String(prop.contact_id || ''),
      },
      success_url: `${baseUrl}/proposal.html?token=${proposal_token}&deposit_paid=1`,
      cancel_url: `${baseUrl}/proposal.html?token=${proposal_token}`,
      payment_method_types: ['us_bank_account', 'card'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      },
    }, {
      // Idempotency key: same invoice + pay mode always returns the same session,
      // preventing duplicate charges if customer double-clicks or opens two tabs.
      idempotencyKey: `checkout-${invToken}-${pay_full ? 'full' : 'deposit'}`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
