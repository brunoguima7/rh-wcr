import {
  cleanCpf,
  normalize,
  validCpf,
  type Database,
  type ItemStatus,
} from "./model";

export type ImportPerson = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  role: string;
  team: string;
  employment: "CLT" | "PJ" | "Estágio";
  notes: string;
  boot_size: string;
  shirt_size: string;
  pants_size: string;
  transport: string;
  marks: { title: string; status: ItemStatus }[];
  row: number;
  issue: string;
  selected: boolean;
};
const documentHeaders: Record<string, string[]> = {
  "Exame admissional / ASO": ["exame", "aso"],
  CPF: ["cpf"],
  RG: ["rg"],
  CNH: ["cnh"],
  "Certificados de cursos": ["certif. (op)", "certificados"],
  "CTPS Digital completa": ["ctps"],
  "Comprovante de residência": ["residencia"],
  "Certificado de reservista": ["reservista"],
  "Foto 3x4": ["foto"],
  "Título de eleitor": ["titulo"],
  "Comprovante de escolaridade": ["hist. escolar"],
  "Antecedentes criminais": ["antecedentes"],
  "Certidão de casamento": ["ct. casamento e cpf"],
  "CPF do cônjuge": ["ct. casamento e cpf"],
  "Certidão de nascimento dos filhos": ["ct. nascimento filhos"],
  "Declaração de residência": ["declaracao"],
  "Conta bancária": ["conta"],
};

export function parseRows(rows: string[][], db: Database): ImportPerson[] {
  const headerIndex = rows.findIndex((row) =>
    row.some((c) =>
      ["nome", "nome completo", "funcionario"].includes(normalize(c)),
    ),
  );
  if (headerIndex < 0)
    throw new Error(
      "Não foi encontrada uma coluna Nome. Use o modelo ou a planilha de Santos.",
    );
  const headers = rows[headerIndex].map(normalize);
  const get = (row: string[], ...names: string[]) =>
    row[headers.findIndex((h) => names.includes(h))]?.trim() ?? "";
  const seenCpf = new Set<string>();
  const seenNames = new Set<string>();
  return rows
    .slice(headerIndex + 1)
    .map((row, index): ImportPerson => {
      const name = get(row, "nome", "nome completo", "funcionario");
      const rawCpf = get(row, "cpf");
      const cpf = /\d/.test(rawCpf) ? cleanCpf(rawCpf).padStart(11, "0") : "";
      const role = get(row, "cargo", "funcao");
      const uniform = get(row, "uniforme (blusa, calca)")
        .split(",")
        .map((v) => v.trim());
      let issue = "";
      if (cpf && !validCpf(cpf)) issue = "CPF inválido";
      if (cpf && (seenCpf.has(cpf) || db.people.some((p) => p.cpf === cpf)))
        issue = "CPF duplicado: revise antes de importar";
      if (
        !cpf &&
        (seenNames.has(normalize(name)) ||
          db.people.some((p) => normalize(p.name) === normalize(name)))
      )
        issue = "Nome já encontrado: confira o CPF antes de importar";
      if (cpf) seenCpf.add(cpf);
      else seenNames.add(normalize(name));
      const marks = Object.entries(documentHeaders).flatMap(
        ([title, names]) => {
          const value = normalize(get(row, ...names));
          const status: ItemStatus | null =
            value === "ok"
              ? "Recebido"
              : ["nsa", "n/a", "nao se aplica"].includes(value)
                ? "Não se aplica"
                : value === "pendente"
                  ? "Pendente"
                  : null;
          return status ? [{ title, status }] : [];
        },
      );
      const notes = get(row, "observacoes", "obs", "observacao");
      return {
        name,
        cpf,
        phone: get(row, "telefone", "celular"),
        email: get(row, "email", "e-mail"),
        role,
        team: get(row, "equipe"),
        employment: /\bpj\b/i.test(role) ? "PJ" : "CLT",
        notes: [
          notes,
          !cpf ? "Importado sem número de CPF. Preenchimento pendente." : "",
          marks.length
            ? "Marcações originais: " +
              marks.map((m) => `${m.title}: ${m.status}`).join("; ")
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        boot_size: get(row, "bota"),
        shirt_size: get(row, "blusa") || uniform[0] || "",
        pants_size: get(row, "calca") || uniform[1] || "",
        transport: get(row, "vt"),
        marks,
        row: headerIndex + index + 2,
        issue,
        selected: !!name && !issue,
      };
    })
    .filter((p) => p.name);
}

export async function readWorkbook(
  file: File,
  db: Database,
): Promise<ImportPerson[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("A planilha deve ter até 10 MB.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Planilha vazia.");
  const rows: string[][] = [];
  if (sheet.rowCount > 10000)
    throw new Error("Importe até 10.000 linhas por vez.");
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cell.text;
    });
    rows.push(Array.from({ length: cells.length }, (_, i) => cells[i] ?? ""));
  });
  return parseRows(rows, db);
}
