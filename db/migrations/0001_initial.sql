-- SIGA v2 / SQLite-D1 — Esquema de referência (migrations versionadas)
-- Instantes ISO 8601 UTC; datas de negócio YYYY-MM-DD em America/Sao_Paulo.
-- Dados somente sintéticos nos primeiros incrementos.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('EXECUTOR','GESTOR','SDG_LEITOR','ADMIN')),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE IF NOT EXISTS mailbox_accounts (
  id TEXT PRIMARY KEY,
  account_ref TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_history_id TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demands (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  parent_demand_id TEXT REFERENCES demands(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('EMAIL','DASHBOARD','CHILD')),
  manager_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('NOVA_TRIAGEM','AGUARDANDO_ATRIBUICAO','EM_EXECUCAO','AGUARDANDO_VALIDACAO','ENCERRADA','ARQUIVADA_SEM_DEMANDA','CANCELADA')),
  process_reference TEXT,
  process_reference_verified INTEGER NOT NULL DEFAULT 0 CHECK(process_reference_verified IN (0,1)),
  priority TEXT DEFAULT 'NORMAL',
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT REFERENCES users(id),
  close_decision_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_demands_manager ON demands(manager_id);
CREATE INDEX IF NOT EXISTS idx_demands_parent ON demands(parent_demand_id);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  step_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDENTE','EM_EXECUCAO','CONCLUSA_DECLARADA','VALIDADA','CANCELADA')),
  created_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE(demand_id, step_no)
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id),
  assignee_id TEXT REFERENCES users(id),
  suggested_person_text TEXT,
  status TEXT NOT NULL CHECK(status IN ('PROPOSTA','AGUARDANDO_ACEITE','ATIVA','CONCLUSA_DECLARADA','VALIDADA','TRANSFERIDA','RECUSADA','CANCELADA')),
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK(is_primary IN (0,1)),
  original_due_date TEXT,
  current_due_date TEXT,
  due_revision INTEGER NOT NULL DEFAULT 0,
  accepted_at TEXT,
  declared_done_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(current_due_date, status);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON assignments(assignee_id, status);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES mailbox_accounts(id),
  demand_id TEXT REFERENCES demands(id),
  external_thread_id TEXT,
  active_menu_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(mailbox_id, external_thread_id)
);
CREATE TABLE IF NOT EXISTS inbound_messages (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES mailbox_accounts(id),
  conversation_id TEXT REFERENCES conversations(id),
  provider_message_id TEXT NOT NULL,
  rfc_message_id TEXT,
  provider_thread_id TEXT,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  fresh_body TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'RECEBIDO' CHECK(status IN ('RECEBIDO','EM_ANALISE','PROCESSADO','REVISAO','IGNORADO','ERRO')),
  error_code TEXT,
  UNIQUE(mailbox_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS idx_inbound_processing ON inbound_messages(status,received_at);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  demand_id TEXT REFERENCES demands(id),
  request_id TEXT,
  menu_type TEXT NOT NULL,
  menu_version INTEGER NOT NULL DEFAULT 1,
  option_map_json TEXT NOT NULL,
  sent_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('PREPARADO','ATIVO','RESPONDIDO','EXPIRADO','CANCELADO'))
);
CREATE TABLE IF NOT EXISTS ai_interpretations (
  id TEXT PRIMARY KEY,
  inbound_message_id TEXT NOT NULL REFERENCES inbound_messages(id),
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  menu_id TEXT REFERENCES menus(id),
  output_json TEXT NOT NULL,
  validated INTEGER NOT NULL DEFAULT 0 CHECK(validated IN (0,1)),
  validation_errors_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  assignment_id TEXT REFERENCES assignments(id),
  request_type TEXT NOT NULL CHECK(request_type IN ('PRORROGACAO','TRANSFERENCIA','APOIO','CONCLUSAO','DEMANDA_FILHA','OUTRA_PROVIDENCIA','CANCELAMENTO')),
  status TEXT NOT NULL CHECK(status IN ('INCOMPLETA','AGUARDANDO_GESTOR','AGUARDANDO_CONDICOES','AGUARDANDO_ACEITE','APROVADA','INDEFERIDA','CANCELADA','OBSOLETA')),
  proposed_json TEXT NOT NULL,
  justification TEXT,
  proposer_id TEXT REFERENCES users(id),
  decided_by TEXT REFERENCES users(id),
  decision_kind TEXT CHECK(decision_kind IN ('SEM_RESSALVAS','COM_RESSALVAS','INDEFERIDA','ESCLARECER','OUTRA') OR decision_kind IS NULL),
  conditions_text TEXT,
  decision_message_id TEXT REFERENCES inbound_messages(id),
  expected_demand_version INTEGER,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_pending ON change_requests(status,demand_id);

CREATE TABLE IF NOT EXISTS demand_events (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  assignment_id TEXT REFERENCES assignments(id),
  actor_id TEXT REFERENCES users(id),
  inbound_message_id TEXT REFERENCES inbound_messages(id),
  request_id TEXT REFERENCES change_requests(id),
  type TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  declared_or_verified TEXT NOT NULL DEFAULT 'SISTEMA' CHECK(declared_or_verified IN ('DECLARADO','VERIFICADO','SISTEMA')),
  occurred_at TEXT NOT NULL,
  event_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_events_timeline ON demand_events(demand_id,occurred_at);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES mailbox_accounts(id),
  conversation_id TEXT REFERENCES conversations(id),
  demand_id TEXT REFERENCES demands(id),
  menu_id TEXT REFERENCES menus(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('PENDENTE','SIMULADO','ENVIADO','ERRO','CANCELADO')),
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  dispatched_at TEXT,
  failure_reason TEXT
);
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  assignment_id TEXT REFERENCES assignments(id),
  notification_type TEXT NOT NULL CHECK(notification_type IN ('D_MINUS_2','SEM_PREVISAO','VALIDACAO_PENDENTE','ATRASADA','OUTRA')),
  due_revision INTEGER NOT NULL DEFAULT 0,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDENTE','ATENDIDA','CANCELADA','FALHA')),
  dedupe_key TEXT NOT NULL UNIQUE,
  outbound_message_id TEXT REFERENCES outbound_messages(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON scheduled_notifications(status,scheduled_for);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  work_date TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes >= 0),
  description TEXT,
  source_event_id TEXT REFERENCES demand_events(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS file_references (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  inbound_message_id TEXT REFERENCES inbound_messages(id),
  description TEXT,
  external_reference TEXT,
  verification_status TEXT NOT NULL DEFAULT 'DECLARADO' CHECK(verification_status IN ('DECLARADO','VERIFICADO','INVALIDO')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  details_json TEXT
);
