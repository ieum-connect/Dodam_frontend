// 문서 이름은 서버에 변경 API가 없어 이 기기에서 고친 이름(localStorage)을 먼저 쓴다.
export const documentNoteKey = (documentId) => `dodam-document-note-${documentId}`;

export function documentDisplayName(doc, fallback = '이름 없는 문서') {
  try {
    const saved = typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(documentNoteKey(doc?.documentId)));
    if (saved?.name?.trim()) return saved.name.trim();
  } catch (error) {
    console.warn('[document] 저장된 문서 이름을 읽지 못했어요', error?.message);
  }
  return doc?.documentName || fallback;
}
