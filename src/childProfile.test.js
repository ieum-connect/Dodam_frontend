import test from 'node:test';
import assert from 'node:assert/strict';
import { childAgeInMonths, childProfileEmoji } from './childProfile.js';

const today = new Date(2026, 10, 18);

test('children younger than two use the baby profile regardless of gender', () => {
  assert.equal(childProfileEmoji({ birthDate: '2025-04-18', gender: 'FEMALE' }, today), '👶🏻');
  assert.equal(childProfileEmoji({ birthDate: '2024-11-19', gender: 'MALE' }, today), '👶🏻');
});

test('children age two and older use a gender-specific profile', () => {
  assert.equal(childProfileEmoji({ birthDate: '2024-11-18', gender: 'MALE' }, today), '👦🏻');
  assert.equal(childProfileEmoji({ birthDate: '2022-11-18', gender: 'FEMALE' }, today), '👧🏻');
});

test('unknown gender uses a neutral child profile instead of guessing', () => {
  assert.equal(childProfileEmoji({ birthDate: '2020-01-01' }, today), '🧒🏻');
  assert.equal(childProfileEmoji({}, today), '🧒🏻');
});

test('age calculation accounts for the day of month', () => {
  assert.equal(childAgeInMonths('2024-11-18', today), 24);
  assert.equal(childAgeInMonths('2024-11-19', today), 23);
});
