const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers });
  if (!response.ok) {
    let body = null;
    try { body = await response.json(); } catch { body = await response.text(); }
    throw new ApiError(body?.message || body?.error || '요청을 처리하지 못했어요.', response.status, body);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/me'),
  demoLogin: () => request('/api/demo/login', { method: 'POST', body: JSON.stringify({ role: 'CAREGIVER' }) }),
  kakaoLoginUrl: `${API_BASE}/oauth2/authorization/kakao`,
  logout: () => request('/logout', { method: 'POST' }),
  children: () => request('/api/children'),
  createChild: (body) => request('/api/children', { method: 'POST', body: JSON.stringify(body) }),
  visits: (patientId) => request(`/api/visits${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  createVisit: (body) => request('/api/visits', { method: 'POST', body: JSON.stringify(body) }),
  documents: (patientId) => request(`/api/documents${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  uploadDocument: (visitId, file, declaredDocType) => {
    const form = new FormData(); form.append('file', file);
    if (declaredDocType) form.append('declaredDocType', declaredDocType);
    return request(`/api/visits/${visitId}/documents`, { method: 'POST', body: form, headers: { 'Idempotency-Key': crypto.randomUUID() } });
  },
  chatSessions: (patientId) => request(`/api/ai-chat-sessions${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  createChatSession: (patientId, title) => request('/api/ai-chat-sessions', { method: 'POST', body: JSON.stringify({ patientId, title }) }),
  askChat: (sessionId, question, documentIds) => request(`/api/ai-chat-sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ question, questionType: 'DOCUMENT_EASY_EXPLANATION', documentIds }) }),
  notifications: () => request('/api/notifications'),
};
