import test from 'node:test';
import assert from 'node:assert/strict';
import { growthAxis, growthPosition, growthRange, stamp } from './growth.js';
test('month uses daily ticks in a fixed-width chart',()=>{
 const r=growthRange(1,'2026-11-16'); const a=growthAxis(r,1);
 assert.equal(a.unit,'day'); assert.equal(a.ticks.length,32);
 assert.ok(a.ticks.slice(1).every((t,i)=>stamp(t)-stamp(a.ticks[i])===86400000));
 assert.equal(a.plotWidth,276);
 assert.equal(a.labelDates[0],r.from); assert.equal(a.labelDates.at(-1),r.to);
 assert.ok(a.labelDates.length<=6);
 assert.ok(a.labelDates.slice(1).every((t,i)=>growthPosition(t,r)-growthPosition(a.labelDates[i],r)>=.19));
});
test('six months uses weekly ticks; one year uses calendar months',()=>{
 const weeks=growthAxis(growthRange(6,'2026-11-16'),6);
 assert.equal(weeks.unit,'week');assert.ok(weeks.ticks.slice(1).every((t,i)=>stamp(t)-stamp(weeks.ticks[i])===7*86400000));
 const months=growthAxis(growthRange(12,'2026-11-16'),12);
 assert.equal(months.unit,'month');assert.equal(months.ticks.length,13);assert.equal(months.ticks[1],'2025-12-16');
});
test('month-end ticks clamp correctly and all-history adapts to duration',()=>{
 const a=growthAxis({from:'2024-01-31',to:'2024-04-30'},12);
 assert.deepEqual(a.ticks,['2024-01-31','2024-02-29','2024-03-31','2024-04-30']);
 assert.equal(growthAxis({from:'2026-11-15',to:'2026-11-16'},0).unit,'day');
});
import { growthGroups } from './growth.js';
test('groups calendar weeks and months using the last available metric without changing source rows',()=>{
 const rows=[{id:'c',measuredOn:'2026-11-16',heightCm:null,weightKg:12},{id:'b',measuredOn:'2026-11-15',heightCm:85,weightKg:11.9},{id:'a',measuredOn:'2026-11-14',heightCm:84},{id:'old',measuredOn:'2026-09-15',heightCm:83}];
 const original=JSON.stringify(rows), range={from:'2026-05-16',to:'2026-11-16'};
 const weeks=growthGroups(rows,'heightCm',range,'week');
 assert.equal(weeks.length,2);assert.equal(weeks[1].from,'2026-11-09');assert.equal(weeks[1].representative.id,'b');assert.equal(weeks[1].records.length,2);
 assert.equal(growthGroups(rows,'weightKg',range,'week').length,2);
 const months=growthGroups(rows,'heightCm',range,'month');
 assert.equal(months.length,2);assert.equal(months[1].representative.id,'b');
 assert.equal(JSON.stringify(rows),original);
 assert.equal(growthGroups(rows,'heightCm',range,'day').length,3);
});
test('group details exclude records outside the filter and handle year boundaries',()=>{
 const rows=[{id:'a',measuredOn:'2025-12-29',heightCm:80},{id:'b',measuredOn:'2026-01-01',heightCm:81},{id:'c',measuredOn:'2026-01-04',heightCm:82}];
 const groups=growthGroups(rows,'heightCm',{from:'2026-01-01',to:'2026-01-03'},'week');
 assert.equal(groups.length,1);assert.deepEqual(groups[0].records.map(r=>r.id),['b']);
 assert.equal(groups[0].from,'2026-01-01');assert.equal(groups[0].to,'2026-01-03');
});

test('axis label intervals stay uniform through the final cell',()=>{
 for(const months of [1,6,12,0]) {
  const range=growthRange(months,'2026-11-16',[{measuredOn:'2026-09-15'}]);
  const labels=growthAxis(range,months).labelDates;
  const gaps=labels.slice(1).map((date,i)=>(stamp(date)-stamp(labels[i]))/86400000);
  assert.ok(Math.max(...gaps)-Math.min(...gaps)<=1);
  assert.equal(labels[0],range.from);assert.equal(labels.at(-1),range.to);
 }
});
