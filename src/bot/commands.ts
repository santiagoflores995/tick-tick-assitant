import { Context, Bot } from "grammy";
import {
  getUserByTelegramId,
  createUser,
  getActiveConversation,
  createConversation,
  updateConversation,
  completeConversation,
  cancelConversation,
  type Message,
} from "../lib/supabase.js";
import { TickTickClient } from "../lib/ticktick.js";
import { OpenRouterClient } from "../lib/openrouter.js";

const TICKTICK_CLIENT_ID = process.env.TICKTICK_CLIENT_ID || "";
const TICKTICK_CLIENT_SECRET = process.env.TICKTICK_CLIENT_SECRET || "";
const TICKTICK_REDIRECT_URI = process.env.TICKTICK_REDIRECT_URI || "";

export async function handleStart(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  let user = await getUserByTelegramId(telegramUserId);

  if (!user) {
    user = await createUser(telegramUserId);
  }

  if (!user.ticktick_access_token) {
    const authUrl = TickTickClient.getOAuthUrl(TICKTICK_CLIENT_ID, TICKTICK_REDIRECT_URI);
    await ctx.reply(
      `Welcome! To get started, I need to connect to your TickTick account.\n\n` +
      `Please authorize the app:\n${authUrl}\n\n` +
      `After authorizing, come back here and send /authdone`
    );
    return;
  }

  if (!user.openrouter_api_key) {
    await ctx.reply(
      `You're connected to TickTick! Now I need your OpenRouter API key to generate plans.\n\n` +
      `Please send your OpenRouter API key. You can get one at https://openrouter.ai/`
    );
    return;
  }

  await ctx.reply(
    `You're all set! Here's what I can do:\n\n` +
    `/plan <task-name> - Start planning a task\n` +
    `/status - Check your connection status\n` +
    `/help - Show this help message`
  );
}

export async function handleAuth(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first to create your account.");
    return;
  }

  const authUrl = TickTickClient.getOAuthUrl(TICKTICK_CLIENT_ID, TICKTICK_REDIRECT_URI);
  await ctx.reply(
    `Please authorize the app:\n${authUrl}\n\n` +
    `After authorizing, come back here and send /authdone`
  );
}

export async function handleAuthDone(ctx: Context) {
  await ctx.reply("Please check if you've completed the authorization. If you have, your tokens should be saved automatically. Use /status to check.");
}

export async function handleStatus(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  const ticktickStatus = user.ticktick_access_token ? "✅ Connected" : "❌ Not connected";
  const openrouterStatus = user.openrouter_api_key ? "✅ Connected" : "❌ Not connected";

  await ctx.reply(
    `Connection Status:\n\n` +
    `TickTick: ${ticktickStatus}\n` +
    `OpenRouter: ${openrouterStatus}\n\n` +
    `Default model: ${user.openrouter_model}`
  );
}

export async function handlePlan(ctx: Context, taskName: string) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  if (!user.ticktick_access_token) {
    await ctx.reply("Please connect TickTick first using /auth");
    return;
  }

  if (!user.openrouter_api_key) {
    await ctx.reply("Please provide your OpenRouter API key first.");
    return;
  }

  const existingConversation = await getActiveConversation(user.id);
  if (existingConversation) {
    await ctx.reply(
      `You already have an active conversation about: "${existingConversation.task_title}".\n` +
      `Use /done to save the plan or /cancel to cancel.`
    );
    return;
  }

  let taskId: string | undefined;
  try {
    const ticktick = new TickTickClient(
      user.ticktick_access_token,
      user.ticktick_refresh_token || "",
      TICKTICK_CLIENT_ID,
      TICKTICK_CLIENT_SECRET,
      TICKTICK_REDIRECT_URI
    );

    const tasks = await ticktick.searchTasks(taskName);
    const firstTask = tasks[0];
    if (firstTask) {
      taskId = firstTask.id;
      taskName = firstTask.title;
    }
  } catch (error) {
    console.error("Error searching for task:", error);
  }

  const conversation = await createConversation(user.id, taskName, taskId);

  const messages: Message[] = [];
  const promptMessages = OpenRouterClient.buildSystemPrompt(taskName, []);
  
  const openrouter = new OpenRouterClient(user.openrouter_api_key, user.openrouter_model);
  const response = await openrouter.chatWithHistory([...promptMessages, { role: "user", content: `I want to plan: "${taskName}". Please ask me clarifying questions.` }]);

  messages.push({ role: "assistant", content: response, timestamp: new Date().toISOString() });
  await updateConversation(conversation.id, messages);

  await ctx.reply(response);
}

