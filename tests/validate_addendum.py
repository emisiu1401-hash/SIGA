"""Testes do ADENDO DE ESPECIFICAÇÃO 2.1, sem rede, sem API ou envio de e-mail.
Estes testes não significam que o aplicativo já está implementado.
"""
from pathlib import Path
import sqlite3
ROOT = Path(__file__).resolve().parent.parent

def main():
    db=sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript((ROOT/'db/migrations/0001_initial.sql').read_text(encoding='utf-8'))
    db.executescript((ROOT/'db/migrations/0002_dashboard_sei_priority.sql').read_text(encoding='utf-8'))
    cols={row[1] for row in db.execute('PRAGMA table_info(demands)')}
    assert {'priority','process_reference','process_url','process_url_status'} <= cols
    db.execute("INSERT INTO users(id,full_name,email,created_at) VALUES ('gestor','Gestor Ficticio','gestor@example.invalid','2026-10-23T00:00:00Z')")
    db.execute("INSERT INTO demands(id,code,title,description,origin,manager_id,status,priority,opened_at) VALUES ('d1','SIGA-2026-9001','Teste ficticio','', 'DASHBOARD','gestor','NOVA_TRIAGEM',NULL,'2026-10-23T00:00:00Z')")
    assert db.execute("SELECT priority FROM demands WHERE id='d1'").fetchone()[0] is None
    for p in ('BAIXA','MEDIA','ALTA'):
        db.execute('UPDATE demands SET priority=? WHERE id=?',(p,'d1'))
        assert db.execute("SELECT priority FROM demands WHERE id='d1'").fetchone()[0]==p
    try:
        db.execute("UPDATE demands SET priority='URGENTE' WHERE id='d1'")
        assert False, 'invalid priority should have failed'
    except sqlite3.IntegrityError:
        pass
    # Um banco armazena URL, mas não prova verificação de hostname ou existência do processo.
    db.execute("UPDATE demands SET process_url=?,process_url_status='AGUARDANDO_VALIDACAO' WHERE id='d1'",('https://sei.example.invalid/process/123',))
    assert db.execute("SELECT process_url FROM demands WHERE id='d1'").fetchone()[0].startswith('https://')
    docs=(ROOT/'docs/11_ADENDO_SDG_SEI_PRIORIDADES.md').read_text(encoding='utf-8')
    assert all(x in docs for x in ('RN-024','RN-025','RN-026','SDG_LEITOR','CA-39'))
    emails=(ROOT/'emails/MODELOS.md').read_text(encoding='utf-8')
    assert '{{bloco_link_sei_opcional}}' in emails and 'Prioridade' in emails
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    print('OK — adendo, SQL v2.1, enum de prioridades, URL SEI e contratos textuais de email.')
    print('ATENÇÃO — conformidade documental; não é teste funcional de dashboard, IA nem integração Gmail.')
if __name__=='__main__':main()
