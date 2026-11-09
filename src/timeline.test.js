import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, readTimelinePages } from './timeline.js';

test('uses the clinical visit date, upload date and memo date independently', () => {
  const rows = buildTimeline({
    visits: [{ visitId: 'v', visitedOn: '2026-11-01', createdAt: '2026-11-07', hospitalName: '소아과' }],
    documents: [{ documentId: 'd', visitId: 'v', visitedOn: '2026-11-01', createdAt: '2026-11-03T09:00:00+09:00' }],
    memos: [{ recordId: 'm', recordedAt: '2026-11-02T09:00:00+09:00', createdAt: '2026-11-07', body: '관찰 메모' }],
  }, '2026-11');
  assert.deepEqual(rows.map(r => r.id), ['document-d', 'memo-m', 'visit-v']);
  assert.equal(rows[0].body, '2026-11-01 · 소아과');
});

test('excludes cancelled schedules and out-of-month records; completion retains scheduled time label', () => {
  const rows = buildTimeline({ schedules: [
    { id: '1', startsAt: '2026-11-01T00:30:00+09:00', status: 'COMPLETED', scheduleType: 'MEDICATION' },
    { id: '2', startsAt: '2026-11-01', status: 'CANCELLED' },
    { id: '3', startsAt: '2026-10-01', status: 'SCHEDULED' },
  ] }, '2026-11');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].day, '2026-11-01');
  assert.equal(rows[0].status, '완료');
  assert.equal(rows[0].label, '예정 시각');
});

test('reads beyond the first page', async () => {
  const calls = [];
  const rows = await readTimelinePages(async cursor => {
    calls.push(cursor);
    return cursor ? { items: [2], nextCursor: null } : { items: [1], nextCursor: 'next' };
  });
  assert.deepEqual(rows, [1, 2]);
  assert.deepEqual(calls, [undefined, 'next']);
});

test('fails visibly for repeated cursors and stops cancelled pagination', async () => {
  await assert.rejects(readTimelinePages(async () => ({ items: [], nextCursor: 'same' })), /다음 기록/);
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(readTimelinePages(async () => { called = true; }, controller.signal), /취소/);
  assert.equal(called, false);
});
