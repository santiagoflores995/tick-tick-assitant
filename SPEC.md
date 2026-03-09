# TickTick Plan Assistant - Specification

## 1. Project Overview

**Name**: TickTick Plan Assistant  
**Type**: Telegram Bot + Serverless Backend  
**Purpose**: AI-powered task planning that reads tasks from TickTick, helps break them down via conversation, and saves the plan back to the task description.  
**Target User**: Single user (self-hosted for personal use)

---

## 2. Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Platform | Vercel (Serverless Functions) |
| Chat Interface | Telegram Bot API |
| LLM | OpenRouter (configurable: GPT-4o, Claude, etc.) |
| Database | Supabase (PostgreSQL) |
| Task Source | TickTick OAuth2 REST API |

---

## 3. Architecture

```
┌────────────┐     ┌──────────────┐     ┌────────────┐
│  Telegram  │────▶│  Vercel      │────▶│  OpenRouter│
│  User      │     │  API Routes  │     │  (LLM)     │
└────────────┘     └──────┬───────┘     └────────────┘
                          │
                    ┌─────▼──────┐     ┌────────────┐
                    │  Supabase  │◀────│  TickTick  │
                    │  (storage) │     │  (API)     │
                    └────────────┘     └────────────┘
```

---

## 4. Supabase Schema

### Table: `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `telegram_user_id` | BIGINT | Telegram user ID |
| `ticktick_access_token` | TEXT | TickTick OAuth access token |
| `ticktick_refresh_token` | TEXT | TickTick OAuth refresh token |
| `ticktick_token_expires_at` | TIMESTAMP | Token expiration time |
| `openrouter_api_key` | TEXT | User's OpenRouter API key |
| `openrouter_model` | TEXT | Default model (e.g., `openai/gpt-4o`) |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

### Table: `conversations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to `users.id` |
| `task_title` | TEXT | Original task title from TickTick |
| `task_id` | TEXT | TickTick task ID (if found) |
| `messages` | JSONB | Array of {role, content, timestamp} |
| `status` | TEXT | `active`, `completed`, `cancelled` |
| `created_at` | TIMESTAMP | Conversation start time |
| `updated_at` | TIMESTAMP | Last message time |

---

## 5. Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start bot, trigger TickTick OAuth if not connected |
| `/auth` | Re-trigger TickTick OAuth flow |
| `/plan <task-name>` | Start planning a task (creates new conversation) |
| `/done` | Save current plan to TickTick task description |
| `/cancel` | Cancel current conversation |
| `/status` | Show connection status (TickTick, OpenRouter) |
| `/model <model-name>` | Change OpenRouter model |
| `/help` | Show help message |

---

## 6. User Flow

1. User sends `/plan get a haircut`
2. Bot validates task exists in TickTick
3. Creates conversation in Supabase
4. LLM asks clarifying questions
5. User answers → LLM refines plan
6. User types `/done` → Bot updates task description in TickTick

---

## 7. API Endpoints (Vercel)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook` | POST | Telegram webhook |
| `/api/oauth/ticktick/callback` | GET | OAuth callback |

---

## 8. LLM System Prompt

```
You are a helpful assistant that helps users break down tasks into actionable plans.

Your job:
1. Ask clarifying questions to understand the task fully
2. Create a detailed, step-by-step plan
3. Estimate time for each step
4. Be conversational and friendly
5. Only create the final plan when the user says "/done"

Rules:
- Ask no more than 3-4 questions at a time
- When creating the plan, use: ## Plan - [Step] ([time])
```

---

## 9. TickTick Integration

- **OAuth2** with refresh tokens
- **Base URL**: `https://api.ticktick.com/open/v1`
- **Endpoints used**: GET `/project`, GET `/task`, POST `/task/{id}` (update description)

---

## 10. Environment Variables

```
TELEGRAM_BOT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_KEY
OPENROUTER_API_KEY
TICKTICK_CLIENT_ID
TICKTICK_CLIENT_SECRET
TICKTICK_REDIRECT_URI
```

---

## 11. File Structure

```
/
├── api/
│   ├── webhook.ts
│   └── oauth/callback.ts
├── src/
│   ├── bot/commands.ts
│   ├── bot/handlers.ts
│   └── lib/
│       ├── supabase.ts
│       ├── ticktick.ts
│       └── openrouter.ts
├── supabase/schema.sql
├── .env.example
├── package.json
└── vercel.json
```

---

## 12. Future Enhancements (Out of Scope)

- Create subtasks in TickTick automatically
- Voice input / speech-to-text
- Multiple LLM providers (Anthropic, OpenAI direct)
- Shared plans with others
- Template system for common task types
