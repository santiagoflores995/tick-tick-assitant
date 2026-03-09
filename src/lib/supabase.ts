import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
    }

    supabase = createClient(url, key);
  }

  return supabase;
}

export interface User {
  id: string;
  telegram_user_id: number;
  ticktick_access_token: string | null;
  ticktick_refresh_token: string | null;
  ticktick_token_expires_at: string | null;
  openrouter_api_key: string | null;
  openrouter_model: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  task_title: string;
  task_id: string | null;
  messages: Message[];
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export async function getUserByTelegramId(
  telegramUserId: number
): Promise<User | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (error || !data) return null;
  return data as User;
}

export async function createUser(telegramUserId: number): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({ telegram_user_id: telegramUserId })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function updateUser(
  telegramUserId: number,
  updates: Partial<Pick<User, "ticktick_access_token" | "ticktick_refresh_token" | "ticktick_token_expires_at" | "openrouter_api_key" | "openrouter_model">>
): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("telegram_user_id", telegramUserId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user: ${error.message}`);
  return data as User;
}

export async function getActiveConversation(
  userId: string
): Promise<Conversation | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as Conversation;
}

export async function createConversation(
  userId: string,
  taskTitle: string,
  taskId?: string
): Promise<Conversation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      task_title: taskTitle,
      task_id: taskId || null,
      messages: [],
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data as Conversation;
}

export async function updateConversation(
  conversationId: string,
  messages: Message[]
): Promise<Conversation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
  return data as Conversation;
}

export async function completeConversation(
  conversationId: string
): Promise<Conversation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete conversation: ${error.message}`);
  return data as Conversation;
}

export async function cancelConversation(
  conversationId: string
): Promise<Conversation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to cancel conversation: ${error.message}`);
  return data as Conversation;
}
