import test from 'node:test';
import assert from 'node:assert/strict';
import { growthRange, growthPoints, growthPosition } from './growth.js';

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
