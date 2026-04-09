#!/usr/bin/env python3
"""
import_xlsx.py — Lê o "Controle CDR - SDR.xlsx" e gera um seed SQL pro Supabase.

Filtra registros por ano (default: 2026) e por data limite, e produz um arquivo
.sql que pode ser colado direto no SQL editor do Supabase. Os registros são
amarrados a um sdr via placeholder :sdr_id (psql) — antes de rodar no Supabase,
substitua a constante SDR_ID no topo do seed pelo UUID real do SDR.

Uso:
    python3 import_xlsx.py \\
        --input "/Users/henriquefleckharff/Downloads/Controle CDR - SDR.xlsx" \\
        --output ../supabase/seed-2026.sql \\
        --year 2026 \\
        --until 2026-04-08
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import openpyxl


SHEET_NAME = "LogPageSDR"

# Ordem das colunas na planilha (LogPageSDR):
# 0=Data, 1=Call, 2=Lead, 3=ContactPeople, 4=Decisor, 5=Responsavel,
# 6=Nicho, 7=Temperatura, 8=Modelo Agendamento, 9=Empresa
COL_DATA = 0
COL_CALL = 1
COL_LEAD = 2
COL_CONTACT = 3
COL_DECISOR = 4
COL_RESP = 5
COL_NICHO = 6
COL_TEMP = 7
COL_MODELO = 8
COL_EMPRESA = 9


def sql_str(value) -> str:
    if value is None or value == "":
        return "null::text"
    s = str(value).replace("'", "''")
    return f"'{s}'::text"


def sql_int(value) -> str:
    if value is None or value == "":
        return "null::int"
    try:
        return f"{int(value)}::int"
    except (TypeError, ValueError):
        return "null::int"


def sql_date(value) -> str:
    if value is None:
        return "null::date"
    if isinstance(value, dt.datetime):
        return f"'{value.date().isoformat()}'::date"
    if isinstance(value, dt.date):
        return f"'{value.isoformat()}'::date"
    return "null::date"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Gera seed SQL a partir do xlsx do CDR.")
    p.add_argument("--input", required=True, help="Caminho do .xlsx")
    p.add_argument("--output", required=True, help="Caminho do .sql de saída")
    p.add_argument("--year", type=int, default=2026, help="Ano a importar")
    p.add_argument(
        "--until",
        type=lambda s: dt.date.fromisoformat(s),
        default=None,
        help="Data limite (inclusive), formato YYYY-MM-DD",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser()
    output_path = Path(args.output).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.load_workbook(input_path, data_only=True, read_only=True)
    ws = wb[SHEET_NAME]

    rows_out: list[str] = []
    skipped = 0

    expected_cols = COL_EMPRESA + 1
    for raw in ws.iter_rows(min_row=2, values_only=True):
        # Pad linhas curtas (a coluna Empresa é nova e nem todas as linhas a têm)
        if len(raw) < expected_cols:
            raw = tuple(raw) + (None,) * (expected_cols - len(raw))
        d = raw[COL_DATA]
        if d is None or not hasattr(d, "year"):
            skipped += 1
            continue
        if d.year != args.year:
            continue
        if args.until and d.date() > args.until:
            continue

        values = (
            sql_date(d),
            "__SDR_ID__",
            sql_str(raw[COL_CALL]),
            sql_str(raw[COL_LEAD]),
            sql_str(raw[COL_DECISOR]),
            sql_str(raw[COL_NICHO]),
            sql_str(raw[COL_TEMP]),
            sql_str(raw[COL_MODELO]),
            sql_str(raw[COL_EMPRESA]),
            sql_int(raw[COL_CONTACT]),
        )
        rows_out.append("  (" + ", ".join(values) + ")")

    header = f"""-- =============================================================================
-- seed-2026.sql — Importação histórica gerada por scripts/import_xlsx.py
-- =============================================================================
-- {len(rows_out)} registros (ano {args.year}{f', até {args.until}' if args.until else ''}).
--
-- ANTES DE RODAR no SQL editor do Supabase:
--   1. Aplique antes: schema.sql e views.sql.
--   2. Crie o usuário do SDR (Daylon) via Authentication > Users.
--   3. Insira o registro dele em public.sdrs (ex):
--        insert into public.sdrs (user_id, nome, email, role)
--        values ('<UUID-DO-AUTH-USER>', 'Daylon', 'daylon@ousen.com.br', 'sdr');
--   4. Ajuste o email abaixo se necessário e rode este arquivo inteiro.
-- =============================================================================

with target_sdr as (
  select id from public.sdrs where email = 'daylon@ousen.com.br' limit 1
)
insert into public.log_sdr (
  data_registro,
  sdr_id,
  call_result,
  lead_result,
  decisor,
  nicho,
  temperatura,
  modelo_agendamento,
  empresa,
  contact_people
)
select
  v.data_registro,
  target_sdr.id,
  v.call_result,
  v.lead_result,
  v.decisor,
  v.nicho,
  v.temperatura,
  v.modelo_agendamento,
  v.empresa,
  v.contact_people
from target_sdr
cross join (values
"""

    # Cada row vira uma tupla do VALUES da subquery
    body_lines = []
    for r in rows_out:
        # r vem como "  (date, __SDR_ID__, ..., int)"
        # remover o placeholder do sdr_id (segundo campo), pois o sdr_id vem da CTE
        inner = r.strip().lstrip("(").rstrip(")")
        parts = [p.strip() for p in inner.split(",")]
        # parts[1] é __SDR_ID__ — remover
        parts = [parts[0]] + parts[2:]
        body_lines.append("  (" + ", ".join(parts) + ")")
    body = ",\n".join(body_lines)

    footer = """
) as v(
  data_registro,
  call_result,
  lead_result,
  decisor,
  nicho,
  temperatura,
  modelo_agendamento,
  empresa,
  contact_people
);
"""
    sql = header + body + footer

    output_path.write_text(sql, encoding="utf-8")
    print(f"OK — {len(rows_out)} linhas escritas em {output_path}")
    if skipped:
        print(f"   ({skipped} linhas puladas por data inválida)")


if __name__ == "__main__":
    main()
