export const employeeStatuses = [
  "Pendente",
  "Em admissão",
  "Ativo",
  "Removido",
] as const;
export const itemStatuses = [
  "Pendente",
  "Recebido",
  "Enviado ao cliente",
  "Aprovado",
  "Recusado",
  "Não se aplica",
] as const;
export type EmployeeStatus = (typeof employeeStatuses)[number];
export type ItemStatus = (typeof itemStatuses)[number];
export type Entity = { id: string; created_at?: string };
export type Person = Entity & {
  name: string;
  cpf: string | null;
  phone: string;
  email: string;
  category: "Candidato" | "Funcionário";
  notes: string;
  boot_size: string;
  shirt_size: string;
  pants_size: string;
  transport: string;
};
export type Contract = Entity & {
  name: string;
  client: string;
  location: string;
  notes: string;
  active: boolean;
};
export type JobRole = Entity & { contract_id: string; name: string };
export type Team = Entity & { contract_id: string; name: string };
export type Slot = Entity & {
  team_id: string;
  role_id: string;
  target: number;
};
export type Assignment = Entity & {
  person_id: string;
  contract_id: string;
  role_id: string | null;
  employment: "CLT" | "PJ" | "Estágio";
  status: EmployeeStatus;
  start_date: string | null;
};
export type Membership = Entity & { assignment_id: string; team_id: string };
export type Requirement = Entity & {
  contract_id: string;
  title: string;
  instructions: string;
  kind: "Documento" | "Tarefa";
  employment: "Todos" | "CLT" | "PJ" | "Estágio";
  role_id: string | null;
  position: number;
  active: boolean;
  conditional: boolean;
};
export type Check = Entity & {
  assignment_id: string;
  requirement_id: string;
  status: ItemStatus;
  notes: string;
};
export type DocumentFile = Entity & {
  assignment_id: string;
  requirement_id: string;
  name: string;
  path: string;
  size: number;
  content_type: string;
};
export type Database = {
  people: Person[];
  contracts: Contract[];
  roles: JobRole[];
  teams: Team[];
  slots: Slot[];
  assignments: Assignment[];
  memberships: Membership[];
  requirements: Requirement[];
  checks: Check[];
  files: DocumentFile[];
};
export type Table = keyof Database;
export const emptyDatabase = (): Database => ({
  people: [],
  contracts: [],
  roles: [],
  teams: [],
  slots: [],
  assignments: [],
  memberships: [],
  requirements: [],
  checks: [],
  files: [],
});
export const cleanCpf = (value: string) => value.replace(/\D/g, "");
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function validCpf(value: string): boolean {
  const cpf = cleanCpf(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let digits = 9; digits <= 10; digits++) {
    const sum = [...cpf.slice(0, digits)].reduce(
      (total, n, i) => total + Number(n) * (digits + 1 - i),
      0,
    );
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(cpf[digits])) return false;
  }
  return true;
}

export function formatCpf(cpf: string | null) {
  return cpf
    ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : "CPF a preencher";
}

