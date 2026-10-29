-- App Badante – accessi profilati, inviti, ricevute, scadenze
-- Da eseguire una volta nel SQL Editor di Supabase DOPO 01_schema.sql. Si può rieseguire.
--
-- Ruoli:
--   titolare    il datore di lavoro che ha creato il rapporto (rapporti.user_id): fa tutto
--   gestore     familiare o consulente: modifica dati, presenze e cedolini; non gestisce gli accessi
--   lettore     vede tutto ma non modifica
--   lavoratrice vede solo i propri cedolini confermati e firma la ricevuta

create table if not exists public.accessi (
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  ruolo       text not null check (ruolo in ('gestore','lettore','lavoratrice')),
  created_at  timestamptz not null default now(),
  primary key (rapporto_id, user_id)
);

create table if not exists public.inviti (
  id          uuid primary key default gen_random_uuid(),
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  email       text not null,
  ruolo       text not null check (ruolo in ('gestore','lettore','lavoratrice')),
  created_at  timestamptz not null default now(),
  unique (rapporto_id, email)
);

create table if not exists public.scadenze_fatte (
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  chiave      text not null,      -- es. 'inps-2026-T4'
  fatto_at    timestamptz not null default now(),
  nota        text,
  primary key (rapporto_id, chiave)
);

alter table public.cedolini add column if not exists ricevuta_at timestamptz;
alter table public.cedolini add column if not exists ricevuta_da text;
alter table public.cedolini add column if not exists pagato_at date;

alter table public.accessi enable row level security;
alter table public.inviti enable row level security;
alter table public.scadenze_fatte enable row level security;

-- Ruolo dell'utente corrente su un rapporto (null se nessuno)
create or replace function public.ruolo_su(rid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.rapporti r where r.id = rid and r.user_id = auth.uid()) then 'titolare'
    else (select a.ruolo from public.accessi a where a.rapporto_id = rid and a.user_id = auth.uid())
  end
$$;

-- ---------- rapporti ----------
drop policy if exists "solo proprietario" on public.rapporti;
drop policy if exists "leggi rapporti" on public.rapporti;
drop policy if exists "crea rapporto" on public.rapporti;
drop policy if exists "modifica rapporto" on public.rapporti;
drop policy if exists "elimina rapporto" on public.rapporti;
create policy "leggi rapporti" on public.rapporti for select to authenticated
  using (public.ruolo_su(id) is not null);
create policy "crea rapporto" on public.rapporti for insert to authenticated
  with check (user_id = auth.uid());
create policy "modifica rapporto" on public.rapporti for update to authenticated
  using (public.ruolo_su(id) in ('titolare','gestore'));
create policy "elimina rapporto" on public.rapporti for delete to authenticated
  using (user_id = auth.uid());

-- ---------- cedolini ----------
drop policy if exists "solo proprietario" on public.cedolini;
drop policy if exists "leggi cedolini" on public.cedolini;
drop policy if exists "scrivi cedolini" on public.cedolini;
create policy "leggi cedolini" on public.cedolini for select to authenticated
  using (
    public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore')
    or (public.ruolo_su(rapporto_id) = 'lavoratrice' and stato <> 'bozza')
  );
create policy "scrivi cedolini" on public.cedolini for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));
-- chi crea il cedolino può essere un gestore: user_id resta quello di chi scrive
alter table public.cedolini alter column user_id drop not null;

-- ---------- accessi e inviti: solo il titolare li gestisce ----------
drop policy if exists "leggi accessi" on public.accessi;
drop policy if exists "gestisci accessi" on public.accessi;
create policy "leggi accessi" on public.accessi for select to authenticated
  using (user_id = auth.uid() or public.ruolo_su(rapporto_id) = 'titolare');
create policy "gestisci accessi" on public.accessi for delete to authenticated
  using (public.ruolo_su(rapporto_id) = 'titolare');

drop policy if exists "gestisci inviti" on public.inviti;
create policy "gestisci inviti" on public.inviti for all to authenticated
  using (public.ruolo_su(rapporto_id) = 'titolare')
  with check (public.ruolo_su(rapporto_id) = 'titolare');

-- ---------- scadenze ----------
drop policy if exists "leggi scadenze" on public.scadenze_fatte;
drop policy if exists "scrivi scadenze" on public.scadenze_fatte;
create policy "leggi scadenze" on public.scadenze_fatte for select to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore'));
create policy "scrivi scadenze" on public.scadenze_fatte for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

-- Al login: trasforma gli inviti per la propria email in accessi
create or replace function public.accetta_inviti() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.accessi (rapporto_id, user_id, email, ruolo)
    select i.rapporto_id, auth.uid(), lower(i.email), i.ruolo
    from public.inviti i
    where lower(i.email) = lower(auth.jwt() ->> 'email')
  on conflict (rapporto_id, user_id) do update set ruolo = excluded.ruolo;
  get diagnostics n = row_count;
  delete from public.inviti where lower(email) = lower(auth.jwt() ->> 'email');
  return n;
end $$;

-- La lavoratrice (o chiunque abbia accesso) firma per ricevuta un cedolino confermato
create or replace function public.firma_ricevuta(cid uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare rid uuid; st text; adesso timestamptz := now();
begin
  select rapporto_id, stato into rid, st from public.cedolini where id = cid;
  if rid is null or public.ruolo_su(rid) is null then raise exception 'Cedolino non accessibile'; end if;
  if st = 'bozza' then raise exception 'Il cedolino non è ancora confermato'; end if;
  update public.cedolini set ricevuta_at = adesso, ricevuta_da = auth.jwt() ->> 'email' where id = cid;
  return adesso;
end $$;

revoke all on function public.accetta_inviti() from public, anon;
revoke all on function public.firma_ricevuta(uuid) from public, anon;
grant execute on function public.accetta_inviti() to authenticated;
grant execute on function public.firma_ricevuta(uuid) to authenticated;
grant execute on function public.ruolo_su(uuid) to authenticated;
