-- App Badante – tabelle annuali, archivio documenti, versamenti INPS, richieste ferie, firma
-- Da eseguire una volta nel SQL Editor di Supabase DOPO 01 e 02. Si può rieseguire.

-- ---------- Tabelle annuali (minimi CCNL, contributi INPS) inserite dall'utente ----------
create table if not exists public.tabelle_annuali (
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  anno        int  not null,
  dati        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (rapporto_id, anno)
);

-- ---------- Versamenti trimestrali INPS effettivamente pagati ----------
create table if not exists public.versamenti (
  rapporto_id    uuid not null references public.rapporti(id) on delete cascade,
  anno           int  not null,
  trimestre      int  not null check (trimestre between 1 and 4),
  data_pagamento date not null,
  importo        numeric(10,2) not null check (importo >= 0),
  nota           text,
  created_at     timestamptz not null default now(),
  primary key (rapporto_id, anno, trimestre)
);

-- ---------- Archivio documenti (file in Storage, bucket privato "documenti") ----------
create table if not exists public.documenti (
  id           uuid primary key default gen_random_uuid(),
  rapporto_id  uuid not null references public.rapporti(id) on delete cascade,
  nome         text not null,
  categoria    text not null default 'Altro',
  percorso     text not null unique,     -- <rapporto_id>/<uuid>-<nome file>
  dimensione   int,
  tipo_file    text,
  visibile_lavoratrice boolean not null default false,
  caricato_da  text,
  created_at   timestamptz not null default now()
);

-- ---------- Richieste di ferie e permessi della lavoratrice ----------
create table if not exists public.richieste (
  id           uuid primary key default gen_random_uuid(),
  rapporto_id  uuid not null references public.rapporti(id) on delete cascade,
  tipo         text not null check (tipo in ('F','P')),
  dal          date not null,
  al           date not null,
  ore          numeric(5,2),               -- solo per permessi di poche ore
  nota         text,
  stato        text not null default 'in attesa' check (stato in ('in attesa','approvata','rifiutata')),
  richiesta_da text not null default (auth.jwt() ->> 'email'),
  risposta     text,
  deciso_da    text,
  deciso_at    timestamptz,
  created_at   timestamptz not null default now(),
  check (al >= dal)
);

-- ---------- Firma grafica sulla ricevuta del cedolino ----------
alter table public.cedolini add column if not exists ricevuta_firma text;

alter table public.tabelle_annuali enable row level security;
alter table public.versamenti enable row level security;
alter table public.documenti enable row level security;
alter table public.richieste enable row level security;

-- tabelle annuali: tutti i ruoli le leggono (servono ai calcoli), titolare e gestore le modificano
drop policy if exists "leggi tabelle" on public.tabelle_annuali;
drop policy if exists "scrivi tabelle" on public.tabelle_annuali;
create policy "leggi tabelle" on public.tabelle_annuali for select to authenticated
  using (public.ruolo_su(rapporto_id) is not null);
create policy "scrivi tabelle" on public.tabelle_annuali for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

-- versamenti: non visibili alla lavoratrice
drop policy if exists "leggi versamenti" on public.versamenti;
drop policy if exists "scrivi versamenti" on public.versamenti;
create policy "leggi versamenti" on public.versamenti for select to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore'));
create policy "scrivi versamenti" on public.versamenti for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

-- documenti: la lavoratrice vede solo quelli condivisi con lei
drop policy if exists "leggi documenti" on public.documenti;
drop policy if exists "scrivi documenti" on public.documenti;
create policy "leggi documenti" on public.documenti for select to authenticated
  using (
    public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore')
    or (public.ruolo_su(rapporto_id) = 'lavoratrice' and visibile_lavoratrice)
  );
create policy "scrivi documenti" on public.documenti for all to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

-- richieste: la lavoratrice crea, vede e ritira le sue richieste in attesa; titolare e gestore decidono
drop policy if exists "leggi richieste" on public.richieste;
drop policy if exists "crea richieste" on public.richieste;
drop policy if exists "decidi richieste" on public.richieste;
drop policy if exists "ritira richieste" on public.richieste;
create policy "leggi richieste" on public.richieste for select to authenticated
  using (
    public.ruolo_su(rapporto_id) in ('titolare','gestore','lettore')
    or (public.ruolo_su(rapporto_id) = 'lavoratrice' and richiesta_da = auth.jwt() ->> 'email')
  );
create policy "crea richieste" on public.richieste for insert to authenticated
  with check (
    stato = 'in attesa' and richiesta_da = auth.jwt() ->> 'email'
    and public.ruolo_su(rapporto_id) in ('titolare','gestore','lavoratrice')
  );
create policy "decidi richieste" on public.richieste for update to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));
create policy "ritira richieste" on public.richieste for delete to authenticated
  using (
    public.ruolo_su(rapporto_id) in ('titolare','gestore')
    or (public.ruolo_su(rapporto_id) = 'lavoratrice' and richiesta_da = auth.jwt() ->> 'email' and stato = 'in attesa')
  );

-- firma ricevuta con firma grafica facoltativa (sostituisce la versione dello script 02)
drop function if exists public.firma_ricevuta(uuid);
create or replace function public.firma_ricevuta(cid uuid, firma text default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare rid uuid; st text; adesso timestamptz := now();
begin
  select rapporto_id, stato into rid, st from public.cedolini where id = cid;
  if rid is null or public.ruolo_su(rid) is null then raise exception 'Cedolino non accessibile'; end if;
  if st = 'bozza' then raise exception 'Il cedolino non è ancora confermato'; end if;
  if firma is not null and (length(firma) > 200000 or firma not like 'data:image/png;base64,%') then
    raise exception 'Firma non valida';
  end if;
  update public.cedolini
    set ricevuta_at = adesso, ricevuta_da = auth.jwt() ->> 'email', ricevuta_firma = coalesce(firma, ricevuta_firma)
    where id = cid;
  return adesso;
end $$;
revoke all on function public.firma_ricevuta(uuid, text) from public, anon;
grant execute on function public.firma_ricevuta(uuid, text) to authenticated;

-- ---------- Storage: bucket privato e regole sui file ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documenti', 'documenti', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- il primo livello del percorso è l'id del rapporto
create or replace function public.ruolo_su_file(p_percorso text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare rid uuid;
begin
  begin rid := split_part(p_percorso, '/', 1)::uuid; exception when others then return null; end;
  return public.ruolo_su(rid);
end $$;

create or replace function public.file_visibile_lavoratrice(p_percorso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.documenti d where d.percorso = p_percorso and d.visibile_lavoratrice)
$$;

drop policy if exists "badante leggi file" on storage.objects;
drop policy if exists "badante carica file" on storage.objects;
drop policy if exists "badante elimina file" on storage.objects;
create policy "badante leggi file" on storage.objects for select to authenticated
  using (
    bucket_id = 'documenti' and (
      public.ruolo_su_file(name) in ('titolare','gestore','lettore')
      or (public.ruolo_su_file(name) = 'lavoratrice' and public.file_visibile_lavoratrice(name))
    )
  );
create policy "badante carica file" on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and public.ruolo_su_file(name) in ('titolare','gestore'));
create policy "badante elimina file" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and public.ruolo_su_file(name) in ('titolare','gestore'));

grant execute on function public.ruolo_su_file(text) to authenticated;
grant execute on function public.file_visibile_lavoratrice(text) to authenticated;
