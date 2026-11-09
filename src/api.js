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
  growthRecords: (patientId) => request(`/api/growth-records?${new URLSearchParams({ patientId })}`),
  createGrowth: (body) => request('/api/growth-records', { method: 'POST', body: JSON.stringify(body) }),
  updateGrowth: (id, body) => request(`/api/growth-records/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGrowth: (id, version) => request(`/api/growth-records/${id}?version=${version}`, { method: 'DELETE' }),
  timelinePage: (kind, patientId, cursor, signal) => request(`/api/${kind}?${new URLSearchParams({ patientId, size: '50', ...(cursor ? { cursor } : {}) })}`, { signal }),
  actionItems: (patientId) => request(`/api/action-items?patientId=${encodeURIComponent(patientId)}`),
  approveAction: (id, startsAt) => request(`/api/action-items/${id}/approve`, { method: 'POST', body: JSON.stringify({ startsAt }) }),
  rejectAction: (id) => request(`/api/action-items/${id}/reject`, { method: 'POST' }),
  schedules: (patientId, from, to) => request(`/api/schedules?${new URLSearchParams({ patientId, from, to })}`),
  createSchedule: (body) => request('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
  createScheduleBatch: (body) => request('/api/schedule-batches', { method: 'POST', body: JSON.stringify(body) }),
  updateSchedule: (id, body) => request(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  completeSchedule: (id) => request(`/api/schedules/${id}/complete`, { method: 'POST' }),
  cancelSchedule: (id) => request(`/api/schedules/${id}`, { method: 'DELETE' }),
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/me'),
  updateMyProfile: (body) => request('/api/me/profile', { method: 'PUT', body: JSON.stringify(body) }),
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
  askChat: (sessionId, question, documentIds) => request(`/api/ai-chat-sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ question, documentIds }) }),
  memoTags: patientId => request(`/api/memo-tags?patientId=${encodeURIComponent(patientId)}`),
  createMemoTag: body => request('/api/memo-tags', {method:'POST',body:JSON.stringify(body)}),
  updateMemoTag: (id,body) => request(`/api/memo-tags/${id}`, {method:'PUT',body:JSON.stringify(body)}),
  deleteMemoTag: (id,version) => request(`/api/memo-tags/${id}?version=${version}`, {method:'DELETE'}),
  medicationSeries: patientId => request(`/api/medication-series?patientId=${encodeURIComponent(patientId)}`),
  createMedicationSeries: body => request('/api/medication-series',{method:'POST',body:JSON.stringify(body)}),
  stopMedicationSeries: id => request(`/api/medication-series/${id}/stop`,{method:'POST'}),
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
  welfarePrograms: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== '')).toString();
    return request(`/api/welfare-programs${query ? `?${query}` : ''}`);
  },
  welfareProgram: (programId) => request(`/api/welfare-programs/${programId}`),
  welfareProfile: (patientId) => request(`/api/welfare-profiles?patientId=${encodeURIComponent(patientId)}`),
  welfareProfileOptions: () => request('/api/welfare-profiles/options'),
  welfareRegions: (level = 'PROVINCE', parentCode) => {
    const query = new URLSearchParams({ level, ...(parentCode ? { parentCode } : {}) });
    return request(`/api/welfare-regions?${query}`);
  },
  saveWelfareProfile: (patientId, body) => request(`/api/welfare-profiles/${patientId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWelfareProfile: (patientId) => request(`/api/welfare-profiles/${patientId}`, { method: 'DELETE' }),
  welfareRecommendations: (patientId, type) => {
    const query = new URLSearchParams({ patientId, ...(type ? { type } : {}) }).toString();
    return request(`/api/welfare-recommendations?${query}`);
  },
  welfareAiExplain: (patientId, body) => request(`/api/welfare-explanations?patientId=${encodeURIComponent(patientId)}`, { method: 'POST', body: JSON.stringify(body) }),
  welfareFavorites: (patientId) => request(`/api/welfare-favorites?patientId=${encodeURIComponent(patientId)}`),
  addWelfareFavorite: (patientId, programId) => request(`/api/welfare-favorites?patientId=${encodeURIComponent(patientId)}&programId=${encodeURIComponent(programId)}`, { method: 'POST' }),
  removeWelfareFavorite: (patientId, programId) => request(`/api/welfare-favorites/${encodeURIComponent(programId)}?patientId=${encodeURIComponent(patientId)}`, { method: 'DELETE' }),
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
