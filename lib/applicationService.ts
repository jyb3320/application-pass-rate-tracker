import type { Application, ApplicationResult } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const tableName = "application_pass_rate_records";

interface ApplicationRow {
  id: string;
  date: string;
  company: string;
  role: string;
  result: ApplicationResult;
  memo: string;
}

function getClient() {
  if (!supabase) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  return supabase;
}

export async function fetchRemoteApplications() {
  const client = getClient();
  const { data, error } = await client
    .from(tableName)
    .select("id, date, company, role, result, memo")
    .order("date", { ascending: false })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ApplicationRow[];
}

export async function upsertRemoteApplication(application: Application) {
  const client = getClient();
  const { error } = await client
    .from(tableName)
    .upsert(toRow(application), { onConflict: "id" });

  if (error) throw error;
}

export async function deleteRemoteApplication(id: string) {
  const client = getClient();
  const { error } = await client.from(tableName).delete().eq("id", id);

  if (error) throw error;
}

export async function replaceRemoteApplications(applications: Application[]) {
  const client = getClient();
  const { data: existing, error: existingError } = await client
    .from(tableName)
    .select("id");

  if (existingError) throw existingError;

  const nextIds = new Set(applications.map((application) => application.id));
  const staleIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !nextIds.has(id));

  if (staleIds.length > 0) {
    const { error } = await client.from(tableName).delete().in("id", staleIds);
    if (error) throw error;
  }

  if (applications.length > 0) {
    const { error } = await client
      .from(tableName)
      .upsert(applications.map(toRow), { onConflict: "id" });

    if (error) throw error;
  }
}

function toRow(application: Application): ApplicationRow {
  return {
    id: application.id,
    date: application.date,
    company: application.company,
    role: application.role,
    result: application.result,
    memo: application.memo,
  };
}