export async function handleDone(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  const conversation = await getActiveConversation(user.id);
  if (!conversation) {
    await ctx.reply("No active conversation. Use /plan <task-name> to start planning.");
    return;
  }

  const messages = conversation.messages;
  const lastAssistantMessage = messages.filter(m => m.role === "assistant").pop();

  if (!lastAssistantMessage) {
    await ctx.reply("No plan to save. Let's continue planning first!");
    return;
  }

  if (!conversation.task_id) {
    await ctx.reply("Task not found in TickTick. The plan will not be saved to TickTick.");
    await completeConversation(conversation.id);
    return;
  }

  try {
    const ticktick = new TickTickClient(
      user.ticktick_access_token || "",
      user.ticktick_refresh_token || "",
      TICKTICK_CLIENT_ID,
      TICKTICK_CLIENT_SECRET,
      TICKTICK_REDIRECT_URI,
      async (accessToken, refreshToken, expiresAt) => {
        await import("../lib/supabase").then(m => 
          m.updateUser(telegramUserId, {
            ticktick_access_token: accessToken,
            ticktick_refresh_token: refreshToken,
            ticktick_token_expires_at: expiresAt.toISOString(),
          })
        );
      }
    );

    await ticktick.updateTask(conversation.task_id, { content: lastAssistantMessage.content });
    await completeConversation(conversation.id);

    await ctx.reply("✅ Plan saved to TickTick task!");
  } catch (error) {
    console.error("Error saving to TickTick:", error);
    await ctx.reply("Failed to save plan to TickTick. Please try again.");
  }
}

export async function handleCancel(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  const conversation = await getActiveConversation(user.id);
  if (!conversation) {
    await ctx.reply("No active conversation to cancel.");
    return;
  }

  await cancelConversation(conversation.id);
  await ctx.reply("Conversation cancelled.");
}

export async function handleHelp(ctx: Context) {
  await ctx.reply(
    `TickTick Plan Assistant Commands:\n\n` +
    `/start - Start the bot and check/setup connections\n` +
    `/auth - Re-authorize with TickTick\n` +
    `/plan <task-name> - Start planning a task\n` +
    `/done - Save the current plan to TickTick\n` +
    `/cancel - Cancel the current conversation\n` +
    `/status - Check connection status\n` +
    `/model <model-name> - Change the LLM model\n` +
    `/help - Show this help message\n\n` +
    `Just send a message to continue the conversation!`
  );
}

export async function handleModel(ctx: Context, model: string) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  await import("../lib/supabase").then(m => m.updateUser(telegramUserId, { openrouter_model: model }));
  await ctx.reply(`Default model changed to: ${model}`);
}

export async function handleMessage(ctx: Context) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;
  if (!ctx.message?.text) return;

  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const user = await getUserByTelegramId(telegramUserId);
  if (!user) {
    await ctx.reply("Please send /start first.");
    return;
  }

  if (!user.openrouter_api_key && text.startsWith("sk-")) {
    await import("../lib/supabase").then(m => m.updateUser(telegramUserId, { openrouter_api_key: text }));
    await ctx.reply("✅ OpenRouter API key saved! You can now use /plan <task-name> to start planning.");
    return;
  }

  const conversation = await getActiveConversation(user.id);
  if (!conversation) {
    await ctx.reply("No active conversation. Use /plan <task-name> to start planning.");
    return;
  }

  const messages = conversation.messages;
  messages.push({ role: "user", content: text, timestamp: new Date().toISOString() });

  const historyForLLM = messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  const promptMessages = OpenRouterClient.buildSystemPrompt(conversation.task_title, historyForLLM);

  try {
    const openrouter = new OpenRouterClient(user.openrouter_api_key || "", user.openrouter_model);
    const response = await openrouter.chatWithHistory(promptMessages);

    messages.push({ role: "assistant", content: response, timestamp: new Date().toISOString() });
    await updateConversation(conversation.id, messages);

    await ctx.reply(response);
  } catch (error) {
    console.error("Error calling LLM:", error);
    await ctx.reply("Sorry, I encountered an error. Please try again.");
  }
}
