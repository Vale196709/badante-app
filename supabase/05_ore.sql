-- Badante di Maria – ore segnate dalla lavoratrice, da approvare (versione 1.6)
-- Da eseguire una volta nel SQL Editor di Supabase DOPO gli script 01–04. Si può rieseguire.

create table if not exists public.ore_segnate (
  rapporto_id uuid not null references public.rapporti(id) on delete cascade,
  data        date not null,
  ore         numeric(4,2) not null check (ore >= 0 and ore <= 24),
  extra       numeric(4,2) not null default 0 check (extra >= 0 and extra <= 12),
  extra_tipo  text not null default 'diurno' check (extra_tipo in ('diurno','notturno')),
  nota        text check (char_length(nota) <= 300),
  stato       text not null default 'in attesa' check (stato in ('in attesa','approvata','rifiutata')),
  segnato_da  text not null default (auth.jwt() ->> 'email'),
  deciso_da   text,
  deciso_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (rapporto_id, data)
);

alter table public.ore_segnate enable row level security;

drop policy if exists "leggi ore" on public.ore_segnate;
drop policy if exists "segna ore" on public.ore_segnate;
drop policy if exists "correggi ore" on public.ore_segnate;
drop policy if exists "decidi ore" on public.ore_segnate;
drop policy if exists "togli ore" on public.ore_segnate;

-- tutti i ruoli del rapporto le vedono
create policy "leggi ore" on public.ore_segnate for select to authenticated
  using (public.ruolo_su(rapporto_id) is not null);

-- la lavoratrice segna le sue ore: solo "in attesa", a suo nome, non nel futuro
create policy "segna ore" on public.ore_segnate for insert to authenticated
  with check (
    public.ruolo_su(rapporto_id) in ('titolare','gestore','lavoratrice')
    and stato = 'in attesa' and segnato_da = auth.jwt() ->> 'email'
    and data <= current_date + 1
  );

-- la lavoratrice corregge le ore finché non sono decise; titolare e gestore approvano o rifiutano
create policy "correggi ore" on public.ore_segnate for update to authenticated
  using (public.ruolo_su(rapporto_id) = 'lavoratrice' and stato in ('in attesa','rifiutata'))
  with check (public.ruolo_su(rapporto_id) = 'lavoratrice' and stato = 'in attesa' and segnato_da = auth.jwt() ->> 'email' and deciso_da is null);
create policy "decidi ore" on public.ore_segnate for update to authenticated
  using (public.ruolo_su(rapporto_id) in ('titolare','gestore'))
  with check (public.ruolo_su(rapporto_id) in ('titolare','gestore'));

create policy "togli ore" on public.ore_segnate for delete to authenticated
  using (
    public.ruolo_su(rapporto_id) in ('titolare','gestore')
    or (public.ruolo_su(rapporto_id) = 'lavoratrice' and stato = 'in attesa')
  );
