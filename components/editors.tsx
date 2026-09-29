"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Assignment,
  Contract,
  Database,
  Person,
  Requirement,
  Team,
  catalog,
  cleanCpf,
  validCpf,
  employeeStatuses,
  formatCpf,
} from "@/lib/model";
import { supabase, saveRow } from "@/lib/supabase";
import { Button, Field, Input, Select, Textarea, Badge } from "./ui";

type Run = (
  action: () => Promise<unknown>,
  success?: string,
) => Promise<boolean | undefined>;
type BaseProps = { db: Database; busy: boolean; run: Run; onClose: () => void };
function values(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(new FormData(form)) as Record<string, string>;
}
function Footer({ busy }: { busy: boolean }) {
  return (
    <div className="flex justify-end border-t border-slate-100 pt-5">
      <Button disabled={busy} type="submit">
        {busy ? "Salvando…" : "Salvar alterações"}
      </Button>
    </div>
  );
}

export function PersonEditor({
  person,
  busy,
  run,
  onClose,
}: BaseProps & { person?: Person }) {
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = values(e.currentTarget);
        const cpf = cleanCpf(data.cpf);
        if ((cpf || !person) && !validCpf(cpf)) {
          setError("Informe um CPF válido, com 11 dígitos.");
          return;
        }
        setError("");
        if (
          await run(() =>
            saveRow("people", {
              ...data,
              id: person?.id ?? crypto.randomUUID(),
              cpf: cpf || null,
            }),
          )
        )
          onClose();
      }}
    >
      <Field label="Nome completo *">
        <Input
          name="name"
          defaultValue={person?.name}
          required
          maxLength={200}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="CPF *"
          hint={
            person && !person.cpf
              ? "Cadastro importado: preencha quando disponível."
              : undefined
          }
        >
          <Input
            name="cpf"
            defaultValue={person?.cpf ?? ""}
            required={!person}
            inputMode="numeric"
            maxLength={14}
          />
        </Field>
        <Field label="Telefone">
          <Input
            name="phone"
            type="tel"
            defaultValue={person?.phone}
            maxLength={30}
          />
        </Field>
      </div>
      <Field label="E-mail">
        <Input
          name="email"
          type="email"
          defaultValue={person?.email}
          maxLength={200}
        />
      </Field>
      <Field label="Cadastro">
        <Select name="category" defaultValue={person?.category ?? "Candidato"}>
          <option>Candidato</option>
          <option>Funcionário</option>
        </Select>
      </Field>
      <details
        className="rounded-lg border border-slate-200 p-4"
        open={!!person}
      >
        <summary className="cursor-pointer text-sm font-semibold text-brand">
          Uniforme e transporte
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Bota">
            <Input name="boot_size" defaultValue={person?.boot_size} />
          </Field>
          <Field label="Blusa">
            <Input name="shirt_size" defaultValue={person?.shirt_size} />
          </Field>
          <Field label="Calça">
            <Input name="pants_size" defaultValue={person?.pants_size} />
          </Field>
          <Field label="Vale-transporte">
            <Input name="transport" defaultValue={person?.transport} />
          </Field>
        </div>
      </details>
      <Field label="Observações">
        <Textarea name="notes" defaultValue={person?.notes} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Footer busy={busy} />
    </form>
  );
}

