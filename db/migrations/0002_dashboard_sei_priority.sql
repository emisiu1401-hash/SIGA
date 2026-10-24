-- SIGA v2.1 — Migração ADITIVA sobre 0001_initial.sql, compatível com D1/SQLite.
-- NÃO reescrever 0001 em instalações que já aplicaram sua versão anterior.
-- Reversão: restaurar snapshot/backup; SQLite não dá rollback simples de DROP COLUMN em todas as versões.
-- Aplicar somente uma vez pelo migrador versionado da aplicação.

ALTER TABLE demands ADD COLUMN process_url TEXT;
ALTER TABLE demands ADD COLUMN process_url_status TEXT NOT NULL DEFAULT 'NAO_INFORMADO'
  CHECK (process_url_status IN ('NAO_INFORMADO','AGUARDANDO_VALIDACAO','VALIDADO_DOMINIO','INVALIDO'));

-- O valor legado NORMAL é ambíguo; não inventar prioridade: converter para não informada.
UPDATE demands SET priority = NULL
WHERE priority IS NULL OR TRIM(priority) = '' OR UPPER(TRIM(priority)) = 'NORMAL';

-- As três categorias são as únicas classificações autorizadas.
-- O SQL legado tem DEFAULT 'NORMAL': o app DEVE inserir priority=NULL explicitamente
-- na triagem; ao atribuir um executor, validar priority NOT NULL e um dos 3 valores.
CREATE TRIGGER IF NOT EXISTS demands_priority_insert_v21
BEFORE INSERT ON demands
WHEN NEW.priority IS NOT NULL AND NEW.priority NOT IN ('BAIXA','MEDIA','ALTA')
BEGIN
  SELECT RAISE(ABORT, 'prioridade invalida: usar BAIXA, MEDIA ou ALTA');
END;
CREATE TRIGGER IF NOT EXISTS demands_priority_update_v21
BEFORE UPDATE OF priority ON demands
WHEN NEW.priority IS NOT NULL AND NEW.priority NOT IN ('BAIXA','MEDIA','ALTA')
BEGIN
  SELECT RAISE(ABORT, 'prioridade invalida: usar BAIXA, MEDIA ou ALTA');
END;

CREATE INDEX IF NOT EXISTS idx_demands_priority_status_v21 ON demands(priority,status);
-- Validar allowlist de URL e permissão de edição na API/regra determinística,
-- não confundir formato/domínio permitido com confirmação de conteúdo do SEI.
