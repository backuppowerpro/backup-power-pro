-- Neighbor postcard tracking table
-- Stores every card sent + QR scan data for A/B analysis

CREATE TABLE IF NOT EXISTS public.neighbor_cards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  source_address   text,                          -- customer address (the install location)
  recipient_line1  text NOT NULL,                 -- neighbor's address line 1
  recipient_city   text NOT NULL,
  recipient_state  text NOT NULL DEFAULT 'SC',
  recipient_zip    text NOT NULL,
  variation        text NOT NULL CHECK (variation IN ('A', 'B')),
  lob_id           text,                          -- Lob postcard ID (set after send)
  lob_url          text,                          -- Lob thumbnail URL
  scan_id          text UNIQUE NOT NULL,          -- unique token embedded in QR URL
  sent_at          timestamptz DEFAULT now(),
  scanned_at       timestamptz,                   -- first scan timestamp
  scan_count       integer NOT NULL DEFAULT 0,    -- total scans (repeat visits)
  converted        boolean NOT NULL DEFAULT false -- did this card turn into a lead?
);

CREATE INDEX IF NOT EXISTS idx_neighbor_cards_contact   ON public.neighbor_cards(contact_id);
CREATE INDEX IF NOT EXISTS idx_neighbor_cards_scan_id   ON public.neighbor_cards(scan_id);
CREATE INDEX IF NOT EXISTS idx_neighbor_cards_variation ON public.neighbor_cards(variation);
CREATE INDEX IF NOT EXISTS idx_neighbor_cards_sent_at   ON public.neighbor_cards(sent_at DESC);

-- Enable RLS (service role bypasses, anon can only read own scan)
ALTER TABLE public.neighbor_cards ENABLE ROW LEVEL SECURITY;

-- Only service role can write; track-card edge function uses service role
CREATE POLICY "service_role_full" ON public.neighbor_cards
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.neighbor_cards IS
  'Tracks Lob postcards sent to neighbors of completed BPP installs. scan_id is embedded in the QR code URL and recorded when the recipient scans it.';
