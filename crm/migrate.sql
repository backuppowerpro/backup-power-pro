-- BPP CRM Migration - Run this in Supabase SQL Editor
-- Adds: Peace of Mind, Surge Protector, Quote Amount columns + Messages, Inspections, Payments tables

-- New columns on contacts
alter table contacts add column if not exists peace_of_mind boolean default false;
alter table contacts add column if not exists surge_protector boolean default false;
alter table contacts add column if not exists quote_amount numeric;

-- Messages table (Quo SMS)
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  contact_id uuid references contacts(id) on delete cascade,
  direction text not null,
  body text not null,
  status text default 'sent'
);
alter table messages enable row level security;
create policy "anon all" on messages for all using (true) with check (true);

-- Inspections table (Panel Safety Checklist)
create table if not exists inspections (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  contact_id uuid references contacts(id) on delete cascade,
  items jsonb not null default '[]',
  status text default 'not_started',
  completed_at timestamptz
);
alter table inspections enable row level security;
create policy "anon all" on inspections for all using (true) with check (true);

-- Payments table (Stripe Terminal)
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  contact_id uuid references contacts(id) on delete cascade,
  amount numeric not null,
  status text default 'pending',
  stripe_payment_id text,
  method text
);
alter table payments enable row level security;
create policy "anon all" on payments for all using (true) with check (true);
