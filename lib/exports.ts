import type { Assignment, Database, Person } from "./model";
import { formatCpf, requirementsFor } from "./model";

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportPeopleWorkbook(people: Person[], db: Database) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pessoas");
  sheet.columns = [
    { header: "Nome", key: "name", width: 36 },
    { header: "CPF", key: "cpf", width: 20 },
    { header: "Telefone", key: "phone", width: 20 },
    { header: "E-mail", key: "email", width: 32 },
    { header: "Categoria", key: "category", width: 18 },
    { header: "Contratos e status", key: "contracts", width: 55 },
    { header: "Bota", key: "boot_size", width: 12 },
    { header: "Blusa", key: "shirt_size", width: 12 },
    { header: "Calça", key: "pants_size", width: 12 },
    { header: "VT", key: "transport", width: 20 },
    { header: "Observações", key: "notes", width: 55 },
  ];
  people.forEach((p) =>
    sheet.addRow({
      ...p,
      cpf: p.cpf ?? "",
      contracts: db.assignments
        .filter((a) => a.person_id === p.id)
        .map(
          (a) =>
            `${db.contracts.find((c) => c.id === a.contract_id)?.name}: ${a.status}`,
        )
        .join("; "),
    }),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF043B66" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:K1";
  const bytes = await workbook.xlsx.writeBuffer();
  download(new Blob([bytes as ArrayBuffer]), "wcr-pessoas.xlsx");
}

export async function exportAdmissionPdf(db: Database, assignment: Assignment) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const person = db.people.find((p) => p.id === assignment.person_id)!;
  const contract = db.contracts.find((c) => c.id === assignment.contract_id)!;
  const pdf = new jsPDF();
  pdf.setTextColor(4, 59, 102);
  pdf.setFontSize(20);
  pdf.text("WCR | Resumo de admissão", 14, 20);
  pdf.setFontSize(11);
  const heading = [
    `${person.name} | ${formatCpf(person.cpf)}`,
    `${contract.name} | ${assignment.employment} | ${assignment.status}`,
  ];
  pdf.text(pdf.splitTextToSize(heading.join("\n"), 180), 14, 32);
  autoTable(pdf, {
    startY: 52,
    head: [["Item", "Situação", "Observações"]],
    body: requirementsFor(db, assignment).map((r) => {
      const check = db.checks.find(
        (c) => c.assignment_id === assignment.id && c.requirement_id === r.id,
      );
      return [r.title, check?.status ?? "Pendente", check?.notes ?? ""];
    }),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [4, 59, 102] },
    columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 40 } },
    didDrawPage: () => {
      pdf.setFontSize(8);
      pdf.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} · WCR Saneamento`,
        14,
        288,
      );
    },
  });
  pdf.save(`admissao-${person.name.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`);
}
