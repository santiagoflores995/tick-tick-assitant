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
} from "../src/bot/commands.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot: Bot | null = null;

function getBot(): Bot {
  if (!bot) {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }
    bot = new Bot(TELEGRAM_BOT_TOKEN);

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
  }
  return bot;
}

export default async function handler(req: Request): Promise<Response> {
  console.log("Webhook called, method:", req.method);
  if (req.method === "GET") {
    console.log("Returning GET response");
    return new Response("TickTick Plan Assistant is running!", { status: 200 });
  }

  if (req.method === "POST") {
    try {
      const update = await req.json();
      const botInstance = getBot();
      botInstance.handleUpdate(update as never);
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error handling update:", error);
      return new Response("Error: " + String(error), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
