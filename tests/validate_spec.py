"""Valida o PACOTE DE ESPECIFICAÇÃO SIGA, não o aplicativo de produção.
Uso: python tests/validate_spec.py. Não acessa rede nem envia e-mails.
"""
from pathlib import Path
import json
import sqlite3
from datetime import date, timedelta

ROOT = Path(__file__).resolve().parent.parent


def main():
    schema = json.loads((ROOT / 'contracts/interpretacao.schema.json').read_text(encoding='utf-8'))
    fixture = json.loads((ROOT / 'contracts/fixtures_simulacao.json').read_text(encoding='utf-8'))
    menus = json.loads((ROOT / 'contracts/menus.json').read_text(encoding='utf-8'))
    assert schema['properties']['intentions']['type'] == 'array'
    assert fixture['synthetic_only'] is True
    assert len(fixture['steps']) == 12
    assert [s['step'] for s in fixture['steps']] == [f'SIM-{n:02d}' for n in range(1,13)]
    assert all('expected' in step for step in fixture['steps'])
    assert menus['menus']['MANAGER_APPROVAL_V1']['1'] == 'APPROVE_WITHOUT_RESERVATIONS'
    assert menus['menus']['MANAGER_DOUBLE_DECISION_V1']['B1'] == 'CREATE_CHILD_WITHOUT_RESERVATIONS'
    # Apenas checagens lógicas da data do cenário; não testa o futuro calendário do aplicativo.
    assert date(2026,10,26).weekday() == 0  # segunda
    assert date(2026,10,26) - timedelta(days=2) == date(2026,10,24)
    assert date(2026,10,24).weekday() == 5  # sábado
    assert date(2026,10,30) - timedelta(days=2) == date(2026,10,28)
    with sqlite3.connect(':memory:') as db:
        db.executescript((ROOT/'db/migrations/0001_initial.sql').read_text(encoding='utf-8'))
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        assert len(tables) >= 18, tables
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
    print('OK — arquivos JSON, 12 fixtures, opções dos menus, datas de referência e 18 tabelas SQLite.')
    print('ATENÇÃO — isto valida especificação; NÃO demonstra funcionalidades implementadas do SIGA.')


if __name__ == '__main__':
    main()
