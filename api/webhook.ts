import { Bot } from "grammy";
import {
  handleStart,
  handleAuth,
  handleAuthDone,
  handleStatus,
  handlePlan,
  handleDone,
  handleCancel,
  handleHelp,
  handleModel,
  handleMessage,
} from "../src/bot/commands";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.command("start", handleStart);
bot.command("auth", handleAuth);
bot.command("authdone", handleAuthDone);
bot.command("status", handleStatus);
bot.command("done", handleDone);
bot.command("cancel", handleCancel);
bot.command("help", handleHelp);

bot.command("plan", async (ctx) => {
  const taskName = ctx.message?.text.replace("/plan", "").trim();
  if (!taskName) {
    await ctx.reply("Please provide a task name. Usage: /plan <task-name>");
    return;
  }
  await handlePlan(ctx, taskName);
});

bot.command("model", async (ctx) => {
  const model = ctx.message?.text.replace("/model", "").trim();
  if (!model) {
    await ctx.reply("Please provide a model name. Usage: /model <model-name>");
    return;
  }
  await handleModel(ctx, model);
});

bot.on("message:text", handleMessage);

bot.catch((err) => {
  console.error("Bot error:", err);
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") {
    try {
      const update = await req.json() as unknown;
      await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0]);
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error handling update:", error);
      return new Response("Error", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

export { bot };
