import test from 'node:test';
import assert from 'node:assert/strict';
import { ageGroupLabel, buildRecordGroups, CHECKED_LABEL } from './recordGroups.js';

// 합성 데이터: 생후 1개월 아이(asOf 2026-11-17), DTaP 1차를 미리 체크한 경우.
const birthDate = '2026-10-17';
const dtap1Done = { doseId: 'DTAP-1', vaccineId: 'DTAP', name: 'DTaP', label: '1차', state: 'DONE', recFrom: '2026-12-17' };
const hepb2Now = { doseId: 'HEPB-2', vaccineId: 'HEPB', name: 'B형간염', label: '2차', recFrom: '2026-11-17', recTo: '2026-12-16' };

test('DONE dose with a future recFrom stays in its age group so it can be unchecked', () => {
  const groups = buildRecordGroups({ now: [hepb2Now], past: [], done: [dtap1Done], birthDate });
  const group = groups.find((g) => g.doses.some((d) => d.doseId === 'DTAP-1'));
  assert.ok(group);
  assert.equal(group.label, '2개월');
  assert.deepEqual(groups.map((g) => g.label), ['1개월', '2개월']);
});

test('future group holding only DONE doses is fully checked, so it collapses', () => {
  const groups = buildRecordGroups({ now: [hepb2Now], past: [], done: [dtap1Done], birthDate });
  const future = groups.find((g) => g.label === '2개월');
  assert.ok(future.doses.length > 0);
  assert.ok(future.doses.every((d) => d.state === 'DONE'));
});

test('DONE dose without recFrom goes to the checked group at the end', () => {
  const noDate = { doseId: 'BCG-1', vaccineId: 'BCG', name: 'BCG', label: '1차', state: 'DONE' };
  const groups = buildRecordGroups({ now: [hepb2Now], past: [], done: [noDate], birthDate });
  const last = groups.at(-1);
  assert.equal(last.label, CHECKED_LABEL);
  assert.deepEqual(last.doses.map((d) => d.doseId), ['BCG-1']);
});

test('age group labels', () => {
  assert.equal(ageGroupLabel(0), '출생 시');
  assert.equal(ageGroupLabel(18), '18개월');
  assert.equal(ageGroupLabel(24), '만 2세');
  assert.equal(ageGroupLabel(48), '만 4세');
});
