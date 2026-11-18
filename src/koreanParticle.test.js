import test from 'node:test';
import assert from 'node:assert/strict';
import { waOrGwa } from './koreanParticle.js';

test('selects the conjunction for Korean child names with and without a final consonant', () => {
  for (const [name, expected] of [['이하린', '과'], ['하늘', '과'], ['도담이', '와'], ['민지', '와']]) {
    assert.equal(waOrGwa(name), expected);
  }
});

test('normalizes decomposed Hangul and surrounding whitespace', () => {
  assert.equal(waOrGwa(' 이하린 '.normalize('NFD')), '과');
  assert.equal(waOrGwa(null), '와');
});
