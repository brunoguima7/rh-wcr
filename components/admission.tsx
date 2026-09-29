"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  Eye,
  Trash2,
  Upload,
  ChevronDown,
} from "lucide-react";
import {
  Assignment,
  Database,
  DocumentFile,
  Requirement,
  ItemStatus,
  itemStatuses,
  requirementsFor,
  progressFor,
  employeeStatuses,
} from "@/lib/model";
import { supabase, saveRow, removeRow, errorMessage } from "@/lib/supabase";
import { download, exportAdmissionPdf } from "@/lib/exports";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Progress,
  Select,
  Textarea,
} from "./ui";

type Run = (
  action: () => Promise<unknown>,
  success?: string,
) => Promise<boolean | undefined>;
export function Admission({
  assignment,
  db,
  preview,
  busy,
  run,
}: {
  assignment: Assignment;
  db: Database;
  preview: boolean;
  busy: boolean;
  run: Run;
}) {
  const [view, setView] = useState<{ url: string; file: DocumentFile } | null>(
    null,
  );
  const [failure, setFailure] = useState("");
  const [processing, setProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DocumentFile | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const person = db.people.find((p) => p.id === assignment.person_id)!;
  const contract = db.contracts.find((c) => c.id === assignment.contract_id)!;
  const progress = progressFor(db, assignment);
  const active = requirementsFor(db, assignment);
  const archived = db.requirements.filter(
    (r) =>
      r.contract_id === assignment.contract_id &&
      !active.some((a) => a.id === r.id) &&
      (db.files.some(
        (f) => f.assignment_id === assignment.id && f.requirement_id === r.id,
      ) ||
        db.checks.some(
          (c) => c.assignment_id === assignment.id && c.requirement_id === r.id,
        )),
  );
  const files = db.files.filter((f) => f.assignment_id === assignment.id);

  async function inspect(file: DocumentFile, save = false) {
    setFailure("");
    setProcessing(true);
    try {
      if (save) {
        const { data, error } = await supabase!.storage
          .from("wcr-documents")
          .download(file.path);
        if (error) throw error;
        download(data, file.name);
      } else {
        const { data, error } = await supabase!.storage
          .from("wcr-documents")
          .createSignedUrl(file.path, 300);
        if (error) throw error;
        setView({ url: data.signedUrl, file });
      }
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setProcessing(false);
    }
  }

  async function zip() {
    setProcessing(true);
    setFailure("");
    try {
      if (files.reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024)
        throw new Error(
          "O conjunto ultrapassa 200 MB. Baixe os documentos individualmente para evitar sobrecarga do navegador.",
        );
      const { default: JSZip } = await import("jszip");
      const archive = new JSZip();
      for (const file of files) {
        const { data, error } = await supabase!.storage
          .from("wcr-documents")
          .download(file.path);
        if (error) throw error;
        const title =
          db.requirements.find((r) => r.id === file.requirement_id)?.title ??
          "Documento";
        archive.file(
          `${title.replace(/[^\p{L}\p{N} _-]/gu, "-")}/${file.id.slice(0, 8)}-${file.name.replace(/[/\\]/g, "-")}`,
          data,
        );
      }
      download(
        await archive.generateAsync({ type: "blob" }),
        `documentos-${person.name.replace(/[^a-zA-Z0-9]/g, "-")}.zip`,
      );
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand">{person.name}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {contract.name} · {assignment.employment} ·{" "}
            {db.roles.find((r) => r.id === assignment.role_id)?.name ??
              "Sem função"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            secondary
            disabled={processing}
            onClick={() =>
              void exportAdmissionPdf(db, assignment).catch((e) =>
                setFailure(errorMessage(e)),
              )
            }
          >
            <Download size={15} />
            Resumo PDF
          </Button>
          <Button
            secondary
            disabled={processing || !files.length || preview}
            onClick={zip}
          >
            <Download size={15} />
            Baixar ZIP
          </Button>
        </div>
      </div>
      <div className="grid items-center gap-5 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <Field label="Status da pessoa neste contrato">
          <Select
            value={assignment.status}
            disabled={busy || preview}
            onChange={(e) =>
              void run(() =>
                saveRow("assignments", {
                  ...assignment,
                  status: e.target.value,
                }),
              )
            }
          >
            {employeeStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Progress
          value={progress.percentage}
          text={`${progress.resolved} de ${progress.total} itens aprovados ou não aplicáveis`}
        />
      </div>
      <p className="text-xs leading-5 text-slate-500">
        O checklist não altera o status da pessoa. A aprovação do cliente é
        registrada pela equipe WCR. Enviar um arquivo também não aprova o item.
      </p>
      {preview && (
        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
          Prévia de consulta. Para enviar arquivos ou alterar o checklist,
          conecte o Supabase.
        </p>
      )}
      {failure && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {failure}
        </p>
      )}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {active.map((r) => (
          <ChecklistItem
            key={r.id}
            requirement={r}
            assignment={assignment}
            db={db}
            disabled={busy || preview || processing}
            run={run}
            inspect={inspect}
            onDelete={setConfirmDelete}
          />
        ))}
        {!active.length && (
          <p className="p-6 text-sm text-slate-500">
            Nenhum item configurado para este vínculo e função.
          </p>
        )}
      </div>
      {!!archived.length && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-slate-500"
          >
            <ChevronDown size={17} />
            Itens fora do modelo atual ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {archived.map((r) => (
                <ChecklistItem
                  key={r.id}
                  requirement={r}
                  assignment={assignment}
                  db={db}
                  disabled
                  run={run}
                  inspect={inspect}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {view && (
        <Modal title={view.file.name} wide onClose={() => setView(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Link privado válido por cinco minutos. Reabra o documento se
            expirar.
          </p>
          {view.file.content_type === "application/pdf" ? (
            <iframe
              src={view.url}
              title={view.file.name}
              className="h-[60vh] w-full rounded border border-slate-200"
            />
          ) : (
            <img
              src={view.url}
              alt={view.file.name}
              className="max-h-[65vh] w-full object-contain"
            />
          )}
          <Button
            secondary
            className="mt-4"
            onClick={() => inspect(view.file, true)}
          >
            Baixar documento
          </Button>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Excluir arquivo" onClose={() => setConfirmDelete(null)}>
          <p className="mb-5 text-sm leading-6">
            Excluir “{confirmDelete.name}” do armazenamento? Esta ação é
            permanente. O status do checklist será mantido.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              const file = confirmDelete;
              if (
                await run(async () => {
                  const { error } = await supabase!.storage
                    .from("wcr-documents")
                    .remove([file.path]);
                  if (error) throw error;
                  await removeRow("files", file.id);
                }, "Arquivo excluído.")
              )
                setConfirmDelete(null);
            }}
          >
            Excluir arquivo
          </Button>
        </Modal>
      )}
    </div>
  );
}

function ChecklistItem({
  requirement,
  assignment,
  db,
  disabled,
  run,
  inspect,
  onDelete,
}: {
  requirement: Requirement;
  assignment: Assignment;
  db: Database;
  disabled: boolean;
  run: Run;
  inspect: (file: DocumentFile, save?: boolean) => Promise<void>;
  onDelete: (file: DocumentFile) => void;
}) {
  const check = db.checks.find(
    (c) =>
      c.assignment_id === assignment.id && c.requirement_id === requirement.id,
  );
  const [status, setStatus] = useState<ItemStatus>(check?.status ?? "Pendente");
  const [notes, setNotes] = useState(check?.notes ?? "");
  const files = db.files.filter(
    (f) =>
      f.assignment_id === assignment.id && f.requirement_id === requirement.id,
  );
  return (
    <details className="group p-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
        <FileText size={18} className="text-ocean" />
        <span className="min-w-40 flex-1 text-sm font-semibold">
          {requirement.title}
          {requirement.conditional && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              Se aplicável
            </span>
          )}
        </span>
        <span className="text-xs text-slate-400">
          {requirement.kind === "Tarefa"
            ? "Tarefa"
            : `${files.length} arquivo(s)`}
        </span>
        <Badge>{check?.status ?? "Pendente"}</Badge>
        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-4 space-y-4 pl-0 sm:pl-8">
        <p className="text-sm leading-6 text-slate-500">
          {requirement.instructions || "Sem orientação adicional."}
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(() =>
              saveRow(
                "checks",
                {
                  ...(check ? { id: check.id } : {}),
                  assignment_id: assignment.id,
                  requirement_id: requirement.id,
                  status,
                  notes,
                },
                "assignment_id,requirement_id",
              ),
            );
          }}
        >
          <Field label="Situação do item">
            <Select
              value={status}
              disabled={disabled}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
            >
              {itemStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field
            label={status === "Recusado" ? "Motivo da recusa *" : "Observações"}
          >
            <Textarea
              value={notes}
              required={status === "Recusado"}
              disabled={disabled}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <Button secondary disabled={disabled} type="submit">
            Salvar situação
          </Button>
        </form>
        {files.map((file) => (
          <div
            key={file.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="min-w-32 flex-1">
              <p className="break-all text-sm">{file.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              title="Visualizar"
              aria-label={`Visualizar ${file.name}`}
              onClick={() => inspect(file)}
              className="p-2 text-ocean"
            >
              <Eye size={17} />
            </button>
            <button
              title="Baixar"
              aria-label={`Baixar ${file.name}`}
              onClick={() => inspect(file, true)}
              className="p-2 text-ocean"
            >
              <Download size={17} />
            </button>
            <button
              title="Excluir"
              aria-label={`Excluir ${file.name}`}
              disabled={disabled}
              onClick={() => onDelete(file)}
              className="p-2 text-slate-400"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {requirement.kind === "Documento" && (
          <Field
            label="Adicionar documentos"
            hint="PDF, JPG, PNG ou WebP. Até 50 MB por arquivo. Cada envio mantém os anexos anteriores."
          >
            <Input
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={async (e) => {
                const input = e.currentTarget;
                const selected = Array.from(input.files ?? []);
                if (!selected.length) return;
                await run(async () => {
                  for (const file of selected) {
                    if (
                      ![
                        "application/pdf",
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                      ].includes(file.type)
                    )
                      throw new Error(`Formato não aceito: ${file.name}`);
                    if (!file.size || file.size > 50 * 1024 * 1024)
                      throw new Error(
                        `O arquivo ${file.name} deve ter entre 1 byte e 50 MB.`,
                      );
                  }
                  for (const file of selected) {
                    const id = crypto.randomUUID();
                    const path = `${assignment.id}/${requirement.id}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
                    const { error } = await supabase!.storage
                      .from("wcr-documents")
                      .upload(path, file, {
                        contentType: file.type,
                        upsert: false,
                      });
                    if (error) throw error;
                    try {
                      await saveRow("files", {
                        id,
                        assignment_id: assignment.id,
                        requirement_id: requirement.id,
                        name: file.name,
                        path,
                        size: file.size,
                        content_type: file.type,
                      });
                    } catch (e) {
                      const cleanup = await supabase!.storage
                        .from("wcr-documents")
                        .remove([path]);
                      if (cleanup.error)
                        throw new Error(
                          `Falha ao registrar o arquivo. Há um envio pendente de limpeza no armazenamento: ${path}`,
                        );
                      throw e;
                    }
                  }
                }, "Documentos enviados. Atualize a situação do item quando conferir o recebimento.");
                input.value = "";
              }}
            />
          </Field>
        )}
      </div>
    </details>
  );
}
