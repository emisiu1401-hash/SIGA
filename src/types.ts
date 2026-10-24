export type Role = "GESTOR" | "EXECUTOR" | "SDG_LEITOR" | "ADMIN";
export type Person = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  department: string | null;
  active: boolean;
};
export type Status =
  | "NOVA_TRIAGEM"
  | "AGUARDANDO_ATRIBUICAO"
  | "EM_EXECUCAO"
  | "AGUARDANDO_VALIDACAO"
  | "ENCERRADA"
  | "ARQUIVADA_SEM_DEMANDA"
  | "CANCELADA";
export type Priority = "BAIXA" | "MEDIA" | "ALTA" | null;
export type Assignment = {
  id: string;
  personId: string;
  department: string;
  status:
    | "AGUARDANDO_ACEITE"
    | "ATIVA"
    | "CONCLUSA_DECLARADA"
    | "VALIDADA"
    | "TRANSFERIDA"
    | "RECUSADA";
  originalDue: string | null;
  due: string | null;
  dueRevision: number;
  acceptedAt: string | null;
  declaredAt: string | null;
  createdAt: string;
  reminderDate: string | null;
  reminderSent: boolean;
};
export type Request = {
  id: string;
  type:
    | "PRORROGACAO"
    | "TRANSFERENCIA"
    | "APOIO"
    | "CONCLUSAO"
    | "DEMANDA_FILHA";
  status:
    | "INCOMPLETA"
    | "AGUARDANDO_GESTOR"
    | "AGUARDANDO_CONDICOES"
    | "AGUARDANDO_ACEITE"
    | "APROVADA"
    | "INDEFERIDA"
    | "OBSOLETA";
  date: string | null;
  personId: string | null;
  title: string | null;
  reason: string;
  conditions: string | null;
  expectedVersion: number;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};
export type Event = {
  id: string;
  type: string;
  actorId: string;
  at: string;
  before: unknown;
  after: unknown;
  verification: "DECLARADO" | "VERIFICADO" | "SISTEMA";
  origin: string;
  reason: string;
};
export type Mail = {
  id: string;
  to: string;
  subject: string;
  body: string;
  menu: string | null;
  status: "SIMULADO" | "PENDENTE";
  at: string;
};
export type Aggregate = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  managerId: string;
  parentId: string | null;
  childIds: string[];
  processReference: string | null;
  processUrl: string | null;
  department: string | null;
  originDepartment: string | null;
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  version: number;
  assignments: Assignment[];
  requests: Request[];
  events: Event[];
  outbox: Mail[];
  activeMenus: Record<string, string>;
  validationAt: string | null;
  blockedAt: string | null;
  waitDays: number;
  workMinutes: number | null;
  clarifications: number;
};
export type Command = {
  id: string;
  type: string;
  expectedVersion?: number;
  personId?: string;
  priority?: Priority;
  date?: string;
  reason?: string;
  text?: string;
  title?: string;
  description?: string;
  processUrl?: string;
  processReference?: string;
  requestId?: string;
  decision?: string;
  conditions?: string;
  close?: boolean;
  createChild?: boolean;
  childCode?: string;
  childId?: string;
  minutes?: number;
  origin?: string;
  menu?: string;
};
export type RuntimeEnv = {
  DB: D1Database;
  DEPLOYMENT_MODE?: "demo" | "private" | "development";
  ACCESS_REQUIRED?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_ALLOWED_EMAILS?: string;
  SECRET_ENCRYPTION_KEY?: string;
  SIMULATION_MODE: string;
  PUBLIC_DEMO: string;
  AI_PROVIDER: string;
  AI_MODEL: string;
  SEI_ALLOWED_HOSTS: string;
  EMAIL_SEND_ENABLED: string;
  SESSION_SECRET?: string;
  MANAGER_PASSWORD?: string;
  EXECUTOR_PASSWORD?: string;
  ADMIN_PASSWORD?: string;
  AI_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  MAILBOX_ID?: string;
  OUTBOX_MAILBOX_ID?: string;
};
