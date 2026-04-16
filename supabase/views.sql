-- =============================================================================
-- CDR App — Views dos dashboards
-- =============================================================================
-- Substituem as abas BI e FriovsQuente da planilha original.
-- Tudo é calculado on-the-fly a partir de log_sdr (sem dados duplicados).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_bi_diario  →  substitui aba "BI"
-- Agregado diário com contagens por call_result e lead_result.
-- -----------------------------------------------------------------------------
drop view if exists public.v_bi_diario cascade;
create view public.v_bi_diario as
select
  data_registro,
  empresa,
  sdr_id,
  modalidade_ligacao,

  -- Totais gerais
  count(*)                                                          as total_ligacoes,
  count(*) filter (where call_result in ('Ligações Atendidas',
                                          'Em contato Whatsapp',
                                          'Em contato E-mail'))     as total_contatos,
  count(*) filter (where lead_result is not null
                     and lead_result <> ''
                     and lead_result not like 'Marcações%'
                     and lead_result not like 'MKT - Marc%')        as total_perdido,
  count(*) filter (where decisor = 'Sim')                           as decisores_alcancados,

  -- Buckets de call_result
  count(*) filter (where call_result = 'Ligar Novamente')           as ligar_novamente,
  count(*) filter (where call_result = 'Não Atendidas')             as nao_atendidas,
  count(*) filter (where call_result = 'Ligações Atendidas')        as ligacoes_atendidas,
  count(*) filter (where call_result = 'Em contato Whatsapp')       as em_contato_whatsapp,
  count(*) filter (where call_result = 'Em contato E-mail')         as em_contato_email,

  -- Buckets de lead_result (perdas e marcações)
  count(*) filter (where lead_result = 'Contato sem Sucesso')       as contato_sem_sucesso,
  count(*) filter (where lead_result = 'Sem Interesse')             as sem_interesse,
  count(*) filter (where lead_result = 'Marcações Prospecção')      as marcacoes_prospeccao,
  count(*) filter (where lead_result = 'Já Possui MKT Interno')     as ja_possui_mkt_interno,
  count(*) filter (where lead_result = 'Ctt somente por E-mail/Whats') as ctt_somente_email_whats,
  count(*) filter (where lead_result = 'Pediu para Retornar')       as pediu_retornar,
  count(*) filter (where lead_result = 'Desqualificado')            as desqualificado,
  count(*) filter (where lead_result = 'Já Possui Agência/Assessoria') as ja_possui_agencia,
  count(*) filter (where lead_result = 'Nº Errado')                 as numero_errado,
  count(*) filter (where lead_result = 'Marcações Marketing')       as marcacoes_marketing,
  count(*) filter (where lead_result = 'Delay Recuperado')          as delay_recuperado,
  count(*) filter (where lead_result = 'CNPJ Baixado')              as cnpj_baixado,
  count(*) filter (where lead_result = 'Alta demanda')              as alta_demanda,
  count(*) filter (where lead_result = 'Marcou R1 e Sumiu')         as marcou_r1_sumiu,
  count(*) filter (where lead_result = 'Preencheu Errado MKT')      as preencheu_errado_mkt,

  -- MKT subtotais
  count(*) filter (where lead_result = 'MKT - Contato sem Sucesso')   as mkt_contato_sem_sucesso,
  count(*) filter (where lead_result = 'MKT - Desqualificado/Fora ICP') as mkt_desqualificado,
  count(*) filter (where lead_result = 'MKT - Fake/Concorrente')    as mkt_fake_concorrente,
  count(*) filter (where lead_result = 'MKT - Sem interesse')       as mkt_sem_interesse,
  count(*) filter (where lead_result = 'MKT - Marcou R1 e Sumiu')   as mkt_marcou_r1_sumiu

from public.log_sdr
group by data_registro, empresa, sdr_id, modalidade_ligacao;

-- -----------------------------------------------------------------------------
-- v_frio_quente  →  substitui aba "FriovsQuente"
-- Comparativo lado a lado por temperatura.
-- -----------------------------------------------------------------------------
drop view if exists public.v_frio_quente cascade;
create view public.v_frio_quente as
select
  data_registro,
  empresa,
  sdr_id,
  modalidade_ligacao,

  -- Totais por temperatura
  count(*) filter (where temperatura = 'Quente')                    as total_ligacoes_quente,
  count(*) filter (where temperatura = 'Frio')                      as total_ligacoes_frio,

  -- Atendidas
  count(*) filter (where temperatura = 'Quente'
                     and call_result = 'Ligações Atendidas')        as atendidas_quente,
  count(*) filter (where temperatura = 'Frio'
                     and call_result = 'Ligações Atendidas')        as atendidas_frio,

  -- Não atendidas
  count(*) filter (where temperatura = 'Quente'
                     and call_result = 'Não Atendidas')             as nao_atendidas_quente,
  count(*) filter (where temperatura = 'Frio'
                     and call_result = 'Não Atendidas')             as nao_atendidas_frio,

  -- Ligar novamente
  count(*) filter (where temperatura = 'Quente'
                     and call_result = 'Ligar Novamente')           as ligar_novamente_quente,
  count(*) filter (where temperatura = 'Frio'
                     and call_result = 'Ligar Novamente')           as ligar_novamente_frio,

  -- Em contato whatsapp
  count(*) filter (where temperatura = 'Quente'
                     and call_result = 'Em contato Whatsapp')       as ctt_whatsapp_quente,
  count(*) filter (where temperatura = 'Frio'
                     and call_result = 'Em contato Whatsapp')       as ctt_whatsapp_frio,

  -- Em contato e-mail
  count(*) filter (where temperatura = 'Quente'
                     and call_result = 'Em contato E-mail')         as ctt_email_quente,
  count(*) filter (where temperatura = 'Frio'
                     and call_result = 'Em contato E-mail')         as ctt_email_frio,

  -- Decisores
  count(*) filter (where temperatura = 'Quente' and decisor = 'Sim') as decisores_quente,
  count(*) filter (where temperatura = 'Frio'   and decisor = 'Sim') as decisores_frio,

  -- Marcações
  count(*) filter (where temperatura = 'Frio'
                     and lead_result = 'Marcações Prospecção')      as marcacoes_prospeccao_frio,
  count(*) filter (where lead_result = 'Marcações Marketing')       as marcacoes_marketing,
  count(*) filter (where lead_result like 'Marcações%'
                      or lead_result like 'MKT - Marc%')            as leads_total

from public.log_sdr
group by data_registro, empresa, sdr_id, modalidade_ligacao;