export function PersonDetail({
  person,
  db,
  onEdit,
  onAssignment,
}: {
  person: Person;
  db: Database;
  onEdit: () => void;
  onAssignment: (a: Assignment) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-brand">{person.name}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {formatCpf(person.cpf)} · {person.category}
          </p>
        </div>
        <Button secondary onClick={onEdit}>
          Editar cadastro
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
        {[
          ["Telefone", person.phone],
          ["E-mail", person.email],
          ["Bota", person.boot_size],
          ["Uniforme", `${person.shirt_size} / ${person.pants_size}`],
          ["VT", person.transport],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 break-words">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="whitespace-pre-wrap text-sm text-slate-500">
        {person.notes}
      </p>
      <h4 className="font-semibold text-brand">Contratos</h4>
      {db.assignments
        .filter((a) => a.person_id === person.id)
        .map((a) => (
          <button
            key={a.id}
            onClick={() => onAssignment(a)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 text-left text-sm"
          >
            <span>
              {db.contracts.find((c) => c.id === a.contract_id)?.name}
            </span>
            <Badge>{a.status}</Badge>
          </button>
        ))}
    </div>
  );
}

export function ContractEditor({
  contract,
  busy,
  run,
  onClose,
}: BaseProps & { contract?: Contract }) {
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = values(e.currentTarget);
        const success = await run(async () => {
          if (contract)
            return saveRow("contracts", {
              ...data,
              id: contract.id,
              active: data.active === "true",
            });
          const { error } = await supabase!.rpc("create_contract", {
            payload: data,
            items: catalog,
          });
          if (error) throw error;
        });
        if (success) onClose();
      }}
    >
      <Field label="Nome do contrato *">
        <Input
          name="name"
          defaultValue={contract?.name}
          placeholder="Ex.: Operação Santos"
          required
        />
      </Field>
      <Field label="Cliente *">
        <Input
          name="client"
          defaultValue={contract?.client}
          placeholder="Ex.: Sabesp"
          required
        />
      </Field>
      <Field label="Local">
        <Input
          name="location"
          defaultValue={contract?.location}
          placeholder="Cidade / UF"
        />
      </Field>
      <Field label="Observações">
        <Textarea name="notes" defaultValue={contract?.notes} />
      </Field>
      {contract ? (
        <Field label="Situação">
          <Select name="active" defaultValue={String(contract.active)}>
            <option value="true">Ativo</option>
            <option value="false">Arquivado</option>
          </Select>
        </Field>
      ) : (
        <p className="rounded-lg bg-sky-50 p-4 text-sm leading-6 text-sky-900">
          O contrato começa com {catalog.length} itens de documentos e tarefas,
          separados por vínculo. Você poderá editar, desativar e acrescentar
          itens no modelo.
        </p>
      )}
      <Footer busy={busy} />
    </form>
  );
}

