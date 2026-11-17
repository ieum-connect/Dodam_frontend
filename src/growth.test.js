import test from 'node:test';
import assert from 'node:assert/strict';
import { growthRange, growthPoints, growthLinePoints, growthPosition, newestGrowthFirst } from './growth.js';

test('incoming line is clipped at the period boundary without adding a measurement', () => {
  const rows = [
    { id: 'new', measuredOn: '2026-11-11', heightCm: 90 },
    { id: 'old', measuredOn: '2026-11-01', heightCm: 80 },
    { id: 'older', measuredOn: '2026-10-01', heightCm: 60 },
  ];
  const before = structuredClone(rows);
  const range = { from: '2026-11-06', to: '2026-11-17' };
  const line = growthLinePoints(rows, 'heightCm', range);
  assert.deepEqual(line[0], { measuredOn: '2026-11-06', heightCm: 85 });
  assert.equal(line[1].id, 'new');
  assert.equal(growthPoints(rows, 'heightCm', range).length, 1);
  assert.deepEqual(rows, before);
});

test('incoming line uses the previous measurement of the selected metric', () => {
  const rows = [
    { measuredOn: '2026-11-01', weightKg: 10 },
    { measuredOn: '2026-11-05', heightCm: 80 },
    { measuredOn: '2026-11-11', weightKg: 12 },
  ];
  assert.equal(growthLinePoints(rows, 'weightKg', { from: '2026-11-06', to: '2026-11-17' })[0].weightKg, 11);
});

test('line never extrapolates before the first or after the last measurement', () => {
  const rows = [{ measuredOn: '2026-11-05', heightCm: 80 }, { measuredOn: '2026-11-11', heightCm: 85 }];
  for (const from of ['2026-11-01', '2026-11-05']) {
    assert.deepEqual(growthLinePoints(rows, 'heightCm', { from, to: '2026-11-17' }), rows);
  }
  assert.deepEqual(growthLinePoints(rows, 'heightCm', { from: '2026-11-12', to: '2026-11-17' }), []);
});

test('same measurements occupy different positions for 3, 6 and 12 months', () => {
  const ranges = [3, 6, 12].map(months => growthRange(months, '2026-11-07'));
  assert.deepEqual(ranges.map(range => range.from), ['2026-08-07', '2026-05-07', '2025-11-07']);
  const positions = ranges.map(range => growthPosition('2026-09-07', range));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  ranges.forEach(range => assert.equal(growthPosition('2026-11-07', range), 1));
});

test('month-end ranges clamp to the target month including leap years', () => {
  assert.equal(growthRange(3, '2026-05-31').from, '2026-02-28');
  assert.equal(growthRange(3, '2024-05-31').from, '2024-02-29');
});

test('chart excludes out-of-range and missing metrics and preserves boundary dates', () => {
  const rows = [
    { measuredOn: '2026-11-08', heightCm: 90 },
    { measuredOn: '2026-11-07', heightCm: 87 },
    { measuredOn: '2026-08-06', heightCm: 82 },
    { measuredOn: '2026-09-01', weightKg: 12 },
    { measuredOn: '2026-08-07', heightCm: 83 },
  ];
  assert.deepEqual(growthPoints(rows, 'heightCm', growthRange(3, '2026-11-07')).map(row => row.heightCm), [83, 87]);
});

test('single-day or empty all-history ranges never divide by zero', () => {
  const range = growthRange(0, '2026-11-07', [{ measuredOn: '2026-11-07' }]);
  assert.equal(growthPosition('2026-11-07', range), 1);
  assert.ok(Number.isFinite(growthPosition('2026-11-07', growthRange(0, '2026-11-07'))));
});

test('all history includes the previous year even when records are recent or empty', () => {
  const end = '2026-11-17';
  for (const rows of [[], [{ measuredOn: end }], [{ measuredOn: '2026-11-02' }, { measuredOn: end }]]) {
    assert.deepEqual(growthRange(0, end, rows), { from: '2025-11-17', to: end });
  }
});

test('all history extends to older records without dropping any measurements', () => {
  const rows = [{ measuredOn: '2026-11-17', heightCm: 90 }, { measuredOn: '2024-02-29', heightCm: 60 }];
  const range = growthRange(0, '2026-11-17', rows);
  assert.deepEqual(range, { from: '2024-02-29', to: '2026-11-17' });
  assert.equal(growthPoints(rows, 'heightCm', range).length, 2);
  assert.equal(growthRange(0, '2024-02-29', []).from, '2023-02-28');
});

test('latest cards and history use newest dates regardless of API order', () => {
  const rows = [
    { measuredOn: '2026-09-01', heightCm: 80 },
    { measuredOn: '2026-11-01', weightKg: 12 },
    { measuredOn: '2026-10-01', heightCm: 85 },
  ];
  const sorted = newestGrowthFirst(rows);
  assert.deepEqual(sorted.map(r => r.measuredOn), ['2026-11-01', '2026-10-01', '2026-09-01']);
  assert.equal(sorted.filter(r => r.heightCm != null)[0].heightCm, 85);
  assert.equal(rows[0].measuredOn, '2026-09-01');
  assert.deepEqual(newestGrowthFirst([...rows].reverse()), sorted);
});
