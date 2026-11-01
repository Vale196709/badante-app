-- Badante di Maria – registro delle modifiche (versione 1.8)
-- Da eseguire una volta nel SQL Editor di Supabase DOPO gli script 01–05. Si può rieseguire.
-- Ogni modifica a rapporto, presenze e cedolini, scadenze, tabelle, versamenti, documenti,
-- richieste, ore e accessi lascia una riga: chi, quando, cosa. Le righe non si possono
-- modificare né cancellare dall'app (solo dal SQL Editor).

create table if not exists public.registro (
  id          bigint generated always as identity primary key,
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  quando      timestamptz not null default now(),
  chi         text,
  tabella     text not null,
  azione      text not null check (azione in ('INSERT','UPDATE','DELETE')),
  oggetto     text,       -- es. "2026-10" per un cedolino, la chiave di una scadenza
  campi       text[],     -- campi cambiati (per il rapporto: le voci dei dati)
  dettaglio   jsonb       -- valori piccoli utili (stato, ore, importo)
);
create index if not exists registro_rapporto_quando on public.registro (rapporto_id, quando desc);

alter table public.registro enable row level security;
drop policy if exists "leggi registro" on public.registro;
create policy "leggi registro" on public.registro for select to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore'));
-- nessuna policy di scrittura: scrivono solo i trigger qui sotto

create or replace function public.registra_modifica() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  vecchio jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  nuovo   jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  riga    jsonb := coalesce(nuovo, vecchio);
  rid     uuid;
  ogg     text;
  cambiati text[];
  det     jsonb;
begin
  rid := case when tg_table_name = 'rapporti' then (riga ->> 'id')::uuid else (riga ->> 'rapporto_id')::uuid end;
  if rid is null then return null; end if;
  -- se il rapporto è stato appena cancellato non c'è più nulla da registrare
  if not exists (select 1 from public.rapporti where id = rid) then return null; end if;

  ogg := case tg_table_name
    when 'cedolini'        then (riga ->> 'anno') || '-' || lpad(riga ->> 'mese', 2, '0')
    when 'scadenze_fatte'  then riga ->> 'chiave'
    when 'tabelle_annuali' then riga ->> 'anno'
    when 'versamenti'      then (riga ->> 'anno') || ' T' || (riga ->> 'trimestre')
    when 'documenti'       then riga ->> 'nome'
    when 'richieste'       then (riga ->> 'tipo') || ' ' || (riga ->> 'dal') || '/' || (riga ->> 'al')
    when 'ore_segnate'     then riga ->> 'data'
    when 'accessi'         then riga ->> 'email'
    else null end;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'rapporti' then
      select array_agg(k order by k) into cambiati
        from (select key as k from jsonb_each(coalesce(nuovo -> 'dati', '{}')) union select key from jsonb_each(coalesce(vecchio -> 'dati', '{}'))) chiavi
        where (nuovo -> 'dati' -> k) is distinct from (vecchio -> 'dati' -> k);
    else
      select array_agg(key order by key) into cambiati
        from jsonb_each(nuovo) where key not in ('updated_at') and value is distinct from (vecchio -> key);
    end if;
    if cambiati is null then return null; end if; -- niente di cambiato davvero
  end if;

  det := jsonb_strip_nulls(jsonb_build_object(
    'stato', riga ->> 'stato',
    'stato_prima', case when tg_op = 'UPDATE' and (vecchio ->> 'stato') is distinct from (nuovo ->> 'stato') then vecchio ->> 'stato' end,
    'ore', riga ->> 'ore',
    'importo', riga ->> 'importo',
    'ruolo', riga ->> 'ruolo'));

  insert into public.registro (rapporto_id, chi, tabella, azione, oggetto, campi, dettaglio)
  values (rid, coalesce(auth.jwt() ->> 'email', 'sistema'), tg_table_name, tg_op, ogg, cambiati, nullif(det, '{}'::jsonb));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rapporti','cedolini','scadenze_fatte','tabelle_annuali','versamenti','documenti','richieste','ore_segnate','accessi'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists registro_modifiche on public.%I', t);
      execute format('create trigger registro_modifiche after insert or update or delete on public.%I for each row execute function public.registra_modifica()', t);
    end if;
  end loop;
end $$;
