"use client";
import { useState } from "react";
import { Database } from "@/lib/model";
import { ImportPerson, readWorkbook } from "@/lib/imports";
import { supabase, errorMessage } from "@/lib/supabase";
import { exportPeopleWorkbook } from "@/lib/exports";
import { Button, Field, Input, Select, Badge } from "./ui";

export function Importer({
  db,
  run,
  busy,
  onClose,
}: {
  db: Database;
  run: (
    action: () => Promise<unknown>,
    success?: string,
  ) => Promise<boolean | undefined>;
  busy: boolean;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<ImportPerson[]>([]);
  const [contract, setContract] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const selected = people.filter((p) => p.selected && !p.issue);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-500">
        Importe um arquivo Excel (.xlsx). A primeira aba será lida. Você pode
        usar a planilha de Santos ou o modelo com Nome, CPF e Telefone. Nenhum
        dado é enviado até confirmar a importação.
      </p>
      <Button
        secondary
        onClick={() =>
          void exportPeopleWorkbook([], db).catch((e) =>
            setError(errorMessage(e)),
          )
        }
      >
        Baixar modelo Excel
      </Button>
      <Field label="Planilha">
        <Input
          type="file"
          accept=".xlsx"
          disabled={reading || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setReading(true);
            setError("");
            setPeople([]);
            try {
              setPeople(await readWorkbook(file, db));
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setReading(false);
            }
          }}
        />
      </Field>
      <Field label="Destino">
        <Select value={contract} onChange={(e) => setContract(e.target.value)}>
          <option value="">Somente banco de candidatos</option>
          {db.contracts
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                Funcionários de {c.name}
              </option>
            ))}
        </Select>
      </Field>
      {contract && (
        <p className="rounded-lg bg-sky-50 p-3 text-sm leading-6 text-sky-900">
          Serão criadas as equipes e funções informadas na planilha. Os vínculos
          começam como Pendente, com previsão de vagas zero para você ajustar.
          “OK” significa Recebido, “NSA” significa Não se aplica. Marcações sem
          item correspondente ficam nas observações.
        </p>
      )}
      {reading && (
        <p role="status" className="text-sm">
          Lendo planilha…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!!people.length && (
        <>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {["", "Linha", "Nome", "CPF", "Conferência"].map((h, i) => (
                    <th key={i} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Importar ${p.name}`}
                        checked={p.selected}
                        disabled={!!p.issue || busy}
                        onChange={(e) =>
                          setPeople(
                            people.map((x, n) =>
                              n === i
                                ? { ...x, selected: e.target.checked }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-3">{p.row}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="whitespace-nowrap p-3">
                      {p.cpf || "A preencher"}
                    </td>
                    <td className="p-3">
                      {p.issue ? (
                        <span className="text-red-700">{p.issue}</span>
                      ) : (
                        <Badge>{p.cpf ? "Pronto" : "Sem CPF"}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {selected.length} de {people.length} pessoas selecionadas.
            </p>
            <Button
              disabled={busy || !selected.length}
              onClick={async () => {
                if (
                  await run(async () => {
                    const { error } = await supabase!.rpc("import_people", {
                      entries: selected.map(
                        ({ row, issue, selected, ...person }) => person,
                      ),
                      target_contract: contract || null,
                    });
                    if (error) throw error;
                  }, `${selected.length} pessoas importadas.`)
                )
                  onClose();
              }}
            >
              {busy ? "Importando…" : "Confirmar importação"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
