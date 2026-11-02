-- Badante di Maria – registro degli errori dell'app (versione 1.9)
-- Da eseguire una volta nel SQL Editor di Supabase DOPO gli script 01–06. Si può rieseguire.
-- Quando l'app va in errore su un dispositivo, lascia qui una riga (senza dati del rapporto):
-- così titolare e gestori lo vedono in Impostazioni → Registro. Si tengono solo gli ultimi 90 giorni.

create table if not exists public.errori_app (
  id          bigint generated always as identity primary key,
  quando      timestamptz not null default now(),
  rapporto_id uuid references public.rapporti(id) on delete cascade,
  chi         text default (auth.jwt() ->> 'email'),
  ruolo       text,
  versione    text check (char_length(versione) <= 40),
  pagina      text check (char_length(pagina) <= 60),
  messaggio   text not null check (char_length(messaggio) <= 500),
  dettaglio   text check (char_length(dettaglio) <= 2000),
  dispositivo text check (char_length(dispositivo) <= 200)
);
create index if not exists errori_app_quando on public.errori_app (quando desc);

alter table public.errori_app enable row level security;
drop policy if exists "segnala errore" on public.errori_app;
drop policy if exists "leggi errori" on public.errori_app;
-- chiunque abbia fatto l'accesso può segnalare un errore, solo a proprio nome
create policy "segnala errore" on public.errori_app for insert to authenticated
  with check (chi = (auth.jwt() ->> 'email') and (rapporto_id is null or public.ruolo_su(rapporto_id) is not null));
-- li leggono titolare e gestori (quelli senza rapporto solo chi li ha generati)
create policy "leggi errori" on public.errori_app for select to authenticated
  using ((rapporto_id is not null and public.ruolo_su(rapporto_id) in ('titolare','gestore')) or chi = (auth.jwt() ->> 'email'));

-- pulizia: a ogni nuova segnalazione si cancellano quelle più vecchie di 90 giorni
create or replace function public.pulisci_errori() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.errori_app where quando < now() - interval '90 days';
  return null;
end $$;
drop trigger if exists pulisci_errori on public.errori_app;
create trigger pulisci_errori after insert on public.errori_app for each statement execute function public.pulisci_errori();