export function requirementsFor(
  db: Database,
  assignment: Assignment,
): Requirement[] {
  return db.requirements
    .filter(
      (r) =>
        r.active &&
        r.contract_id === assignment.contract_id &&
        (r.employment === "Todos" || r.employment === assignment.employment) &&
        (!r.role_id || r.role_id === assignment.role_id),
    )
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

export function progressFor(db: Database, assignment: Assignment) {
  const requirements = requirementsFor(db, assignment);
  const resolved = requirements.filter((r) => {
    const status = db.checks.find(
      (c) => c.assignment_id === assignment.id && c.requirement_id === r.id,
    )?.status;
    return status === "Aprovado" || status === "Não se aplica";
  }).length;
  return {
    total: requirements.length,
    resolved,
    percentage: requirements.length
      ? Math.round((resolved / requirements.length) * 100)
      : 0,
  };
}

export function occupied(db: Database, teamId: string, roleId: string) {
  const members = new Set(
    db.memberships
      .filter((m) => m.team_id === teamId)
      .map((m) => m.assignment_id),
  );
  return db.assignments.filter(
    (a) => members.has(a.id) && a.role_id === roleId && a.status !== "Removido",
  ).length;
}

export type CatalogItem = {
  title: string;
  instructions: string;
  employment: Requirement["employment"];
  kind: Requirement["kind"];
  conditional: boolean;
};
const document = (
  title: string,
  instructions = "",
  employment: Requirement["employment"] = "Todos",
  conditional = false,
): CatalogItem => ({
  title,
  instructions,
  employment,
  conditional,
  kind: "Documento",
});
export const catalog: CatalogItem[] = [
  document("RG", "Frente e verso legíveis."),
  document("CPF"),
  document("Foto 3x4", "Colorida e recente, com fundo neutro."),
  document(
    "Comprovante de residência",
    "Com CEP. Ajuste o prazo de emissão exigido pelo cliente.",
  ),
  document(
    "Declaração de residência",
    "Se o comprovante estiver em nome de terceiros, informar o vínculo com o titular.",
    "Todos",
    true,
  ),
  document(
    "Conta bancária",
    "Informe o banco e as modalidades aceitas pelo contrato.",
  ),
  document(
    "CTPS Digital completa",
    "Dados pessoais, contratos de trabalho e demais telas exigidas pelo cliente.",
    "CLT",
  ),
  document(
    "Certificado de reservista",
    "Conforme aplicabilidade e exigência do contrato.",
    "CLT",
    true,
  ),
  document("Título de eleitor", "Documento físico ou e-Título.", "CLT"),
  document(
    "Comprovante de escolaridade",
    "Histórico ou comprovante aceito pelo cliente.",
    "CLT",
  ),
  document(
    "PIS/PASEP",
    "Comprovante de inscrição ou informação no aplicativo FGTS.",
    "CLT",
  ),
  document(
    "Situação cadastral do CPF",
    "Comprovante solicitado pelo cliente.",
    "CLT",
  ),
  document(
    "Antecedentes criminais",
    "Verificar a exigência do contrato.",
    "CLT",
  ),
  document("Exame admissional / ASO", "Exame médico admissional.", "CLT"),
  document("CNH", "Para funções que exigem habilitação.", "Todos", true),
  document(
    "Certificados de cursos",
    "Cursos e treinamentos exigidos para a função.",
    "Todos",
    true,
  ),
  document(
    "Registro MTE",
    "Para técnico de segurança, quando exigido.",
    "CLT",
    true,
  ),
  document(
    "Documento do veículo",
    "Quando utilizar veículo na função.",
    "Todos",
    true,
  ),
  document("Certidão de casamento", "Se aplicável.", "CLT", true),
  document("CPF do cônjuge", "Se aplicável.", "CLT", true),
  document(
    "Certidão de nascimento dos filhos",
    "Filhos menores de 14 anos, conforme exigência.",
    "CLT",
    true,
  ),
  document(
    "CPF dos filhos",
    "Pode constar na certidão ou ser anexado separadamente.",
    "CLT",
    true,
  ),
  document(
    "Vacinação dos filhos",
    "Filhos menores de 7 anos, conforme exigência.",
    "CLT",
    true,
  ),
  document(
    "Escolaridade dos filhos",
    "Filhos menores de 14 anos, conforme exigência.",
    "CLT",
    true,
  ),
  document("CNPJ", "Comprovante de inscrição.", "PJ"),
  document(
    "CCMEI / CNAE",
    "Certificado de MEI com atividade compatível, quando aplicável.",
    "PJ",
    true,
  ),
  document(
    "Exame médico do prestador",
    "No CNPJ do prestador de serviços.",
    "PJ",
  ),
  document(
    "Autorização do proprietário do veículo",
    "Veículo de terceiro: observar exigência de firma reconhecida.",
    "PJ",
    true,
  ),
  document(
    "Documentos do proprietário do veículo",
    "RG, CPF e comprovante de endereço, conforme exigência.",
    "PJ",
    true,
  ),
  document(
    "Autorização de depósito em conta",
    "Conforme modelo exigido pelo contrato.",
    "PJ",
    true,
  ),
  document(
    "Declaração de matrícula",
    "Declaração ou atestado da faculdade.",
    "Estágio",
  ),
  document(
    "Ficha de estágio",
    "Ficha preenchida e completa conforme modelo do cliente.",
    "Estágio",
  ),
  {
    title: "Exame agendado",
    instructions: "Registrar data nas observações.",
    employment: "Todos",
    conditional: false,
    kind: "Tarefa",
  },
  {
    title: "Uniforme entregue",
    instructions: "Tamanhos disponíveis no cadastro da pessoa.",
    employment: "Todos",
    conditional: false,
    kind: "Tarefa",
  },
  {
    title: "Bota entregue",
    instructions: "Numeração disponível no cadastro da pessoa.",
    employment: "Todos",
    conditional: false,
    kind: "Tarefa",
  },
  {
    title: "Vale-transporte definido",
    instructions: "Registrar informações no cadastro.",
    employment: "CLT",
    conditional: false,
    kind: "Tarefa",
  },
];

export function demoDatabase(): Database {
  const db = emptyDatabase();
  db.contracts = [
    {
      id: "c1",
      name: "Operação Santos",
      client: "Cliente de exemplo",
      location: "Santos · SP",
      notes: "Contrato fictício para visualizar o sistema.",
      active: true,
    },
  ];
  db.roles = [
    { id: "r1", contract_id: "c1", name: "Ajudante de saneamento" },
    { id: "r2", contract_id: "c1", name: "Líder de equipe" },
  ];
  db.teams = [
    { id: "t1", contract_id: "c1", name: "Equipe A" },
    { id: "t2", contract_id: "c1", name: "Equipe B" },
  ];
  db.slots = [
    { id: "s1", team_id: "t1", role_id: "r1", target: 4 },
    { id: "s2", team_id: "t1", role_id: "r2", target: 1 },
    { id: "s3", team_id: "t2", role_id: "r1", target: 3 },
  ];
  db.people = [
    "Marina Exemplo",
    "Carlos Exemplo",
    "João Exemplo",
    "Ana Exemplo",
  ].map((name, i) => ({
    id: `p${i}`,
    name,
    cpf: null,
    phone: "",
    email: "",
    category: i === 3 ? "Candidato" : "Funcionário",
    notes: "Dados fictícios",
    boot_size: "",
    shirt_size: "",
    pants_size: "",
    transport: "",
  }));
  db.assignments = db.people
    .slice(0, 3)
    .map((p, i) => ({
      id: `a${i}`,
      person_id: p.id,
      contract_id: "c1",
      role_id: i === 0 ? "r2" : "r1",
      employment: "CLT",
      status: i === 0 ? "Ativo" : "Em admissão",
      start_date: null,
    }));
  db.memberships = db.assignments.map((a, i) => ({
    id: `m${i}`,
    assignment_id: a.id,
    team_id: "t1",
  }));
  db.requirements = catalog.map((item, i) => ({
    ...item,
    id: `q${i}`,
    contract_id: "c1",
    role_id: null,
    position: i,
    active: true,
  }));
  db.checks = db.assignments.flatMap((a, index) =>
    requirementsFor(db, a)
      .slice(0, index === 0 ? 26 : 8)
      .map((r, i) => ({
        id: `${a.id}-${r.id}`,
        assignment_id: a.id,
        requirement_id: r.id,
        status: "Aprovado",
        notes: "Exemplo",
      })),
  );
  return db;
}
