-- App Badante – promemoria via email e notifiche sul telefono
-- Da eseguire una volta nel SQL Editor di Supabase DOPO 01, 02 e 03. Si può rieseguire.

-- Impostazioni dei promemoria per rapporto
create table if not exists public.promemoria (
  rapporto_id     uuid primary key references public.rapporti(id) on delete cascade,
  attivo          boolean not null default true,
  email           text[] not null default '{}',   -- destinatari delle email
  giorni_anticipo int not null default 3 check (giorni_anticipo between 1 and 30),
  updated_at      timestamptz not null default now()
);

-- Dispositivi iscritti alle notifiche (una riga per telefono o computer)
create table if not exists public.notifiche_dispositivi (
  endpoint    text primary key,
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email       text not null default (auth.jwt() ->> 'email'),
  chiavi      jsonb not null,                    -- { p256dh, auth }
  dispositivo text,
  created_at  timestamptz not null default now()
);

alter table public.promemoria enable row level security;
alter table public.notifiche_dispositivi enable row level security;

drop policy if exists "leggi promemoria" on public.promemoria;
drop policy if exists "scrivi promemoria" on public.promemoria;
create policy "leggi promemoria" on public.promemoria for select to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore'));
create policy "scrivi promemoria" on public.promemoria for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

-- ognuno iscrive e toglie i propri dispositivi; titolare e lettore (l'utente dei promemoria) li leggono
drop policy if exists "leggi dispositivi" on public.notifiche_dispositivi;
drop policy if exists "iscrivi dispositivo" on public.notifiche_dispositivi;
drop policy if exists "togli dispositivo" on public.notifiche_dispositivi;
create policy "leggi dispositivi" on public.notifiche_dispositivi for select to authenticated
  using (user_id = auth.uid() or public.ruolo_su(rapporto_id) in ('titolare','lettore'));
create policy "iscrivi dispositivo" on public.notifiche_dispositivi for insert to authenticated
  with check (user_id = auth.uid() and public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore'));
create policy "togli dispositivo" on public.notifiche_dispositivi for delete to authenticated
  using (user_id = auth.uid() or public.ruolo_su(rapporto_id) = 'titolare');
