import { api } from './api';

// Visit records have dates, not times. Keep them separate from timed schedules.
export async function calendarVisits(patientId) {
  const visits = [];
  const seen = new Set();
  let cursor;
  do {
    const page = await api.visits(patientId, cursor);
    visits.push(...(page.items || []));
    if (!page.hasNext) break;
    if (!page.nextCursor || seen.has(page.nextCursor)) throw new Error('방문 기록을 끝까지 불러오지 못했어요.');
    cursor = page.nextCursor;
    seen.add(cursor);
  } while (cursor);
  return visits.filter(v => v.visitStatus !== 'CANCELED');
}
export const visitLabel = visit => visit.visitStatus === 'DONE' ? '방문 완료' : '방문 예약';
