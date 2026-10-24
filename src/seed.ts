import { createAggregate, transition } from "./domain.ts";
import { Repository } from "./repository.ts";
import type { Person } from "./types.ts";
export const demoPeople: Person[] = [
  {
    id: "u-gestor",
    name: "Emerson · gestor de demonstração",
    email: "gestor@exemplo.test",
    roles: ["GESTOR", "EXECUTOR"],
    department: "AE",
    active: true,
  },
  {
    id: "u-gabriela",
    name: "Gabriela · demonstração",
    email: "gabriela@exemplo.test",
    roles: ["EXECUTOR"],
    department: "SME",
    active: true,
  },
  {
    id: "u-ana",
    name: "Ana · demonstração",
    email: "ana@exemplo.test",
    roles: ["EXECUTOR"],
    department: "SLC",
    active: true,
  },
  {
    id: "u-bruno",
    name: "Bruno · demonstração",
    email: "bruno@exemplo.test",
    roles: ["EXECUTOR"],
    department: "SAP",
    active: true,
  },
  {
    id: "u-clara",
    name: "Clara · demonstração",
    email: "clara@exemplo.test",
    roles: ["EXECUTOR"],
    department: "AE",
    active: true,
  },
  {
    id: "u-sdg",
    name: "Direção-Geral",
    email: "sdg@exemplo.test",
    roles: ["SDG_LEITOR"],
    department: "AE",
    active: true,
  },
  {
    id: "u-admin",
    name: "Administrador",
    email: "admin@exemplo.test",
    roles: ["ADMIN"],
    department: "AE",
    active: true,
  },
  {
    id: "system",
    name: "Sistema SIGA",
    email: "sistema@exemplo.test",
    roles: [],
    department: null,
    active: true,
  },
];
export async function seedDirectory(repo: Repository) {
  const at = "2026-10-01T12:00:00Z";
  const statements = demoPeople.flatMap((p) => [
    repo.db
      .prepare(
        "INSERT OR IGNORE INTO users(id,full_name,email,active,created_at,department_id) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        p.id,
        p.name,
        p.email,
        1,
        at,
        p.department ? "dept-" + p.department.toLowerCase() : null,
      ),
    ...p.roles.map((r) =>
      repo.db
        .prepare("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,?)")
        .bind(p.id, r),
    ),
  ]);
  statements.push(
    repo.db
      .prepare(
        "INSERT OR IGNORE INTO mailbox_accounts(id,account_ref,provider,enabled,created_at) VALUES('mock-mailbox','siga.inbox@exemplo.test','gmail',0,?)",
      )
      .bind(at),
  );
  await repo.db.batch(statements);
}
export async function seedDemo(repo: Repository) {
  await seedDirectory(repo);
  if (await repo.db.prepare("SELECT id FROM demands LIMIT 1").first()) return;
  const titles = [
    "Vistoria preventiva das calhas do edifício-sede",
    "Renovação do contrato de limpeza",
    "Inventário dos equipamentos de informática",
    "Adequação de acessibilidade da entrada",
    "Aquisição de materiais de expediente",
    "Revisão do sistema de climatização",
    "Laudo das instalações elétricas",
    "Conferência de bens patrimoniais",
    "Pesquisa de preços para mobiliário",
    "Manutenção dos elevadores",
    "Projeto de prevenção contra incêndio",
    "Reposição do estoque de almoxarifado",
    "Análise da minuta de contrato",
    "Reparo na cobertura do arquivo",
    "Medição da obra de adequação",
    "Atualização do cadastro de fornecedores",
    "Vistoria das rotas de emergência",
    "Organização dos materiais permanentes",
    "Planejamento de contratação de serviços",
    "Relatório de consumo de energia",
    "Avaliação estrutural do anexo",
    "Conferência da entrega de suprimentos",
    "Gestão de garantia dos equipamentos",
    "Revisão do plano de manutenção",
  ];
  const manager = demoPeople[0];
  for (let i = 0; i < titles.length; i++) {
    const id = `demo-${i + 1}`,
      opened = `2026-10-${String(2 + (i % 19)).padStart(2, "0")}T13:00:00Z`;
    let s = createAggregate(
      id,
      `SIGA-2026-${String(i + 1).padStart(4, "0")}`,
      titles[i],
      "Registro inteiramente fictício para demonstrar o SIGA. Não representa atividade institucional real.",
      manager.id,
      opened,
    );
    s = transition(
      s,
      { id: id + ":create", type: "CREATE" },
      manager,
      demoPeople,
      opened,
    ).state;
    if (i % 7 !== 0) {
      const p = demoPeople[1 + (i % 4)];
      s = transition(
        s,
        {
          id: id + ":assign",
          type: "ASSIGN",
          personId: p.id,
          priority: (["ALTA", "MEDIA", "BAIXA"] as const)[i % 3],
        },
        manager,
        demoPeople,
        opened,
      ).state;
      s = transition(
        s,
        {
          id: id + ":accept",
          type: "ACCEPT",
          date: `2026-10-${String(19 + (i % 12)).padStart(2, "0")}`,
        },
        p,
        demoPeople,
        opened,
      ).state;
      if (i % 5 === 0) {
        s = transition(
          s,
          {
            id: id + ":declare",
            type: "DECLARE",
            reason: "Relatório e entrega declarados para demonstração.",
          },
          p,
          demoPeople,
          "2026-10-22T14:00:00Z",
        ).state;
      }
      if (i % 6 === 0) {
        s = transition(
          s,
          {
            id: id + ":declare",
            type: "DECLARE",
            reason: "Entrega declarada no ambiente de demonstração.",
          },
          p,
          demoPeople,
          "2026-10-21T14:00:00Z",
        ).state;
        s = transition(
          s,
          {
            id: id + ":close",
            type: "DECIDE",
            requestId: s.requests.at(-1)!.id,
            decision: "APPROVE",
          },
          manager,
          demoPeople,
          "2026-10-22T15:00:00Z",
        ).state;
      }
    }
    // Bootstrap preserves all real transition events and only initializes version once.
    await repo.save(s, null, id + ":seed");
  }
}
