import test from 'node:test';
import assert from 'node:assert/strict';
import { measureReadability } from '../src/readability.js';

test('calculates content and readability measurements', () => {
  const text = 'This is a short sentence. This is another clear sentence for readers.';
  const result = measureReadability(text, `<p>${text}</p>`, 1);
  assert.equal(result.wordCount, 12);
  assert.equal(result.sentenceCount, 2);
  assert.equal(result.paragraphCount, 1);
  assert.ok(result.fleschKincaidGrade !== null);
  assert.ok(result.fleschReadingEase !== null);
  assert.ok(result.textToHtmlRatio > 0);
});
