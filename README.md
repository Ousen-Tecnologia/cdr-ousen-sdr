# CDR App — Migração da planilha SDR pro Supabase + Vercel

Substitui a planilha `Controle CDR - SDR.xlsx` (Google Sheets + Apps Script) por uma
aplicação web Next.js usando Supabase como banco e Vercel como host.

## Status

- [x] Schema Supabase (`supabase/schema.sql`)
- [x] Views BI + FrioxQuente (`supabase/views.sql`)
- [x] Script de import histórico (`scripts/import_xlsx.py`)
- [ ] Seed 2026 aplicado no Supabase
- [ ] Scaffold Next.js (`web/`)
- [ ] Telas: login, /novo, /bi, /frio-quente
- [ ] Deploy Vercel

## Estrutura

```
output/cdr-app/
├── README.md
├── supabase/
│   ├── schema.sql       # Tabelas, índices, RLS
│   ├── views.sql        # Dashboards (v_bi_diario, v_frio_quente)
│   └── seed-2026.sql    # Gerado pelo import_xlsx.py
├── scripts/
│   └── import_xlsx.py   # Lê o xlsx e gera seed-2026.sql
└── web/                 # Next.js (a criar)
```

## Setup do banco

1. Abra o SQL editor do projeto Supabase.
2. Rode `supabase/schema.sql` (cria tabelas + RLS).
3. Rode `supabase/views.sql` (cria views dos dashboards).
4. Crie o usuário inicial do SDR via Auth do Supabase.
5. Pegue o `user_id` desse usuário e ajuste a constante `SDR_USER_ID`
   no topo do `seed-2026.sql` antes de executar.
6. Rode `supabase/seed-2026.sql` (importa as 2.109 linhas históricas de 2026).

## Regerar o seed

```bash
cd output/cdr-app
python3 scripts/import_xlsx.py \
  --input "/Users/henriquefleckharff/Downloads/Controle CDR - SDR.xlsx" \
  --output supabase/seed-2026.sql \
  --year 2026 \
  --until 2026-04-08
```