export function AssignmentEditor({
  assignment,
  team,
  db,
  busy,
  run,
  onClose,
}: BaseProps & { assignment?: Assignment; team?: Team }) {
  const [contract, setContract] = useState(
    assignment?.contract_id ??
      team?.contract_id ??
      db.contracts.find((c) => c.active)?.id ??
      "",
  );
  const [person, setPerson] = useState(assignment?.person_id ?? "");
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    assignment
      ? db.memberships
          .filter((m) => m.assignment_id === assignment.id)
          .map((m) => m.team_id)
      : team
        ? [team.id]
        : [],
  );
  const [error, setError] = useState("");
  const existing =
    assignment ??
    db.assignments.find(
      (a) => a.person_id === person && a.contract_id === contract,
    );
  const teamIds = [
    ...new Set([
      ...(existing
        ? db.memberships
            .filter((m) => m.assignment_id === existing.id)
            .map((m) => m.team_id)
        : []),
      ...selectedTeams,
    ]),
  ];
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = values(e.currentTarget);
        if (person === "new" && !validCpf(data.cpf)) {
          setError("Informe um CPF válido para a nova pessoa.");
          return;
        }
        setError("");
        const payload = {
          id: existing?.id,
          person_id: person === "new" ? null : person,
          contract_id: contract,
          role_id: data.role_id || null,
          employment: data.employment,
          status: data.status,
          start_date: data.start_date || null,
          new_person:
            person === "new"
              ? { name: data.name, cpf: cleanCpf(data.cpf), phone: data.phone }
              : null,
        };
        const success = await run(async () => {
          const { error } = await supabase!.rpc("save_assignment", {
            payload,
            team_ids: assignment ? selectedTeams : teamIds,
          });
          if (error) throw error;
        });
        if (success) onClose();
      }}
    >
      <Field label="Contrato *">
        <Select
          value={contract}
          disabled={!!assignment || !!team}
          required
          onChange={(e) => {
            setContract(e.target.value);
            setSelectedTeams([]);
          }}
        >
          <option value="">Selecione</option>
          {db.contracts
            .filter((c) => c.active || c.id === contract)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Pessoa *">
        <Select
          value={person}
          disabled={!!assignment}
          required
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="">Selecione uma pessoa</option>
          <option value="new">+ Cadastrar pessoa agora</option>
          {db.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatCpf(p.cpf)}
            </option>
          ))}
        </Select>
      </Field>
      {person === "new" && (
        <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <Field label="Nome completo *">
            <Input name="name" required />
          </Field>
          <Field label="CPF *">
            <Input name="cpf" required inputMode="numeric" maxLength={14} />
          </Field>
          <Field label="Telefone">
            <Input name="phone" type="tel" />
          </Field>
        </div>
      )}
      {existing && !assignment && (
        <p className="text-sm leading-6 text-ocean">
          Esta pessoa já tem vínculo com o contrato. As equipes selecionadas
          serão adicionadas ao vínculo existente.
        </p>
      )}
      <div key={`${contract}-${person}`} className="space-y-4">
        <Field label="Função">
          <Select name="role_id" defaultValue={existing?.role_id ?? ""}>
            <option value="">Sem função definida</option>
            {db.roles
              .filter((r) => r.contract_id === contract)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        </Field>
        <p className="text-xs text-slate-500">
          As funções são cadastradas ao editar as vagas de uma equipe.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vínculo">
            <Select
              name="employment"
              defaultValue={existing?.employment ?? "CLT"}
            >
              <option>CLT</option>
              <option>PJ</option>
              <option>Estágio</option>
            </Select>
          </Field>
          <Field label="Status manual">
            <Select name="status" defaultValue={existing?.status ?? "Pendente"}>
              {employeeStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Data de admissão">
          <Input
            type="date"
            name="start_date"
            defaultValue={existing?.start_date ?? ""}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Equipes</legend>
        <div className="space-y-2">
          {db.teams
            .filter((t) => t.contract_id === contract)
            .map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={(assignment ? selectedTeams : teamIds).includes(
                    t.id,
                  )}
                  disabled={
                    !assignment &&
                    !!existing &&
                    db.memberships.some(
                      (m) =>
                        m.assignment_id === existing.id && m.team_id === t.id,
                    )
                  }
                  onChange={(e) =>
                    setSelectedTeams(
                      e.target.checked
                        ? [...selectedTeams, t.id]
                        : selectedTeams.filter((id) => id !== t.id),
                    )
                  }
                />
                {t.name}
              </label>
            ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Footer busy={busy || !contract} />
    </form>
  );
}

export function TeamEditor({
  team,
  db,
  busy,
  run,
  onClose,
}: BaseProps & { team?: Team }) {
  const [contract, setContract] = useState(
    team?.contract_id ?? db.contracts.find((c) => c.active)?.id ?? "",
  );
  const [slots, setSlots] = useState(
    team
      ? db.slots
          .filter((s) => s.team_id === team.id)
          .map((s) => ({
            name: db.roles.find((r) => r.id === s.role_id)?.name ?? "",
            target: s.target,
          }))
      : [{ name: "", target: 1 }],
  );
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = values(e.currentTarget);
        const success = await run(async () => {
          const { error } = await supabase!.rpc("save_team", {
            payload: { id: team?.id, name: data.name, contract_id: contract },
            positions: slots,
          });
          if (error) throw error;
        });
        if (success) onClose();
      }}
    >
      <Field label="Nome da equipe *">
        <Input name="name" defaultValue={team?.name} required />
      </Field>
      <Field label="Contrato *">
        <Select
          value={contract}
          onChange={(e) => {
            setContract(e.target.value);
            setSlots([{ name: "", target: 1 }]);
          }}
          disabled={!!team}
          required
        >
          <option value="">Selecione</option>
          {db.contracts
            .filter((c) => c.active || c.id === contract)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      </Field>
      <div>
        <h3 className="mb-3 font-semibold text-brand">
          Funções e vagas previstas
        </h3>
        <datalist id="role-options">
          {db.roles
            .filter((r) => r.contract_id === contract)
            .map((r) => (
              <option key={r.id} value={r.name} />
            ))}
        </datalist>
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_6rem_auto] items-end gap-2"
            >
              <Field label="Função">
                <Input
                  list="role-options"
                  value={slot.name}
                  required
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, n) =>
                        n === i ? { ...s, name: e.target.value } : s,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Previstas">
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  required
                  value={slot.target}
                  onChange={(e) =>
                    setSlots(
                      slots.map((s, n) =>
                        n === i ? { ...s, target: Number(e.target.value) } : s,
                      ),
                    )
                  }
                />
              </Field>
              <button
                type="button"
                aria-label={`Retirar função ${slot.name || i + 1}`}
                onClick={() => setSlots(slots.filter((_, n) => n !== i))}
                className="p-3 text-slate-400"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          secondary
          className="mt-4"
          onClick={() => setSlots([...slots, { name: "", target: 1 }])}
        >
          <Plus size={15} />
          Adicionar função
        </Button>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Retirar uma previsão não remove pessoas da equipe. Funções com pessoas
        alocadas continuam visíveis, com previsão zero.
      </p>
      <Footer busy={busy || !contract} />
    </form>
  );
}

