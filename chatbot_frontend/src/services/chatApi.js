const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

const REQUEST_TIMEOUT = 25_000; // AI inference can be slow

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function startChatSession() {
  const res = await fetchWithTimeout(`${BASE_URL}/chat/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await handleResponse(res);
  return data.session_id;
}

export async function sendChatMessage(sessionId, text) {
  const res = await fetchWithTimeout(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, text }),
  });

  return handleResponse(res);
}
