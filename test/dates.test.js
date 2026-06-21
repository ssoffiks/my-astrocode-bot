import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthDate, parseBirthTime } from '../src/utils/dates.js';

test('parseBirthDate accepts DD.MM.YYYY', () => {
  const parsed = parseBirthDate('14.08.1997');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.iso, '1997-08-14');
  assert.equal(parsed.value.display, '14.08.1997');
});

test('parseBirthDate rejects impossible dates', () => {
  const parsed = parseBirthDate('31.02.1997');
  assert.equal(parsed.ok, false);
});

test('parseBirthTime accepts HH:MM', () => {
  const parsed = parseBirthTime('8:45');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value, '08:45');
});

test('parseBirthTime rejects invalid time', () => {
  const parsed = parseBirthTime('25:99');
  assert.equal(parsed.ok, false);
});
