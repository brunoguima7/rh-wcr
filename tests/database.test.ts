import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { catalog } from "../lib/model";

test("Banco: RLS, transações, contratos, equipes, importação e metadados", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as 'select string_to_array($1, ''/'')';
      grant usage on schema public,auth,storage to authenticated,anon;
      grant select,insert,delete on storage.objects to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_wcr.sql", import.meta.url),
        "utf8",
      ),
    );
    const user = "11111111-1111-4111-8111-111111111111";
    const outsider = "22222222-2222-4222-8222-222222222222";
    await db.exec(
      `insert into auth.users values('${user}'),('${outsider}'); insert into public.wcr_members(user_id) values('${user}'); set role authenticated; set request.jwt.claim.sub='${user}';`,
    );
    const contract = (
      await db.query<{ id: string }>(
        "select public.create_contract($1::jsonb,$2::jsonb) as id",
        [
          JSON.stringify({ name: "Santos", client: "Cliente" }),
          JSON.stringify(catalog),
        ],
      )
    ).rows[0].id;
    const other = (
      await db.query<{ id: string }>(
        "select public.create_contract($1::jsonb,$2::jsonb) as id",
        [JSON.stringify({ name: "Outro", client: "Cliente" }), "[]"],
      )
    ).rows[0].id;
    const team = (
      await db.query<{ id: string }>(
        "select public.save_team($1::jsonb,$2::jsonb) as id",
        [
          JSON.stringify({ contract_id: contract, name: "Equipe A" }),
          JSON.stringify([{ name: "Operador", target: 2 }]),
        ],
      )
    ).rows[0].id;
    const role = (
      await db.query<{ id: string }>(
        "select id from roles where contract_id=$1",
        [contract],
      )
    ).rows[0].id;
    const assignment = (
      await db.query<{ id: string }>(
        "select public.save_assignment($1::jsonb,$2::uuid[]) as id",
        [
          JSON.stringify({
            contract_id: contract,
            role_id: role,
            employment: "CLT",
            status: "Ativo",
            new_person: { name: "Pessoa teste", cpf: "52998224725" },
          }),
          [team],
        ],
      )
    ).rows[0].id;
    assert.equal((await db.query("select * from memberships")).rows.length, 1);
    await db.query("select public.save_team($1::jsonb,$2::jsonb)", [
      JSON.stringify({
        id: team,
        contract_id: contract,
        name: "Equipe A editada",
      }),
      JSON.stringify([{ name: "Operador", target: 4 }]),
    ]);
    assert.equal(
      (await db.query<{ target: number }>("select target from slots")).rows[0]
        .target,
      4,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into assignments(person_id,contract_id,role_id,employment) select person_id,$1,$2,'CLT' from assignments limit 1",
          [other, role],
        ),
      /mesmo contrato/,
    );
    const requirement = (
      await db.query<{ id: string }>(
        "select id from requirements where title='CPF' and contract_id=$1",
        [contract],
      )
    ).rows[0].id;
    await assert.rejects(
      () =>
        db.query(
          "insert into checks(assignment_id,requirement_id,status) values($1,$2,'Recusado')",
          [assignment, requirement],
        ),
      /check constraint/,
    );
    await db.query(
      "insert into checks(assignment_id,requirement_id,status,notes) values($1,$2,'Recusado','Imagem ilegível')",
      [assignment, requirement],
    );
    await db.query("update requirements set active=false where id=$1", [
      requirement,
    ]);
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from assignments where id=$1",
          [assignment],
        )
      ).rows[0].status,
      "Ativo",
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('wcr-documents',$1)",
      [`${assignment}/${requirement}/file.pdf`],
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('wcr-documents','other/path/file.pdf')",
        ),
      /row-level security/,
    );
    await db.query("select public.import_people($1::jsonb,$2::uuid)", [
      JSON.stringify([
        {
          name: "Importado Santos",
          cpf: "",
          team: "B",
          role: "Ajudante",
          employment: "CLT",
          marks: [{ title: "RG", status: "Recebido" }],
        },
      ]),
      contract,
    ]);
    assert.equal(
      (await db.query("select * from people where name='Importado Santos'"))
        .rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from checks where status='Recebido'")).rows
        .length,
      1,
    );
    // Erro na segunda linha deve desfazer também a primeira linha.
    await assert.rejects(
      () =>
        db.query("select public.import_people($1::jsonb,null)", [
          JSON.stringify([
            { name: "Rollback", cpf: "" },
            { name: "Duplicado", cpf: "52998224725" },
          ]),
        ]),
      /CPF já cadastrado/,
    );
    assert.equal(
      (await db.query("select * from people where name='Rollback'")).rows
        .length,
      0,
    );
    await db.exec(`set request.jwt.claim.sub='${outsider}';`);
    assert.equal((await db.query("select * from people")).rows.length, 0);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      () => db.query("insert into people(name) values('Sem acesso')"),
      /row-level security/,
    );
    await assert.rejects(
      () => db.query("insert into wcr_members(user_id) values($1)", [outsider]),
      /permission denied/,
    );
    await db.exec("set role anon;");
    await assert.rejects(
      () => db.query("select * from people"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
