-- DAO é uma unidade executora própria, além do consolidado de todas as áreas.
-- A migração cadastra a unidade; lotações pessoais são decisões auditadas separadas.
-- Não reclassificar demandas nem snapshots históricos.
INSERT OR IGNORE INTO departments(id,code,name,parent_id,active,created_at)
VALUES('dept-dao','DAO','DAO',NULL,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
