import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  // Instantiate per-request to avoid cold-start state leak across invocations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const token = session.metadata?.invoice_token
    const contactId = session.metadata?.contact_id
    const amountPaid = (session.amount_total || 0) / 100 // convert cents to dollars

    if (token) {
      // Idempotency check: if this session was already processed, skip to avoid duplicate payments
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle()

      if (existing) {
        console.log(`stripe-webhook: session ${session.id} already processed, skipping`)
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Mark invoice as paid
      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'Card (Stripe)',
        })
        .eq('token', token)

      if (invoiceErr) {
        console.error('stripe-webhook: failed to update invoice:', invoiceErr.message)
        // Don't return 500 — Stripe will retry. Log and continue so the payment record still gets created.
      }

      // Record payment in payments table
      if (contactId) {
        const { error: paymentErr } = await supabase
          .from('payments')
          .insert([{
            contact_id: contactId,
            amount: amountPaid,
            method: 'Card (Stripe)',
            status: 'completed',
            stripe_session_id: session.id,
          }])

        if (paymentErr) {
          console.error('stripe-webhook: failed to insert payment:', paymentErr.message)
          // Return 500 so Stripe retries — but the idempotency check above will prevent double-processing
          return new Response(JSON.stringify({ error: 'DB write failed' }), { status: 500 })
        }

        // Auto-advance contact to Complete (stage 9)
        const { data: contact, error: contactErr } = await supabase
          .from('contacts')
          .select('stage')
          .eq('id', contactId)
          .single()

        if (contactErr) {
          console.error('stripe-webhook: failed to fetch contact:', contactErr.message)
        } else if (contact && (contact.stage || 1) < 9) {
          const oldStage = contact.stage || 1
          const { error: stageErr } = await supabase
            .from('contacts')
            .update({ stage: 9 })
            .eq('id', contactId)

          if (stageErr) {
            console.error('stripe-webhook: failed to advance stage:', stageErr.message)
          } else {
            await supabase
              .from('stage_history')
              .insert([{ contact_id: contactId, from_stage: oldStage, to_stage: 9 }])
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
