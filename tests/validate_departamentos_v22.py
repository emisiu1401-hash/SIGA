"""Teste estrutural OFFLINE de esquema e especificação SIGA v2.2; não é teste funcional do app."""
from pathlib import Path
import sqlite3
ROOT=Path(__file__).resolve().parent.parent

def main():
  db=sqlite3.connect(':memory:')
  db.execute('PRAGMA foreign_keys=ON')
  for name in ('0001_initial.sql','0002_dashboard_sei_priority.sql','0003_departamentos_painel_executivo.sql'):
      db.executescript((ROOT/'db/migrations'/name).read_text(encoding='utf-8'))
  depts=dict(db.execute('SELECT code,name FROM departments'))
  assert set(depts)=={'SLC','SAP','SME','AE'}
  for table,col in [('users','department_id'),('demands','origin_department_id'),('demands','current_department_id'),('assignments','department_snapshot_id')]:
      assert col in {r[1] for r in db.execute(f'PRAGMA table_info({table})')}
  db.execute("INSERT INTO users(id, full_name,email,created_at,department_id) VALUES ('u1','Pessoa Sintetica','p@example.invalid','2026-10-23T12:00:00Z','dept-slc')")
  db.execute("INSERT INTO users(id, full_name,email,created_at,department_id) VALUES ('u2','Outra Pessoa','o@example.invalid','2026-10-23T12:00:00Z','dept-ae')")
  db.execute("INSERT INTO demands(id,code,title,description,origin,manager_id,status,priority,opened_at,origin_department_id,current_department_id) VALUES ('d1','SIGA-2026-T001','Teste','', 'DASHBOARD','u1','EM_EXECUCAO','ALTA','2026-10-13T12:00:00Z','dept-slc','dept-slc')")
  db.execute("INSERT INTO stages(id,demand_id,step_no,title,status,created_at) VALUES ('s1','d1',1,'Fase','EM_EXECUCAO','2026-10-13T12:00:00Z')")
  db.execute("INSERT INTO assignments(id,stage_id,assignee_id,status,updated_at,current_due_date,department_snapshot_id) VALUES ('a1','s1','u1','ATIVA','2026-10-23T12:00:00Z','2026-10-20','dept-slc')")
  # Mudança da lotação atual sem reclassificar o histórico anterior.
  db.execute("UPDATE users SET department_id='dept-sap' WHERE id='u1'")
  assert db.execute("SELECT department_snapshot_id FROM assignments WHERE id='a1'").fetchone()[0]=='dept-slc'
  # Transferência não efetivada; unidade da demanda permanece SLC.
  db.execute("INSERT INTO assignments(id,stage_id,assignee_id,status,updated_at,department_snapshot_id) VALUES ('a2','s1','u2','AGUARDANDO_ACEITE','2026-10-23T12:00:00Z','dept-ae')")
  assert db.execute("SELECT current_department_id FROM demands WHERE id='d1'").fetchone()[0]=='dept-slc'
  # Aceite e transição seriam ações da camada de domínio, ainda NÃO implementadas.
  assert not db.execute('PRAGMA foreign_key_check').fetchall()
  spec=(ROOT/'docs/12_PAINEL_EXECUTIVO_E_DEPARTAMENTOS_V22.md').read_text(encoding='utf-8')
  assert all(f'RN-{n:03d}' in spec for n in range(27,36))
  assert all(f'CA-{n:02d}' in spec for n in range(40,55))
  assert (ROOT/'prototype/dashboard_sdg_demo.html').is_file()
  print('OK — migrations 0001+0002+0003; departamentos; FK; snapshots; cobertura estrutural RN/CA v2.2')
  print('OBS: não prova funcionamento do Dashboard nem integração Gmail/IA.')
if __name__=='__main__':main()
