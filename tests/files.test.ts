import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildPeopleWorkbook, buildAdmissionPdf } from "../lib/exports";
import { readWorkbook } from "../lib/imports";
import { demoDatabase, emptyDatabase } from "../lib/model";

test("Excel gerado pode ser reaberto e importado, preservando CPF como texto", async () => {
  const db = demoDatabase();
  db.people[0].cpf = "01234567890";
  db.people[0].notes = "=1+1";
  const bytes = await buildPeopleWorkbook([db.people[0]], db);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell("B2").value, "01234567890");
  assert.equal(sheet.getCell("K2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("K2").value, "=1+1");
  assert.match(String(sheet.getCell("F2").value), /Operação Santos: Ativo/);
  const file = new File([new Uint8Array(bytes)], "pessoas.xlsx");
  const people = await readWorkbook(file, emptyDatabase());
  assert.equal(people.length, 1);
  assert.equal(people[0].cpf, "01234567890");
  assert.equal(people[0].issue, "");
  assert.equal(people[0].selected, true);
});

test("Leitura real de XLSX reconhece cabeçalho Santos e marcações", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Equipe");
  sheet.addRow(["DADOS", "DOCUMENTOS"]);
  sheet.addRow(["NOME", "CPF", "CNH", "EQUIPE"]);
  sheet.addRow(["Pessoa fictícia", "OK", "NSA", "A"]);
  const bytes = await workbook.xlsx.writeBuffer();
  const rows = await readWorkbook(
    new File([new Uint8Array(bytes)], "santos.xlsx"),
    emptyDatabase(),
  );
  assert.equal(rows[0].cpf, "");
  assert.equal(rows[0].selected, true);
  assert.equal(
    rows[0].marks.find((m) => m.title === "CPF")?.status,
    "Recebido",
  );
});

test("PDF de admissão suporta cabeçalho longo e checklist em várias páginas", async () => {
  const db = demoDatabase();
  db.people[0].name = "Pessoa fictícia com nome muito longo ".repeat(4);
  for (let i = 0; i < 60; i++)
    db.requirements.push({
      ...db.requirements[0],
      id: `extra-${i}`,
      title: `Documento ${i}`,
      position: 100 + i,
    });
  const pdf = await buildAdmissionPdf(db, db.assignments[0]);
  assert.ok(pdf.getNumberOfPages() >= 3);
  assert.ok(pdf.output("arraybuffer").byteLength > 1000);
});
