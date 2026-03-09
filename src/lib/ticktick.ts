const TICKTICK_BASE_URL = "https://api.ticktick.com/open/v1";

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content: string;
  dueDate?: string;
  priority?: number;
  status?: number;
}

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
}

export class TickTickClient {
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private onTokenRefresh?: (accessToken: string, refreshToken: string, expiresAt: Date) => void;

  constructor(
    accessToken: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    onTokenRefresh?: (accessToken: string, refreshToken: string, expiresAt: Date) => void
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.onTokenRefresh = onTokenRefresh;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${TICKTICK_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TickTick API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private async refreshAccessToken(): Promise<void> {
    const response = await fetch(`${TICKTICK_BASE_URL}/oauth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh TickTick token");
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    if (this.onTokenRefresh) {
      this.onTokenRefresh(this.accessToken, this.refreshToken, expiresAt);
    }
  }

  async getProjects(): Promise<TickTickProject[]> {
    return this.request<TickTickProject[]>("/project");
  }

  async getTask(taskId: string): Promise<TickTickTask> {
    return this.request<TickTickTask>(`/task/${taskId}`);
  }

  async searchTasks(query: string): Promise<TickTickTask[]> {
    return this.request<TickTickTask[]>(`/task?search=${encodeURIComponent(query)}`);
  }

  async updateTask(taskId: string, updates: Partial<Pick<TickTickTask, "content">>): Promise<TickTickTask> {
    return this.request<TickTickTask>(`/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  static getOAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "tasks:read tasks:write",
    });

    return `https://ticktick.com/oauth/authorize?${params.toString()}`;
  }

  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const response = await fetch(`${TICKTICK_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
    return data;
  }
}
