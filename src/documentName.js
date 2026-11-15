// 문서 이름은 서버에 변경 API가 없어 이 기기에서 고친 이름(localStorage)을 먼저 쓴다.
export const documentNoteKey = (documentId) => `dodam-document-note-${documentId}`;

// 이 기기에 저장된 문서 정보({name, note, kind}). 없거나 읽지 못하면 빈 객체.
export function readDocumentNote(documentId) {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(documentNoteKey(documentId))) || {};
  } catch (error) {
    console.warn('[document] 저장된 문서 정보를 읽지 못했어요', error?.message);
    return {};
  }
}

export function saveDocumentNote(documentId, patch) {
  const next = { ...readDocumentNote(documentId), ...patch };
  try {
    localStorage.setItem(documentNoteKey(documentId), JSON.stringify(next));
  } catch (error) {
    console.warn('[document] 문서 정보를 저장하지 못했어요', error?.message); // 업로드 성공을 실패로 보이게 하지 않는다
  }
  return next;
}

// 삭제된 문서의 이름·종류·메모를 지운다.
export function removeDocumentNote(documentId) {
  try {
    localStorage.removeItem(documentNoteKey(documentId));
  } catch (error) {
    console.warn('[document] 문서 정보를 지우지 못했어요', error?.message);
  }
}

export function documentDisplayName(doc, fallback = '이름 없는 문서') {
  const saved = readDocumentNote(doc?.documentId);
  if (saved?.name?.trim()) return saved.name.trim();
  return doc?.documentName || fallback;
}

// 화면에 보이는 문서 종류는 두 개뿐이다. 사용자가 고른 값이 먼저, 없으면 AI 분류(documentType)로 정한다.
export const DOCUMENT_KINDS = { MEDICAL: '의료문서', MEDICATION: '복약문서' };
const AI_KIND = { PRESCRIPTION: 'MEDICATION', LAB_RESULT: 'MEDICAL', DIAGNOSIS: 'MEDICAL', DISCHARGE_GUIDE: 'MEDICAL' };

export function documentKind(doc) {
  const saved = readDocumentNote(doc?.documentId).kind;
  if (DOCUMENT_KINDS[saved]) return saved;
  return AI_KIND[doc?.documentType] ?? null; // UNKNOWN·값 없음은 종류 미지정
}

// 마지막 확장자만 뺀다. ".pdf"처럼 이름이 비게 되면 원래 이름을 쓴다.
export const fileBaseName = (name = '') => name.replace(/\.[^.]+$/, '') || name;
