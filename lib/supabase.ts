import { createClient } from "@supabase/supabase-js";
import { Database, Table, emptyDatabase } from "./model";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function loadDatabase(): Promise<Database> {
  if (!supabase) throw new Error("Configure a conexão com o Supabase.");
  const db = emptyDatabase();
  await Promise.all(
    (Object.keys(db) as Table[]).map(async (table) => {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase!
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      Object.assign(db, { [table]: rows });
    }),
  );
  return db;
}

export async function saveRow(
  table: Table,
  row: Record<string, unknown>,
  conflict?: string,
) {
  if (!supabase) throw new Error("Conecte o Supabase para salvar.");
  const { data, error } = await supabase
    .from(table)
    .upsert(row, conflict ? { onConflict: conflict } : undefined)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeRow(table: Table, id: string) {
  if (!supabase) throw new Error("Conecte o Supabase para salvar.");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Não foi possível concluir. Tente novamente.";
  if (message.includes("duplicate key"))
    return "Já existe um registro com esses dados. Verifique o CPF ou o vínculo com o contrato.";
  if (message.includes("row-level security"))
    return "Seu usuário não tem acesso à WCR. Verifique a lista de usuários autorizados no Supabase.";
  if (message.includes("Failed to fetch"))
    return "Sem conexão com o banco. Verifique a internet e tente novamente.";
  if (message.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  return message;
}
