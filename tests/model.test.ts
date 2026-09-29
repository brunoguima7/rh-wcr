import test from "node:test";
import assert from "node:assert/strict";
import {
  demoDatabase,
  requirementsFor,
  progressFor,
  validCpf,
  occupied,
} from "../lib/model";
import { parseRows } from "../lib/imports";

test("CPF: zeros repetidos, dígitos verificadores e pontuação", () => {
  assert.equal(validCpf("111.111.111-11"), false);
  assert.equal(validCpf("529.982.247-25"), true);
  assert.equal(validCpf("529.982.247-24"), false);
});

test("Checklist varia por contrato, vínculo e função sem mudar status", () => {
  const db = demoDatabase();
  const a = db.assignments[0];
  db.requirements.push({
    id: "specific",
    contract_id: "c1",
    title: "Líder",
    instructions: "",
    kind: "Documento",
    employment: "CLT",
    role_id: "r2",
    position: 100,
    active: true,
    conditional: false,
  });
  assert.ok(requirementsFor(db, a).some((r) => r.id === "specific"));
  assert.ok(
    !requirementsFor(db, db.assignments[1]).some((r) => r.id === "specific"),
  );
  assert.ok(
    !requirementsFor(db, { ...a, employment: "PJ" }).some(
      (r) => r.title === "CTPS Digital completa",
    ),
  );
  assert.ok(
    requirementsFor(db, { ...a, employment: "PJ" }).some(
      (r) => r.title === "CNPJ",
    ),
  );
  db.requirements.find((r) => r.id === "specific")!.active = false;
  assert.ok(!requirementsFor(db, a).some((r) => r.id === "specific"));
  assert.equal(a.status, "Ativo");
  assert.ok(progressFor(db, a).percentage <= 100);
});

test("Removidos não ocupam vagas; cada equipe tem contagem própria", () => {
  const db = demoDatabase();
  assert.equal(occupied(db, "t1", "r1"), 2);
  db.assignments[1].status = "Removido";
  assert.equal(occupied(db, "t1", "r1"), 1);
  assert.equal(occupied(db, "t2", "r1"), 0);
});

test("Importação Santos: OK não vira CPF nem aprovação, NSA preservado", () => {
  const db = demoDatabase();
  const rows = [
    ["DADOS", "DOCUMENTOS"],
    ["EQUIPE", "NOME", "CARGO", "CPF", "CNH", "UNIFORME (BLUSA, CALÇA)"],
    ["A", "Pessoa Teste", "Operador PJ", "OK", "NSA", "G, 42"],
  ];
  const [p] = parseRows(rows, db);
  assert.equal(p.cpf, "");
  assert.equal(p.employment, "PJ");
  assert.equal(p.shirt_size, "G");
  assert.equal(p.pants_size, "42");
  assert.deepEqual(
    p.marks.find((m) => m.title === "CPF"),
    { title: "CPF", status: "Recebido" },
  );
  assert.deepEqual(
    p.marks.find((m) => m.title === "CNH"),
    { title: "CNH", status: "Não se aplica" },
  );
  assert.equal(p.row, 3);
});

test("Importação rejeita CPFs duplicados e nomes sem CPF já existentes", () => {
  const rows = [
    ["Nome", "CPF"],
    ["A", "52998224725"],
    ["B", "52998224725"],
    ["Marina Exemplo", "OK"],
  ];
  const parsed = parseRows(rows, demoDatabase());
  assert.equal(parsed[0].selected, true);
  assert.equal(parsed[1].selected, false);
  assert.equal(parsed[2].selected, false);
});
