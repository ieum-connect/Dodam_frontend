export function localDay(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Follow every cursor: a first-page-only view silently hides older records.
export async function readTimelinePages(fetchPage, signal) {
  const items = [];
  const cursors = new Set();
  let cursor;
  do {
    if (signal?.aborted) throw new Error('조회가 취소되었어요.');
    const page = await fetchPage(cursor);
    items.push(...(page.items || []));
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error('다음 기록을 불러오지 못했어요. 다시 시도해주세요.');
    cursors.add(cursor);
  } while (cursor);
  return items;
}

export function buildTimeline({ visits = [], documents = [], memos = [], schedules = [] }, month) {
  const visitMap = new Map(visits.map(v => [v.visitId, v]));
  const linkedVisit = id => {
    const visit = visitMap.get(id);
    return visit ? `${visit.visitedOn} · ${visit.hospitalName || '병원 방문'}` : id ? '병원 방문 기록에 연결됨' : '';
  };
  const rows = [
    ...visits.filter(v => v.visitStatus !== 'CANCELED' && v.visitStatus !== 'CANCELLED').map(v => ({
      id: `visit-${v.visitId}`, kind: 'visits', date: v.visitedOn, title: v.hospitalName || '병원 방문',
      body: [v.department, v.memo].filter(Boolean).join(' · '), route: 'records', routeLabel: '병원 방문 목록 열기', label: '방문일',
    })),
    ...documents.map(d => ({
      id: `document-${d.documentId}`, kind: 'documents', date: d.createdAt, title: d.documentName || '건강 문서',
      body: linkedVisit(d.visitId), route: 'documents', routeLabel: '건강 문서 목록 열기', label: '업로드',
    })),
    ...memos.map(m => ({
      id: `memo-${m.recordId}`, kind: 'memos', date: m.recordedAt || m.createdAt, title: '육아 메모',
      body: m.body, detail: [m.authorName && `작성자 ${m.authorName}`, linkedVisit(m.visitId)].filter(Boolean).join(' · '),
      route: 'memo', routeLabel: '육아 메모 열기', label: '기록 시각',
    })),
    ...schedules.filter(s => s.status !== 'CANCELLED').map(s => ({
      id: `schedule-${s.id}`, kind: 'schedules', date: s.startsAt, title: s.title, body: s.notes,
      status: s.status === 'COMPLETED' ? '완료' : '예정',
      detail: s.scheduleType === 'MEDICATION' ? '복약 일정' : '건강 일정',
      route: s.scheduleType === 'MEDICATION' ? 'meds' : 'calendar', routeLabel: '일정 관리 열기', label: '예정 시각',
    })),
  ].map(row => ({ ...row, day: localDay(row.date) }));
  return rows.filter(row => row.day.startsWith(month)).sort((a, b) =>
    b.day.localeCompare(a.day) || new Date(b.date).getTime() - new Date(a.date).getTime() || a.id.localeCompare(b.id));
}