export function RequirementEditor({
  requirement,
  db,
  busy,
  run,
  onClose,
  defaultContract,
}: BaseProps & { requirement?: Requirement; defaultContract?: string }) {
  const [contract, setContract] = useState(
    requirement?.contract_id ?? defaultContract ?? db.contracts[0]?.id ?? "",
  );
  const [template, setTemplate] = useState(-1);
  const item = template >= 0 ? catalog[template] : requirement;
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = values(e.currentTarget);
        if (
          await run(() =>
            saveRow("requirements", {
              ...data,
              id: requirement?.id ?? crypto.randomUUID(),
              contract_id: contract,
              role_id: data.role_id || null,
              position: Number(data.position),
              active: data.active === "true",
              conditional: data.conditional === "true",
            }),
          )
        )
          onClose();
      }}
    >
      <Field label="Contrato *">
        <Select
          required
          value={contract}
          disabled={!!requirement}
          onChange={(e) => setContract(e.target.value)}
        >
          <option value="">Selecione</option>
          {db.contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {!requirement && (
        <Field label="Usar item do catálogo">
          <Select
            value={template}
            onChange={(e) => setTemplate(Number(e.target.value))}
          >
            <option value={-1}>Criar item personalizado</option>
            {catalog.map((c, i) => (
              <option key={i} value={i}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div key={template} className="space-y-5">
        <Field label="Nome do item *">
          <Input name="title" required defaultValue={item?.title} />
        </Field>
        <Field label="Orientações">
          <Textarea name="instructions" defaultValue={item?.instructions} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select name="kind" defaultValue={item?.kind ?? "Documento"}>
              <option>Documento</option>
              <option>Tarefa</option>
            </Select>
          </Field>
          <Field label="Vínculo">
            <Select
              name="employment"
              defaultValue={item?.employment ?? "Todos"}
            >
              <option>Todos</option>
              <option>CLT</option>
              <option>PJ</option>
              <option>Estágio</option>
            </Select>
          </Field>
        </div>
        <Field label="Exigir apenas para a função">
          <Select
            key={contract}
            name="role_id"
            defaultValue={requirement?.role_id ?? ""}
          >
            <option value="">Todas as funções</option>
            {db.roles
              .filter((r) => r.contract_id === contract)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Aplicabilidade">
          <Select
            name="conditional"
            defaultValue={String(item?.conditional ?? false)}
          >
            <option value="false">
              Exigido para todos no filtro escolhido
            </option>
            <option value="true">Se aplicável à pessoa</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ordem">
            <Input
              name="position"
              type="number"
              min={0}
              required
              defaultValue={
                requirement?.position ??
                db.requirements.filter((r) => r.contract_id === contract).length
              }
            />
          </Field>
          <Field label="Situação">
            <Select
              name="active"
              defaultValue={String(requirement?.active ?? true)}
            >
              <option value="true">Ativo</option>
              <option value="false">Desativado</option>
            </Select>
          </Field>
        </div>
      </div>
      <Footer busy={busy || !contract} />
    </form>
  );
}
