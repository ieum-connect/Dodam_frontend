const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message, status = 0, body = null, code = 'NETWORK_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = body?.code || code;
  }
}

const STATUS_MESSAGES = {
  400: '보낸 내용을 확인해주세요.', 401: '로그인이 만료되었어요. 다시 로그인해주세요.',
  403: '이 아이의 기록에 접근할 권한이 없어요.', 404: '요청한 대화나 문서를 찾지 못했어요.',
  409: '다른 곳에서 내용이 변경됐어요. 새로고침 후 다시 시도해주세요.',
  413: '파일 크기가 너무 커요.', 429: '요청이 많아요. 잠시 후 다시 시도해주세요.',
  500: '서버에서 오류가 발생했어요.', 502: 'AI 서버가 올바르게 응답하지 않았어요.',
  503: 'AI 서버가 잠시 사용할 수 없는 상태예요.', 504: 'AI 답변 시간이 초과됐어요.',
};

export function errorMessage(error, fallback = '요청을 처리하지 못했어요.') {
  if (!(error instanceof ApiError)) return error?.message || fallback;
  const message = error.body?.message || STATUS_MESSAGES[error.status] || error.message || fallback;
  return error.code && !['NETWORK_ERROR', 'UNKNOWN_ERROR'].includes(error.code)
    ? `${message} (${error.code})`
    : message;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers });
  } catch {
    throw new ApiError('서버에 연결할 수 없어요. 실행 상태와 네트워크를 확인해주세요.');
  }
  if (!response.ok) {
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw ? { message: raw } : null; }
    throw new ApiError(body?.message || body?.error || STATUS_MESSAGES[response.status] || '요청을 처리하지 못했어요.', response.status, body, body?.code || 'UNKNOWN_ERROR');
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/me'),
  demoLogin: (account) => request('/api/demo/login', { method: 'POST', body: JSON.stringify(account ? { account } : { role: 'CAREGIVER' }) }),
  kakaoLoginUrl: `${API_BASE}/oauth2/authorization/kakao`,
  logout: () => request('/logout', { method: 'POST' }),
  children: () => request('/api/children'),
  createChild: (body) => request('/api/children', { method: 'POST', body: JSON.stringify(body) }),
  childParents: (childId) => request(`/api/children/${childId}/parents`),
  joinChild: (inviteCode) => request('/api/children/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  visits: (patientId) => request(`/api/visits${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  visit: (visitId) => request(`/api/visits/${visitId}`),
  createVisit: (body) => request('/api/visits', { method: 'POST', body: JSON.stringify(body) }),
  updateVisit: (visitId, body) => request(`/api/visits/${visitId}`, { method: 'PUT', body: JSON.stringify(body) }),
  documents: (patientId) => request(`/api/documents${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  document: (documentId) => request(`/api/documents/${documentId}`),
  uploadDocument: (visitId, file, declaredDocType) => {
    const form = new FormData(); form.append('file', file);
    if (declaredDocType) form.append('declaredDocType', declaredDocType);
    return request(`/api/visits/${visitId}/documents`, { method: 'POST', body: form, headers: { 'Idempotency-Key': crypto.randomUUID() } });
  },
  chatSessions: (patientId) => request(`/api/ai-chat-sessions${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  createChatSession: (patientId, title) => request('/api/ai-chat-sessions', { method: 'POST', body: JSON.stringify({ patientId, title }) }),
  chatMessages: (sessionId) => request(`/api/ai-chat-sessions/${sessionId}/messages`),
  askChat: (sessionId, question, documentIds, questionType = 'DOCUMENT_EASY_EXPLANATION') => request(`/api/ai-chat-sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ question, questionType, documentIds }) }),
  healthRecords: (patientId) => request(`/api/health-records${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  createHealthRecord: (body) => request('/api/health-records', { method: 'POST', body: JSON.stringify(body) }),
  updateHealthRecord: (recordId, body) => request(`/api/health-records/${recordId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteHealthRecord: (recordId) => request(`/api/health-records/${recordId}`, { method: 'DELETE' }),
  readNotification: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  aiDocument: (documentId) => request(`/api/ai-documents/${documentId}`),
  aiResultDocument: (resultDocumentId) => request(`/api/ai-result-documents/${resultDocumentId}`),
  notifications: () => request('/api/notifications'),
  // 가족 공유 및 돌봄 관계
  careRelations: () => request('/api/care-relations'),
  careRelation: (relationId) => request(`/api/care-relations/${relationId}`),
  requestCareRelation: (inviteCode) => request('/api/care-relations', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  acceptCareRelation: (relationId) => request(`/api/care-relations/${relationId}/accept`, { method: 'POST' }),
  rejectCareRelation: (relationId) => request(`/api/care-relations/${relationId}/reject`, { method: 'POST' }),
  cancelCareRelation: (relationId) => request(`/api/care-relations/${relationId}/request`, { method: 'DELETE' }),
  revokeCareRelation: (relationId) => request(`/api/care-relations/${relationId}`, { method: 'DELETE' }),
  updateChild: (childId, body) => request(`/api/children/${childId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVisit: (visitId) => request(`/api/visits/${visitId}`, { method: 'DELETE' }),
  deleteDocument: (documentId) => request(`/api/documents/${documentId}`, { method: 'DELETE' }),
  aiDocuments: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== '')).toString();
    return request(`/api/ai-documents${query ? `?${query}` : ''}`);
  },
  aiDocumentSections: (documentId, sectionType) => request(`/api/ai-documents/${documentId}/sections${sectionType ? `?sectionType=${encodeURIComponent(sectionType)}` : ''}`),
  aiDocumentStatus: (documentId) => request(`/api/ai-documents/${documentId}/explanation-status`),
  aiDocumentFacts: (documentId) => request(`/api/ai-documents/${documentId}/facts`),
  aiDocumentCitations: (documentId, sectionId) => request(`/api/ai-documents/${documentId}/citations${sectionId ? `?sectionId=${encodeURIComponent(sectionId)}` : ''}`),
  aiDocumentPage: (documentId, pageNo, anchorId) => request(`/api/ai-documents/${documentId}/pages/${pageNo}${anchorId ? `?anchorId=${encodeURIComponent(anchorId)}` : ''}`),
  accounts: () => request('/api/accounts'),
  switchAccount: (role) => request('/api/accounts/switch', { method: 'POST', body: JSON.stringify({ role }) }),
  needsRole: () => request('/api/auth/needs-role'),
  setRole: (role) => request('/api/role', { method: 'POST', body: JSON.stringify({ role }) }),
  updateMyRole: (role) => request('/api/me/role', { method: 'PUT', body: JSON.stringify({ role }) }),
  deleteMe: () => request('/api/me', { method: 'DELETE' }),
};
