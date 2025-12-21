export type ChatStartResponse = {
  session_id: string;
};

export type ChatMessageResponse = {
  bot_message: string;
  emotion: string;
  stress_level: string;
  academic_stress_category: string;
  risk_level: string;
  overall_status: string;
  techniques: string[];
};

/**
 * Base URL for the FastAPI backend.
 *
 * For Expo Web, "localhost" is usually correct while the
 * backend is running on your own machine.
 *
 * You can override this with EXPO_PUBLIC_API_URL in .env if needed.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

const REQUEST_TIMEOUT = 25_000; // AI inference can be slow

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function startChatSession(): Promise<string> {
  const res = await fetchWithTimeout(`${BASE_URL}/chat/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await handleResponse<ChatStartResponse>(res);
  return data.session_id;
}

export async function sendChatMessage(
  sessionId: string,
  text: string
): Promise<ChatMessageResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, text }),
  });

  return handleResponse<ChatMessageResponse>(res);
}
