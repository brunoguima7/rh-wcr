"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  UsersRound,
  ClipboardCheck,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  Download,
  Upload,
  Menu,
  X,
  LogOut,
  RefreshCw,
  FileCheck2,
  Clock3,
  UserPlus,
  Pencil,
  Building2,
  MapPin,
  Check,
  AlertCircle,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  Database,
  Person,
  Contract,
  Assignment,
  Requirement,
  Team,
  Table,
  employeeStatuses,
  emptyDatabase,
  demoDatabase,
  formatCpf,
  normalize,
  progressFor,
  requirementsFor,
  occupied,
  catalog,
} from "@/lib/model";
import { supabase, loadDatabase, saveRow, errorMessage } from "@/lib/supabase";
import {
  Badge,
  Button,
  Empty,
  Field,
  Input,
  Modal,
  Progress,
  Select,
} from "./ui";
import {
  AssignmentEditor,
  ContractEditor,
  PersonDetail,
  PersonEditor,
  RequirementEditor,
  TeamEditor,
} from "./editors";
import { Admission } from "./admission";
import { Importer } from "./importer";

type Page =
  | "overview"
  | "people"
  | "contracts"
  | "teams"
  | "admissions"
  | "checklists"
  | "settings";
const navigation = [
  { id: "overview", name: "Visão geral", icon: LayoutDashboard },
  { id: "people", name: "Pessoas", icon: Users },
  { id: "contracts", name: "Contratos", icon: BriefcaseBusiness },
  { id: "teams", name: "Equipes", icon: UsersRound },
  { id: "admissions", name: "Admissões", icon: ClipboardCheck },
  { id: "checklists", name: "Modelos de checklist", icon: FileCheck2 },
] as const;

