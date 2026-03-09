import { TickTickClient } from "../../src/lib/ticktick";
import { getUserByTelegramId, updateUser } from "../../src/lib/supabase";

const TICKTICK_CLIENT_ID = process.env.TICKTICK_CLIENT_ID || "";
const TICKTICK_CLIENT_SECRET = process.env.TICKTICK_CLIENT_SECRET || "";
const TICKTICK_REDIRECT_URI = process.env.TICKTICK_REDIRECT_URI || "";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const telegramUserId = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  if (!telegramUserId) {
    return new Response("Missing state parameter", { status: 400 });
  }

  try {
    const tokens = await TickTickClient.exchangeCodeForTokens(
      code,
      TICKTICK_CLIENT_ID,
      TICKTICK_CLIENT_SECRET,
      TICKTICK_REDIRECT_URI
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await updateUser(parseInt(telegramUserId), {
      ticktick_access_token: tokens.access_token,
      ticktick_refresh_token: tokens.refresh_token,
      ticktick_token_expires_at: expiresAt.toISOString(),
    });

    return new Response(
      `<html><body><h1>Authorization Successful!</h1><p>You can now close this window and go back to Telegram.</p></body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(
      `<html><body><h1>Authorization Failed</h1><p>Please try again.</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
