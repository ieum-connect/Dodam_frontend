import test from 'node:test';
import assert from 'node:assert/strict';
import { growthAverageByAge, growthAverageComparison, growthAverageSegments } from './growthReference.js';

test('uses published arithmetic means for both sexes and metrics, not the old P50', () => {
  assert.deepEqual(growthAverageByAge('heightCm','MALE','2024-11-16','2026-11-15'),{mean:86.43,groupLabel:'18~24개월',year:2024});
  assert.equal(growthAverageByAge('heightCm','FEMALE','2024-11-16','2026-11-15').mean,85.09);
  assert.equal(growthAverageByAge('weightKg','MALE','2024-11-16','2026-11-15').mean,12.47);
  assert.equal(growthAverageByAge('weightKg','FEMALE','2024-11-16','2026-11-15').mean,11.86);
});
test('newborn band is 14–35 elapsed days inclusive', () => {
  const avg = day => growthAverageByAge('weightKg','MALE','2026-01-01',day);
  assert.equal(avg('2026-01-14'),null);
  assert.equal(avg('2026-01-15').mean,4.71);
  assert.equal(avg('2026-02-05').mean,4.71);
  assert.equal(avg('2026-02-06'),null);
});
test('never substitutes medians or extrapolates into unsupported ages or invalid inputs', () => {
  for (const day of ['2026-03-01','2026-08-01','2027-03-01','2032-01-01','2025-12-31','2026-02-30'])
    assert.equal(growthAverageByAge('heightCm','MALE','2026-01-01',day),null);
  assert.equal(growthAverageByAge('heightCm',null,'2026-01-01','2026-05-01'),null);
});
test('month-end age boundaries clamp and include the last full month', () => {
  assert.equal(growthAverageByAge('heightCm','MALE','2024-08-31','2025-02-28').groupLabel,'4~6개월');
  assert.equal(growthAverageByAge('heightCm','MALE','2024-08-31','2025-03-30').groupLabel,'4~6개월');
  assert.equal(growthAverageByAge('heightCm','MALE','2024-08-31','2025-03-31'),null);
});
test('estimated trend connects all bands continuously without extrapolation', () => {
  for (const metric of ['heightCm','weightKg']) for (const gender of ['MALE','FEMALE']) {
    const segments=growthAverageSegments(metric,gender,'2024-01-01',{from:'2023-01-01',to:'2032-01-01'});
    assert.equal(segments[0].from,'2024-01-15');
    assert.equal(segments.at(-1).to,'2029-12-31');
    for(let i=1;i<segments.length;i++) {
      assert.equal(segments[i-1].to,segments[i].from);
      assert.equal(segments[i-1].toMean,segments[i].fromMean);
    }
    assert.ok(segments.some(s=>s.toMean>s.fromMean));
  }
});
test('clipping a period keeps the same interpolated value at a shared date', () => {
  const series=range=>growthAverageSegments('heightCm','MALE','2024-01-01',range);
  const broad=series({from:'2024-01-01',to:'2025-01-01'});
  const narrow=series({from:'2024-08-01',to:'2024-08-31'});
  const at=Date.parse('2024-08-01');
  const segment=broad.find(s=>Date.parse(s.from)<=at&&Date.parse(s.to)>=at);
  const expected=segment.fromMean+(segment.toMean-segment.fromMean)*(at-Date.parse(segment.from))/(Date.parse(segment.to)-Date.parse(segment.from));
  assert.ok(Math.abs(narrow[0].fromMean-expected)<1e-10);
  assert.equal(narrow[0].from,'2024-08-01');
  assert.equal(narrow.at(-1).to,'2024-08-31');
  assert.deepEqual(series({from:'2032-01-01',to:'2033-01-01'}),[]);
});

test('comparison consistently uses the graph estimate, including published bands', () => {
  const args=['heightCm','MALE','2024-11-16'];
  const value=growthAverageComparison(...args,'2026-01-15');
  assert.equal(value.estimated,true);
  const segment=growthAverageSegments(...args,{from:'2026-01-15',to:'2026-01-16'})[0];
  assert.equal(value.mean,segment.fromMean);
  assert.ok(value.mean>75.91 && value.mean<86.43);
  const inside=growthAverageComparison(...args,'2026-11-15');
  assert.equal(inside.estimated,true);
  assert.equal(inside.mean,growthAverageSegments(...args,{from:'2026-11-15',to:'2026-11-16'})[0].fromMean);
  for(const date of ['2024-11-17','2035-01-01','invalid']) assert.equal(growthAverageComparison(...args,date),null);
  assert.equal(growthAverageComparison('heightCm',null,'2024-11-16','2026-01-15'),null);
});
