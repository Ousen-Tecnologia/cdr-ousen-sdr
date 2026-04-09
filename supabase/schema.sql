-- =============================================================================
-- CDR App — Schema base
-- =============================================================================
-- Substitui a planilha "Controle CDR - SDR.xlsx" / aba LogPageSDR.
-- Pensado pra crescer de 1 → 15 SDRs, com RLS por usuário.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensões
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabela: sdrs
-- Vínculo entre auth.users (Supabase Auth) e o nome/role do SDR.
-- -----------------------------------------------------------------------------
create table if not exists public.sdrs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  nome        text not null,
  email       text unique,
  role        text not null default 'sdr' check (role in ('sdr', 'gestor', 'admin')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sdrs_user_id on public.sdrs (user_id);
create index if not exists idx_sdrs_ativo   on public.sdrs (ativo);

-- -----------------------------------------------------------------------------
-- Tabela: log_sdr
-- Cada linha = 1 registro de ligação (substitui a aba LogPageSDR).
-- -----------------------------------------------------------------------------
create table if not exists public.log_sdr (
  id                  bigint generated always as identity primary key,
  data_registro       date not null,
  sdr_id              uuid not null references public.sdrs(id) on delete restrict,
  call_result         text not null,        -- "Ligações Atendidas", "Não Atendidas", etc.
  lead_result         text,                 -- "Marcações Prospecção", "Sem Interesse", etc.
  decisor             text,                 -- "Sim" / "Não" / null
  nicho               text,                 -- "Advocacia", "Consultoria Tributária", "Outros"
  temperatura         text,                 -- "Quente" / "Frio"
  modelo_agendamento  text,                 -- "SDR"
  empresa             text,                 -- "Ousen" / "Arven"
  contact_people      int,                  -- coluna legada da planilha
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_log_sdr_data         on public.log_sdr (data_registro desc);
create index if not exists idx_log_sdr_sdr_id       on public.log_sdr (sdr_id);
create index if not exists idx_log_sdr_empresa      on public.log_sdr (empresa);
create index if not exists idx_log_sdr_temperatura  on public.log_sdr (temperatura);
create index if not exists idx_log_sdr_data_sdr     on public.log_sdr (data_registro, sdr_id);

-- Trigger pra manter updated_at em sincronia
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_log_sdr_updated_at on public.log_sdr;
create trigger trg_log_sdr_updated_at
  before update on public.log_sdr
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helper: descobrir o sdr atual (e role) a partir de auth.uid()
-- -----------------------------------------------------------------------------
create or replace function public.current_sdr()
returns public.sdrs language sql stable security definer as $$
  select * from public.sdrs where user_id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

-- sdrs: leitura aberta a todos os autenticados (metadados não sensíveis).
-- IMPORTANTE: NÃO referenciar public.sdrs dentro de policies de public.sdrs —
-- isso causa recursão infinita de RLS. Escritas administrativas devem ser
-- feitas via service_role em scripts server-side, não pelo cliente.
alter table public.sdrs enable row level security;

drop policy if exists sdrs_select on public.sdrs;
drop policy if exists sdrs_admin_write on public.sdrs;
drop policy if exists sdrs_select_authenticated on public.sdrs;

create policy sdrs_select_authenticated on public.sdrs
  for select
  to authenticated
  using (true);

-- log_sdr: SDR vê/escreve só o que é dele; gestor/admin veem tudo.
alter table public.log_sdr enable row level security;

drop policy if exists log_sdr_select on public.log_sdr;
create policy log_sdr_select on public.log_sdr
  for select
  to authenticated
  using (
    exists (
      select 1 from public.sdrs s
      where s.user_id = auth.uid()
        and (s.role in ('gestor', 'admin') or s.id = log_sdr.sdr_id)
    )
  );

drop policy if exists log_sdr_insert on public.log_sdr;
create policy log_sdr_insert on public.log_sdr
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sdrs s
      where s.user_id = auth.uid()
        and (s.role in ('gestor', 'admin') or s.id = log_sdr.sdr_id)
    )
  );

drop policy if exists log_sdr_update on public.log_sdr;
create policy log_sdr_update on public.log_sdr
  for update
  to authenticated
  using (
    exists (
      select 1 from public.sdrs s
      where s.user_id = auth.uid()
        and (s.role in ('gestor', 'admin') or s.id = log_sdr.sdr_id)
    )
  );

drop policy if exists log_sdr_delete on public.log_sdr;
create policy log_sdr_delete on public.log_sdr
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.sdrs s
      where s.user_id = auth.uid() and s.role in ('gestor', 'admin')
    )
  );