export function Workspace() {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState(!supabase);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [category, setCategory] = useState("Todos");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<{
    kind: string;
    value?: Person | Contract | Assignment | Requirement | Team;
  } | null>(null);

  useEffect(() => {
    if (!supabase) {
      setDb(demoDatabase());
      setLoading(false);
      return;
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function refresh() {
    if (!supabase || preview) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wcr_members")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Seu usuário ainda não foi autorizado para acessar a WCR. Siga a etapa de autorização no guia de instalação.",
        );
      setDb(await loadDatabase());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user && !preview) void refresh();
    else if (!preview) setDb(emptyDatabase());
  }, [user, preview]); // Refresh also runs explicitly after every mutation.

  async function run(
    action: () => Promise<unknown>,
    success = "Alterações salvas.",
  ) {
    if (preview) {
      setNotice(
        "Esta é uma demonstração. Conecte o Supabase para cadastrar pessoas e salvar documentos.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setNotice(success);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(next: Page) {
    setPage(next);
    setSearch("");
    setMenu(false);
  }
  function open(
    kind: string,
    value?: Person | Contract | Assignment | Requirement | Team,
  ) {
    setError("");
    setModal({ kind, value });
  }
  const nameOf = (id: string) =>
    db.people.find((p) => p.id === id)?.name ?? "Pessoa";
  const contractName = (id: string) =>
    db.contracts.find((c) => c.id === id)?.name ?? "Contrato";
  const roleName = (id: string | null) =>
    db.roles.find((r) => r.id === id)?.name ?? "Sem função";
  const filteredAssignments = db.assignments.filter(
    (a) =>
      (!contractFilter || a.contract_id === contractFilter) &&
      (!status || a.status === status) &&
      normalize(`${nameOf(a.person_id)} ${roleName(a.role_id)}`).includes(
        normalize(search),
      ),
  );
  const filteredPeople = db.people.filter((p) => {
    const assignments = db.assignments.filter((a) => a.person_id === p.id);
    return (
      normalize(`${p.name} ${p.cpf ?? ""} ${p.phone} ${p.email}`).includes(
        normalize(search),
      ) &&
      (category === "Todos" || p.category === category) &&
      (!(contractFilter || status) ||
        assignments.some(
          (a) =>
            (!contractFilter || a.contract_id === contractFilter) &&
            (!status || a.status === status),
        ))
    );
  });
  const scope = db.assignments.filter(
    (a) => !contractFilter || a.contract_id === contractFilter,
  );
  const active = new Set(
    scope.filter((a) => a.status === "Ativo").map((a) => a.person_id),
  ).size;
  const pending = scope.filter((a) => a.status === "Em admissão");
  const slots = db.slots.filter(
    (s) =>
      !contractFilter ||
      db.teams.find((t) => t.id === s.team_id)?.contract_id === contractFilter,
  );
  const vacancies = slots.reduce(
    (sum, s) =>
      sum + Math.max(0, s.target - occupied(db, s.team_id, s.role_id)),
    0,
  );
  const missing = scope
    .filter((a) => a.status !== "Removido")
    .reduce(
      (sum, a) =>
        sum +
        requirementsFor(db, a).filter((r) => {
          const check = db.checks.find(
            (c) => c.assignment_id === a.id && c.requirement_id === r.id,
          );
          return (
            !check || check.status === "Pendente" || check.status === "Recusado"
          );
        }).length,
      0,
    );

  if (!loading && supabase && !user && !preview)
    return <Login onError={setError} error={error} />;

  return (
    <div className="min-h-screen">
      {menu && (
        <button
          className="fixed inset-0 z-30 bg-brand/30 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-24 items-center justify-between px-7">
          <img
            src="/logo-wcr.png"
            alt="WCR Saneamento"
            className="h-12 w-36 object-contain object-left"
          />
          <button
            className="lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="mx-5 mb-7 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-sm font-bold text-brand">WCR Pessoas</p>
          <p className="mt-1 text-xs text-slate-500">
            Gestão de recursos humanos
          </p>
        </div>
        <p className="px-7 text-xs font-bold tracking-[0.14em] text-slate-400">
          ÁREA DE TRABALHO
        </p>
        <nav className="mt-3 flex-1 space-y-1 px-3">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm ${page === item.id ? "bg-brand font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <item.icon size={19} strokeWidth={1.8} />
              {item.name}
              {item.id === "admissions" && pending.length > 0 && (
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-xs ${page === item.id ? "bg-white/20" : "bg-slate-100"}`}
                >
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={() => go("settings")}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm ${page === "settings" ? "bg-slate-100 text-brand" : "text-slate-600"}`}
          >
            <Settings size={19} />
            Configuração
          </button>
          <div className="mt-3 flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-bold text-brand">
              RH
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Equipe WCR</p>
              <p className="truncate text-xs text-slate-400">
                {preview ? "Prévia do sistema" : user?.email}
              </p>
            </div>
            {user && (
              <button
                aria-label="Sair"
                onClick={() => supabase?.auth.signOut()}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={23} />
            </button>
            <span className="text-sm text-slate-400">WCR Saneamento</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="hidden text-sm font-semibold sm:inline">
              {navigation.find((n) => n.id === page)?.name ?? "Configuração"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:block">
              {preview ? "Demonstração" : "Acesso interno"}
            </span>
            <button
              title="Atualizar dados"
              aria-label="Atualizar dados"
              disabled={loading || preview}
              onClick={refresh}
              className="rounded-lg p-2 hover:bg-slate-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>
        {preview && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-900 lg:px-9">
            <span>
              Prévia com dados fictícios. O banco compartilhado ainda não está
              conectado.
            </span>
            <button
              className="font-bold underline underline-offset-4"
              onClick={() => go("settings")}
            >
              Como conectar
            </button>
          </div>
        )}
        <main className="mx-auto max-w-[1600px] p-5 pb-12 lg:p-9">
          {(notice || error) && (
            <div
              role={error ? "alert" : "status"}
              className={`mb-5 flex items-start justify-between gap-4 rounded-lg border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-900"}`}
            >
              <span>{error || notice}</span>
              <button
                aria-label="Fechar mensagem"
                onClick={() => {
                  setNotice("");
                  setError("");
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand md:text-3xl">
                {page === "overview"
                  ? "Tudo pronto para cuidar das pessoas."
                  : (navigation.find((n) => n.id === page)?.name ??
                    "Configuração")}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {
                  {
                    overview:
                      "Acompanhe admissões, documentos e a formação das equipes.",
                    people: "Candidatos e funcionários em um só lugar.",
                    contracts: "Organize a operação de cada cliente.",
                    teams: "Distribua pessoas e acompanhe as vagas por função.",
                    admissions: "Do primeiro documento à aprovação do cliente.",
                    checklists:
                      "Defina as exigências de cada contrato, vínculo e função.",
                    settings: "Conecte a WCR e prepare os próximos acessos.",
                  }[page]
                }
              </p>
            </div>
            <div className="flex gap-2">
              {page === "people" && (
                <>
                  <Button secondary onClick={() => open("import")}>
                    <Upload size={16} />
                    Importar
                  </Button>
                  <Button onClick={() => open("person")}>
                    <Plus size={17} />
                    Nova pessoa
                  </Button>
                </>
              )}
              {page === "contracts" && (
                <Button onClick={() => open("contract")}>
                  <Plus size={17} />
                  Novo contrato
                </Button>
              )}
              {page === "teams" && (
                <Button onClick={() => open("team")}>
                  <Plus size={17} />
                  Nova equipe
                </Button>
              )}
              {page === "admissions" && (
                <Button onClick={() => open("assignment")}>
                  <Plus size={17} />
                  Nova admissão
                </Button>
              )}
              {page === "checklists" && (
                <Button onClick={() => open("requirement")}>
                  <Plus size={17} />
                  Novo item
                </Button>
              )}
              {page === "overview" && (
                <Button onClick={() => open("person")}>
                  <UserPlus size={17} />
                  Cadastrar pessoa
                </Button>
              )}
            </div>
          </div>
          {page !== "settings" && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-52 flex-1 sm:max-w-sm">
                <Search
                  size={17}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <Input
                  aria-label="Pesquisar"
                  placeholder={
                    page === "people"
                      ? "Buscar nome, CPF, telefone ou e-mail"
                      : "Pesquisar nesta página"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                aria-label="Filtrar por contrato"
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="sm:w-60"
              >
                <option value="">Todos os contratos</option>
                {db.contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {["people", "admissions"].includes(page) && (
                <Select
                  aria-label="Filtrar por status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="sm:w-44"
                >
                  <option value="">Todos os status</option>
                  {employeeStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {page === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Pessoas ativas",
                    value: active,
                    icon: Users,
                    caption: "Com vínculo ativo",
                    color: "text-emerald-600 bg-emerald-50",
                  },
                  {
                    label: "Em admissão",
                    value: pending.length,
                    icon: UserPlus,
                    caption: "Vínculos em andamento",
                    color: "text-sky-600 bg-sky-50",
                  },
                  {
                    label: "Itens pendentes",
                    value: missing,
                    icon: ClipboardCheck,
                    caption: "Pendentes ou recusados",
                    color: "text-amber-600 bg-amber-50",
                  },
                  {
                    label: "Vagas nas equipes",
                    value: vacancies,
                    icon: UsersRound,
                    caption: "Para completar a previsão",
                    color: "text-indigo-600 bg-indigo-50",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">
                        {metric.label}
                      </span>
                      <span className={`rounded-lg p-2.5 ${metric.color}`}>
                        <metric.icon size={19} />
                      </span>
                    </div>
                    <p className="mt-4 text-4xl font-bold tracking-tight text-brand">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {metric.caption}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-7 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <div>
                      <h2 className="font-bold text-brand">
                        Admissões em andamento
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Aprovações do checklist por pessoa
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        go("admissions");
                        setStatus("Em admissão");
                      }}
                      className="flex items-center gap-1 text-sm font-semibold text-ocean"
                    >
                      Ver todas
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {pending.length === 0 ? (
                    <Empty title="Nenhuma admissão em andamento" />
                  ) : (
                    pending
                      .filter((a) =>
                        normalize(nameOf(a.person_id)).includes(
                          normalize(search),
                        ),
                      )
                      .slice(0, 5)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => open("admission", a)}
                          className="flex w-full flex-wrap items-center gap-4 border-b border-slate-100 p-5 text-left last:border-0 hover:bg-slate-50"
                        >
                          <Avatar name={nameOf(a.person_id)} />
                          <div className="min-w-40 flex-1">
                            <p className="text-sm font-semibold">
                              {nameOf(a.person_id)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {roleName(a.role_id)} ·{" "}
                              {contractName(a.contract_id)}
                            </p>
                          </div>
                          <Progress value={progressFor(db, a).percentage} />
                          <ArrowUpRight size={16} className="text-slate-400" />
                        </button>
                      ))
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-bold text-brand">
                      Formação das equipes
                    </h2>
                    <UsersRound size={19} className="text-slate-400" />
                  </div>
                  <div className="space-y-6">
                    {db.teams
                      .filter(
                        (t) =>
                          (!contractFilter ||
                            t.contract_id === contractFilter) &&
                          normalize(t.name).includes(normalize(search)),
                      )
                      .slice(0, 4)
                      .map((team) => {
                        const teamSlots = slots.filter(
                          (s) => s.team_id === team.id,
                        );
                        const target = teamSlots.reduce(
                          (n, s) => n + s.target,
                          0,
                        );
                        const count = teamSlots.reduce(
                          (n, s) => n + occupied(db, team.id, s.role_id),
                          0,
                        );
                        return (
                          <div key={team.id}>
                            <div className="mb-2 flex justify-between text-sm">
                              <span className="font-semibold">{team.name}</span>
                              <span className="text-slate-400">
                                {count} / {target}
                              </span>
                            </div>
                            <Progress
                              value={
                                target
                                  ? Math.min(
                                      100,
                                      Math.round((count / target) * 100),
                                    )
                                  : 0
                              }
                              text={contractName(team.contract_id)}
                            />
                          </div>
                        );
                      })}
                    {!db.teams.length && (
                      <p className="text-sm text-slate-500">
                        Cadastre a primeira equipe em um contrato.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => go("teams")}
                    className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-brand hover:bg-slate-50"
                  >
                    Gerenciar equipes
                  </button>
                </section>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl bg-brand p-6 text-white">
                <span className="rounded-xl bg-white/10 p-3">
                  <FileCheck2 size={26} />
                </span>
                <div className="flex-1">
                  <h2 className="font-semibold">
                    Cada contrato, suas exigências.
                  </h2>
                  <p className="mt-1 text-sm text-sky-100">
                    Personalize documentos e tarefas para CLT, PJ, estágio e
                    funções específicas.
                  </p>
                </div>
                <button
                  onClick={() => go("checklists")}
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand"
                >
                  Ver modelos
                </button>
              </div>
            </>
          )}

          {page === "people" && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex gap-1">
                  {["Todos", "Candidato", "Funcionário"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-md px-3 py-2 text-sm ${category === c ? "bg-sky-50 font-semibold text-ocean" : "text-slate-500"}`}
                    >
                      {c === "Todos" ? "Todos" : `${c}s`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => void exportPeople()}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-500"
                >
                  <Download size={16} />
                  Exportar Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {["PESSOA", "CPF", "CONTATO", "VÍNCULOS", ""].map(
                        (h, i) => (
                          <th
                            key={i}
                            className="whitespace-nowrap px-5 py-4 font-semibold"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => (
                      <tr
                        key={person.id}
                        className="border-t border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4">
                          <button
                            onClick={() => open("person-detail", person)}
                            className="flex items-center gap-3 text-left"
                          >
                            <Avatar name={person.name} />
                            <span className="whitespace-nowrap">
                              <span className="block font-semibold">
                                {person.name}
                              </span>
                              <span className="mt-1 block text-xs text-slate-400">
                                {person.category}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td
                          className={`whitespace-nowrap px-5 py-4 ${!person.cpf ? "text-amber-700" : "text-slate-500"}`}
                        >
                          {formatCpf(person.cpf)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="block whitespace-nowrap">
                            {person.phone || "—"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {person.email}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            {db.assignments
                              .filter((a) => a.person_id === person.id)
                              .map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => open("admission", a)}
                                  className="flex items-center gap-2 whitespace-nowrap text-left text-xs"
                                >
                                  <Badge>{a.status}</Badge>
                                  {contractName(a.contract_id)}
                                </button>
                              ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            aria-label={`Editar ${person.name}`}
                            onClick={() => open("person", person)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredPeople.length && (
                <Empty
                  title="Nenhuma pessoa encontrada"
                  description="Ajuste os filtros ou cadastre uma pessoa."
                />
              )}
              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                {filteredPeople.length} pessoas encontradas
              </div>
            </section>
          )}

          {page === "contracts" && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {db.contracts
                .filter(
                  (c) =>
                    (!contractFilter || c.id === contractFilter) &&
                    normalize(`${c.name} ${c.client}`).includes(
                      normalize(search),
                    ),
                )
                .map((c) => (
                  <section
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <div className="flex items-start justify-between">
                      <span className="rounded-xl bg-sky-50 p-3 text-ocean">
                        <Building2 size={24} />
                      </span>
                      <Badge>{c.active ? "Ativo" : "Arquivado"}</Badge>
                    </div>
                    <h2 className="mt-5 text-lg font-bold text-brand">
                      {c.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{c.client}</p>
                    <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <MapPin size={14} />
                      {c.location || "Local não informado"}
                    </p>
                    <div className="my-5 grid grid-cols-3 gap-3 border-y border-slate-100 py-4">
                      {[
                        [
                          "Pessoas",
                          db.assignments.filter(
                            (a) =>
                              a.contract_id === c.id && a.status !== "Removido",
                          ).length,
                        ],
                        [
                          "Equipes",
                          db.teams.filter((t) => t.contract_id === c.id).length,
                        ],
                        [
                          "Itens",
                          db.requirements.filter(
                            (r) => r.contract_id === c.id && r.active,
                          ).length,
                        ],
                      ].map(([label, n]) => (
                        <div key={label}>
                          <p className="text-xl font-bold text-brand">{n}</p>
                          <p className="mt-1 text-xs text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button secondary onClick={() => open("contract", c)}>
                        Editar
                      </Button>
                      <Button
                        secondary
                        onClick={() => {
                          setContractFilter(c.id);
                          go("checklists");
                        }}
                      >
                        Checklist
                      </Button>
                    </div>
                  </section>
                ))}
              {!db.contracts.length && (
                <Empty
                  title="Cadastre seu primeiro contrato"
                  description="O contrato receberá um modelo inicial de checklist editável."
                />
              )}
            </div>
          )}

          {page === "teams" && (
            <div className="space-y-5">
              {db.teams
                .filter(
                  (t) =>
                    (!contractFilter || t.contract_id === contractFilter) &&
                    normalize(t.name).includes(normalize(search)),
                )
                .map((team) => (
                  <section
                    key={team.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                      <div>
                        <h2 className="font-bold text-brand">{team.name}</h2>
                        <p className="mt-1 text-xs text-slate-400">
                          {contractName(team.contract_id)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button secondary onClick={() => open("team", team)}>
                          <Pencil size={14} />
                          Editar vagas
                        </Button>
                        <Button onClick={() => open("team-assignment", team)}>
                          <Plus size={16} />
                          Adicionar pessoa
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500">
                          <tr>
                            {[
                              "FUNÇÃO",
                              "PREVISTAS",
                              "PREENCHIDAS",
                              "VAGAS",
                              "PESSOAS",
                            ].map((h) => (
                              <th key={h} className="px-5 py-3">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {db.slots
                            .filter((s) => s.team_id === team.id)
                            .map((slot) => {
                              const count = occupied(db, team.id, slot.role_id);
                              return (
                                <tr
                                  key={slot.id}
                                  className="border-t border-slate-100"
                                >
                                  <td className="px-5 py-4 font-semibold">
                                    {roleName(slot.role_id)}
                                  </td>
                                  <td className="px-5 py-4">{slot.target}</td>
                                  <td className="px-5 py-4">{count}</td>
                                  <td className="px-5 py-4">
                                    <Badge>
                                      {Math.max(0, slot.target - count)} vagas
                                    </Badge>
                                    {count > slot.target && (
                                      <p className="mt-1 text-xs text-amber-700">
                                        {count - slot.target} acima da previsão
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex flex-wrap gap-2">
                                      {db.memberships
                                        .filter((m) => m.team_id === team.id)
                                        .map((m) =>
                                          db.assignments.find(
                                            (a) => a.id === m.assignment_id,
                                          ),
                                        )
                                        .filter(
                                          (a) =>
                                            a &&
                                            a.role_id === slot.role_id &&
                                            a.status !== "Removido",
                                        )
                                        .map((a) => (
                                          <button
                                            key={a!.id}
                                            onClick={() =>
                                              open("admission", a!)
                                            }
                                            className="rounded-md bg-slate-50 px-2 py-1 text-xs text-ocean hover:underline"
                                          >
                                            {nameOf(a!.person_id)}
                                          </button>
                                        ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {!db.slots.some((s) => s.team_id === team.id) && (
                      <Empty title="Defina as funções e vagas desta equipe" />
                    )}
                    <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                      {
                        db.memberships.filter(
                          (m) =>
                            m.team_id === team.id &&
                            db.assignments.some(
                              (a) =>
                                a.id === m.assignment_id &&
                                a.status !== "Removido",
                            ),
                        ).length
                      }{" "}
                      pessoas alocadas · Vínculos removidos não ocupam vagas.
                    </div>
                  </section>
                ))}
              {!db.teams.length && <Empty title="Nenhuma equipe cadastrada" />}
            </div>
          )}

          {page === "admissions" && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {filteredAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-4 border-b border-slate-100 p-5 last:border-0"
                >
                  <Avatar name={nameOf(a.person_id)} />
                  <div className="min-w-48 flex-1">
                    <button
                      className="text-left font-semibold text-brand hover:underline"
                      onClick={() => open("admission", a)}
                    >
                      {nameOf(a.person_id)}
                    </button>
                    <p className="mt-1 text-xs text-slate-400">
                      {contractName(a.contract_id)} · {roleName(a.role_id)} ·{" "}
                      {a.employment}
                    </p>
                  </div>
                  <Badge>{a.status}</Badge>
                  <div className="w-36">
                    <Progress
                      value={progressFor(db, a).percentage}
                      text={`${progressFor(db, a).resolved}/${progressFor(db, a).total} resolvidos`}
                    />
                  </div>
                  <Button secondary onClick={() => open("admission", a)}>
                    Abrir checklist
                  </Button>
                  <button
                    aria-label={`Editar vínculo de ${nameOf(a.person_id)}`}
                    onClick={() => open("assignment", a)}
                    className="p-2 text-slate-400"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              ))}
              {!filteredAssignments.length && (
                <Empty
                  title="Nenhuma admissão encontrada"
                  description="Crie um vínculo entre uma pessoa e um contrato para começar."
                />
              )}
            </section>
          )}

          {page === "checklists" && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-5 text-sm leading-6 text-slate-500">
                As alterações valem para os vínculos existentes. Itens
                desativados mantêm seus arquivos e marcações para consulta. O
                status da pessoa permanece manual.
              </div>
              {db.requirements
                .filter(
                  (r) =>
                    (!contractFilter || r.contract_id === contractFilter) &&
                    normalize(r.title).includes(normalize(search)),
                )
                .sort((a, b) => a.position - b.position)
                .map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-start gap-4 border-b border-slate-100 p-5 last:border-0 ${r.active ? "" : "bg-slate-50 opacity-70"}`}
                  >
                    <span className="rounded-lg bg-slate-50 p-2 text-ocean">
                      {r.kind === "Documento" ? (
                        <FileCheck2 size={20} />
                      ) : (
                        <Check size={20} />
                      )}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand">
                        {r.title}
                        {!r.active && " (desativado)"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {r.instructions}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge>{r.employment}</Badge>
                        <Badge>
                          {r.role_id ? roleName(r.role_id) : "Todas as funções"}
                        </Badge>
                        {r.conditional && <Badge>Se aplicável</Badge>}
                        <span className="self-center text-xs text-slate-400">
                          {contractName(r.contract_id)}
                        </span>
                      </div>
                    </div>
                    <button
                      aria-label={`Editar ${r.title}`}
                      onClick={() => open("requirement", r)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                ))}
              {!db.requirements.length && (
                <Empty
                  title="Os modelos começam pelo contrato"
                  description="Ao criar um contrato, você recebe o catálogo inicial para personalizar."
                />
              )}
            </section>
          )}
          {page === "settings" && <SettingsPage configured={!!supabase} />}
          {loading && (
            <p role="status" className="mt-5 text-sm text-ocean">
              Carregando dados…
            </p>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal.kind === "admission"
              ? "Documentos e admissão"
              : modal.kind === "person-detail"
                ? "Cadastro da pessoa"
                : modal.kind === "import"
                  ? "Importar pessoas"
                  : modal.kind === "contract"
                    ? "Contrato"
                    : modal.kind === "team"
                      ? "Equipe e vagas"
                      : modal.kind === "requirement"
                        ? "Item do checklist"
                        : ["assignment", "team-assignment"].includes(modal.kind)
                          ? "Vínculo com o contrato"
                          : "Cadastro de pessoa"
          }
          wide={modal.kind === "admission" || modal.kind === "import"}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {preview && !["admission", "person-detail"].includes(modal.kind) && (
            <p className="mb-5 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
              Demonstração: você pode explorar o formulário. Para salvar,
              conecte o Supabase.
            </p>
          )}
          {modal.kind === "person" && (
            <PersonEditor
              db={db}
              person={modal.value as Person | undefined}
              busy={busy}
              run={run}
              onClose={() => setModal(null)}
            />
          )}
          {modal.kind === "person-detail" && (
            <PersonDetail
              person={modal.value as Person}
              db={db}
              onEdit={() => open("person", modal.value)}
              onAssignment={(a) => open("admission", a)}
            />
          )}
          {modal.kind === "contract" && (
            <ContractEditor
              db={db}
              contract={modal.value as Contract | undefined}
              busy={busy}
              run={run}
              onClose={() => setModal(null)}
            />
          )}
          {modal.kind === "team" && (
            <TeamEditor
              db={db}
              team={modal.value as Team | undefined}
              busy={busy}
              run={run}
              onClose={() => setModal(null)}
            />
          )}
          {["assignment", "team-assignment"].includes(modal.kind) && (
            <AssignmentEditor
              db={db}
              assignment={
                modal.kind === "assignment"
                  ? (modal.value as Assignment | undefined)
                  : undefined
              }
              team={
                modal.kind === "team-assignment"
                  ? (modal.value as Team)
                  : undefined
              }
              busy={busy}
              run={run}
              onClose={() => setModal(null)}
            />
          )}
          {modal.kind === "requirement" && (
            <RequirementEditor
              db={db}
              defaultContract={contractFilter || undefined}
              requirement={modal.value as Requirement | undefined}
              busy={busy}
              run={run}
              onClose={() => setModal(null)}
            />
          )}
          {modal.kind === "admission" && (
            <Admission
              db={db}
              assignment={
                db.assignments.find((a) => a.id === modal.value?.id) ??
                (modal.value as Assignment)
              }
              preview={preview}
              busy={busy}
              run={run}
            />
          )}
          {modal.kind === "import" && (
            <Importer
              db={db}
              run={run}
              busy={busy}
              onClose={() => setModal(null)}
            />
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-5 rounded-lg bg-sky-50 p-3 text-sm text-sky-900"
            >
              {notice}
            </p>
          )}
        </Modal>
      )}
    </div>
  );

  async function exportPeople() {
    try {
      const { exportPeopleWorkbook } = await import("@/lib/exports");
      await exportPeopleWorkbook(filteredPeople, db);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-ocean">
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}

function Login({
  error,
  onError,
}: {
  error: string;
  onError: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <img
          src="/logo-wcr.png"
          alt="WCR Saneamento"
          className="mb-9 h-16 w-44 object-contain object-left"
        />
        <h1 className="text-2xl font-bold text-brand">Entrar no WCR Pessoas</h1>
        <p className="mt-2 text-sm text-slate-500">Acesso da equipe interna.</p>
        <form
          className="mt-7 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = new FormData(e.currentTarget);
            try {
              const { error } = await supabase!.auth.signInWithPassword({
                email: String(form.get("email")),
                password: String(form.get("password")),
              });
              if (error) throw error;
            } catch (e) {
              onError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="E-mail">
            <Input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Senha">
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-xs leading-5 text-slate-400">
          O responsável pelo projeto cria e autoriza os acessos. Todos os
          usuários autorizados têm as mesmas permissões.
        </p>
      </div>
    </div>
  );
}

function SettingsPage({ configured }: { configured: boolean }) {
  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-brand">Banco compartilhado</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {configured
            ? "Conexão configurada. Os computadores que usarem o mesmo projeto Supabase acessarão os mesmos dados."
            : "O projeto Supabase ainda não foi conectado. A prévia usa apenas dados fictícios e não salva alterações."}
        </p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6">
          <li>
            Crie um projeto no plano Free em{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ocean underline"
            >
              supabase.com
            </a>
            .
          </li>
          <li>
            Execute o arquivo <code>supabase/migrations/001_wcr.sql</code> no
            SQL Editor.
          </li>
          <li>
            Crie seu usuário em Authentication → Users e autorize o acesso
            seguindo o README.
          </li>
          <li>
            Preencha <code>.env.local</code> com a URL e a chave pública do
            projeto, usando <code>.env.example</code> como modelo.
          </li>
          <li>Reinicie o sistema e entre com seu e-mail e senha.</li>
        </ol>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold text-brand">Arquivos e custos</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Os documentos serão guardados em armazenamento privado no Supabase. A
          execução local não exige hospedagem paga. O plano gratuito tem limites
          de armazenamento e transferência; confira o uso no painel do Supabase.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Formatos aceitos: PDF, JPG, PNG e WebP. Limite por arquivo: 50 MB.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold text-brand">Publicação futura</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Este projeto usa Next.js e pode ser publicado na Vercel com as mesmas
          variáveis de ambiente e o mesmo Supabase. O guia de instalação inclui
          os passos para publicar e para manter cópias de segurança.
        </p>
      </section>
    </div>
  );
}
