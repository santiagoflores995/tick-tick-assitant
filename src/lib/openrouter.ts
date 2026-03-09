const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = "openai/gpt-4o") {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async chat(request: OpenRouterRequest): Promise<string> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": process.env.TICKTICK_REDIRECT_URI || "http://localhost",
        "X-Title": "TickTick Plan Assistant",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenRouter");
    }

    const firstChoice = data.choices?.[0];
    const content = firstChoice?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenRouter");
    }

    return content;
  }

  async chatWithHistory(
    messages: OpenRouterMessage[],
    model?: string
  ): Promise<string> {
    return this.chat({
      model: model || this.defaultModel,
      messages,
    });
  }

  static buildSystemPrompt(taskTitle: string, conversationHistory: OpenRouterMessage[]): OpenRouterMessage[] {
    const systemPrompt: OpenRouterMessage = {
      role: "system",
      content: `You are a helpful assistant that helps users break down tasks into actionable plans.

Your job:
1. Ask clarifying questions to understand the task fully
2. Create a detailed, step-by-step plan
3. Estimate time for each step
4. Be conversational and friendly
5. Only create the final plan when the user says "/done" or "looks good"

Rules:
- Ask no more than 3-4 questions at a time
- Keep responses concise but helpful
- When creating the plan, use this format:
  ## Plan
  - [Step description] ([time estimate])
  - ...

Current task: ${taskTitle}

Conversation so far:
${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
    };

    return [systemPrompt];
  }
}
