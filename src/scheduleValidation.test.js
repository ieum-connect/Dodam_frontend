import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleValidation } from './scheduleValidation.js';

test('past daily prescriptions accept inclusive end dates', () => {
  assert.equal(scheduleValidation('2026-11-15T08:00', {repeatMode:'DAILY', endDate:'2026-11-17'}, true), '');
  assert.equal(scheduleValidation('2026-11-17T08:00', {repeatMode:'DAILY', endDate:'2026-11-17'}, true), '');
  assert.equal(scheduleValidation('2026-11-15T08:00', {repeatMode:'DAILY'}), '');
});
test('invalid dates cannot reach ISO conversion', () => {
  for (const value of ['', '2026-11-15', '2026-02-30T08:00', '2026-11-15T25:00', '0000-01-01T08:00']) {
    assert.notEqual(scheduleValidation(value), '');
  }
});
test('repeat errors distinguish missing end, reverse dates and missing weekdays', () => {
  assert.match(scheduleValidation('2026-11-15T08:00', {repeatMode:'DAILY'}, true), /마지막 날짜/);
  assert.match(scheduleValidation('2026-11-15T08:00', {repeatMode:'DAILY',endDate:'2026-11-14'}, true), /시작일/);
  assert.match(scheduleValidation('2026-11-15T08:00', {repeatMode:'WEEKLY',weekdayMask:0}, true), /요일/);
  assert.match(scheduleValidation('2026-11-15T08:00', {repeatMode:'WEEKLY',weekdayMask:1,endDate:'2026-11-15'}, true), /기간/);
  assert.equal(scheduleValidation('2026-11-15T08:00', {repeatMode:'WEEKLY',weekdayMask:1,endDate:'2026-11-16'}, true), '');
});
