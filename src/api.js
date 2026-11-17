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
  400: '입력한 내용 중 확인이 필요한 항목이 있어요. 내용을 확인한 뒤 다시 시도해 주세요.',
  401: '로그인 시간이 만료되었어요. 다시 로그인한 뒤 시도해 주세요.',
  403: '이 아이의 기록을 볼 권한이 없어요. 현재 선택한 계정과 아이를 확인해 주세요.',
  404: '요청한 대화나 문서를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요.',
  409: '다른 곳에서 내용이 변경되었어요. 화면을 새로고침해 최신 내용을 확인해 주세요.',
  413: '파일 크기가 너무 커서 처리할 수 없어요. 더 작은 파일로 다시 시도해 주세요.',
  429: '요청이 한꺼번에 많이 들어왔어요. 잠시 기다린 뒤 다시 시도해 주세요.',
  500: '서버가 요청을 처리하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  502: 'AI 답변 서버의 응답을 확인하지 못했어요. 잠시 후 다시 질문해 주세요.',
  503: 'AI 답변 기능을 잠시 사용할 수 없어요. 잠시 기다린 뒤 다시 시도해 주세요.',
  504: 'AI 답변을 만드는 데 예상보다 오래 걸렸어요. 잠시 후 다시 질문해 주세요.',
};

const withoutInternalCode = value => String(value || '')
  .replace(/\s*\([A-Z][A-Z0-9_:-]*\)\s*$/u, '')
  .trim();

export function errorMessage(error, fallback = '요청을 처리하지 못했어요.') {
  if (!(error instanceof ApiError)) return withoutInternalCode(error?.message || fallback) || fallback;
  const message = error.body?.message || STATUS_MESSAGES[error.status] || error.message || fallback;
  return withoutInternalCode(message) || fallback;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers });
  } catch {
    throw new ApiError('서버에 연결할 수 없어요. 네트워크 상태를 확인하고 잠시 후 다시 시도해 주세요.');
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
  pushConfig: () => request('/api/push/config'),
  registerPush: (token, showDetails) => request('/api/push/devices', { method: 'POST', body: JSON.stringify({ token, showDetails }) }),
  unregisterPush: token => request('/api/push/devices', { method: 'DELETE', body: JSON.stringify({ token }) }),
  growthRecords: (patientId) => request(`/api/growth-records?${new URLSearchParams({ patientId })}`),
  createGrowth: (body) => request('/api/growth-records', { method: 'POST', body: JSON.stringify(body) }),
  updateGrowth: (id, body) => request(`/api/growth-records/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGrowth: (id, version) => request(`/api/growth-records/${id}?version=${version}`, { method: 'DELETE' }),
  timelinePage: (kind, patientId, cursor, signal) => request(`/api/${kind}?${new URLSearchParams({ patientId, size: '50', ...(cursor ? { cursor } : {}) })}`, { signal }),
  actionItems: (patientId) => request(`/api/action-items?patientId=${encodeURIComponent(patientId)}`),
  approveAction: (id, startsAt, repeat = {}) => request(`/api/action-items/${id}/approve`, { method: 'POST', body: JSON.stringify({ startsAt, ...repeat }) }),
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
  kakaoAccountLoginUrl: `${API_BASE}/oauth2/authorization/kakao?chooseAccount=1`,
  logout: () => request('/logout', { method: 'POST' }),
  children: () => request('/api/children'),
  createChild: (body) => request('/api/children', { method: 'POST', body: JSON.stringify(body) }),
  childParents: (childId) => request(`/api/children/${childId}/parents`),
  disconnectChildParent: (childId, userId) => request(`/api/children/${childId}/parents/${userId}`, { method: 'DELETE' }),
  joinChild: (inviteCode) => request('/api/children/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  visits: (patientId, cursor) => request(`/api/visits?${new URLSearchParams({ ...(patientId ? {patientId} : {}), ...(cursor ? {cursor} : {}) })}`),
  createVisit: (body) => request('/api/visits', { method: 'POST', body: JSON.stringify(body) }),
  updateVisit: (visitId, body) => request(`/api/visits/${visitId}`, { method: 'PUT', body: JSON.stringify(body) }),
  documents: (patientId, visitId, cursor, size) => request(`/api/documents?${new URLSearchParams({...(patientId?{patientId}:{}),...(visitId?{visitId}:{}),...(cursor?{cursor}:{}),...(size?{size:String(size)}:{})})}`),
  document: (documentId) => request(`/api/documents/${documentId}`),
  reanalyzeAsPrescription: (documentId) => request(`/api/documents/${documentId}/reanalyze-as-prescription`, { method: 'POST' }),
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
  updateMedicationSeries: (id, body) => request(`/api/medication-series/${id}`, {method:'PUT',body:JSON.stringify(body)}),
  stopMedicationSeries: id => request(`/api/medication-series/${id}/stop`,{method:'POST'}),
  createHealthRecord: (body) => request('/api/health-records', { method: 'POST', body: JSON.stringify(body) }),
  updateHealthRecord: (recordId, body) => request(`/api/health-records/${recordId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteHealthRecord: (recordId) => request(`/api/health-records/${recordId}`, { method: 'DELETE' }),
  readNotification: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  notifications: () => request('/api/notifications'),
  // 가족 공유 및 돌봄 관계
  careRelations: () => request('/api/care-relations'),
  acceptCareRelation: (relationId) => request(`/api/care-relations/${relationId}/accept`, { method: 'POST' }),
  rejectCareRelation: (relationId) => request(`/api/care-relations/${relationId}/reject`, { method: 'POST' }),
  updateChild: (childId, body) => request(`/api/children/${childId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVisit: (visitId) => request(`/api/visits/${visitId}`, { method: 'DELETE' }),
  deleteDocument: (documentId) => request(`/api/documents/${documentId}`, { method: 'DELETE' }),
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
  aiDocumentSections: (documentId, sectionType) => request(`/api/ai-documents/${documentId}/sections${sectionType ? `?sectionType=${encodeURIComponent(sectionType)}` : ''}`),
  aiDocumentStatus: (documentId) => request(`/api/ai-documents/${documentId}/explanation-status`),
  aiDocumentFacts: (documentId) => request(`/api/ai-documents/${documentId}/facts`),
  aiDocumentCitations: (documentId, sectionId) => request(`/api/ai-documents/${documentId}/citations${sectionId ? `?sectionId=${encodeURIComponent(sectionId)}` : ''}`),
  vaccinations: (patientId) => request(`/api/vaccinations?patientId=${encodeURIComponent(patientId)}`),
  checkVaccination: (patientId, doseId) => request(`/api/vaccinations/checks/${encodeURIComponent(doseId)}?patientId=${encodeURIComponent(patientId)}`, { method: 'PUT' }),
  uncheckVaccination: (patientId, doseId) => request(`/api/vaccinations/checks/${encodeURIComponent(doseId)}?patientId=${encodeURIComponent(patientId)}`, { method: 'DELETE' }),
  accounts: () => request('/api/accounts'),
  switchAccount: (role) => request('/api/accounts/switch', { method: 'POST', body: JSON.stringify({ role }) }),
  deleteMe: () => request('/api/me', { method: 'DELETE', body: JSON.stringify({ confirmed: true }) }),
};
