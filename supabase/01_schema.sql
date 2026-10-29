-- App Badante – struttura del database (da eseguire una volta nel SQL Editor di Supabase)
-- Ogni riga appartiene a un utente: le regole RLS impediscono a chiunque altro di leggerla.

create table if not exists public.rapporti (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dati        jsonb not null,          -- anagrafica, livello, paga, orario, opzioni
  contatori   jsonb not null default '{}'::jsonb, -- ferie, TFR, 13ª, malattia
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.cedolini (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rapporto_id  uuid not null references public.rapporti(id) on delete cascade,
  anno         int  not null,
  mese         int  not null check (mese between 1 and 12),
  presenze     jsonb not null,         -- ore, ferie, malattia, straordinari del mese
  risultato    jsonb not null,         -- cedolino calcolato
  stato        text not null default 'bozza' check (stato in ('bozza','confermato','pagato')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (rapporto_id, anno, mese)
);

alter table public.rapporti enable row level security;
alter table public.cedolini enable row level security;

drop policy if exists "solo proprietario" on public.rapporti;
create policy "solo proprietario" on public.rapporti
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "solo proprietario" on public.cedolini;
create policy "solo proprietario" on public.cedolini
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- aggiorna automaticamente updated_at
create or replace function public.tocca_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists t_rapporti on public.rapporti;
create trigger t_rapporti before update on public.rapporti
  for each row execute function public.tocca_updated_at();
drop trigger if exists t_cedolini on public.cedolini;
create trigger t_cedolini before update on public.cedolini
  for each row execute function public.tocca_updated_at();
