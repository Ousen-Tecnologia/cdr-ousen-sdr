-- =============================================================================
-- Migration 001 — Adiciona coluna modalidade_ligacao em log_sdr
-- =============================================================================
-- "Discovery Call" = ligação agendada (R1, FUP que virou DC, etc.)
-- "Tentando Contato" = tentativa de contato sem agendamento prévio
-- =============================================================================

alter table public.log_sdr
  add column if not exists modalidade_ligacao text
  check (modalidade_ligacao in ('Discovery Call', 'Tentando Contato'));

-- Preenche registros históricos como "Tentando Contato" (padrão seguro)
update public.log_sdr
  set modalidade_ligacao = 'Tentando Contato'
  where modalidade_ligacao is null;

-- Agora torna NOT NULL pra garantir preenchimento futuro
alter table public.log_sdr
  alter column modalidade_ligacao set not null,
  alter column modalidade_ligacao set default 'Tentando Contato';

-- Índice para filtrar métricas por modalidade
create index if not exists idx_log_sdr_modalidade on public.log_sdr (modalidade_ligacao);
