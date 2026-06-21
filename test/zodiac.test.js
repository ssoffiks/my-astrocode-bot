import test from 'node:test';
import assert from 'node:assert/strict';
import { getZodiacByDate, getZodiacFromIso } from '../src/astro/zodiac.js';

test('detects zodiac signs', () => {
  assert.equal(getZodiacByDate(8, 14), 'Лев');
  assert.equal(getZodiacByDate(2, 3), 'Водолей');
  assert.equal(getZodiacByDate(12, 25), 'Козерог');
  assert.equal(getZodiacFromIso('1997-03-21'), 'Овен');
});
