import type { ContentMetrics } from './types.js';

const syllables = (word: string) => {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return cleaned ? 1 : 0;
  const withoutSilentEnding = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/i, '').replace(/^y/, '');
  return Math.max(1, withoutSilentEnding.match(/[aeiouy]{1,2}/g)?.length ?? 1);
};

export function measureReadability(text: string, html: string, paragraphCount: number): ContentMetrics {
  const words = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).map(value => value.trim()).filter(Boolean);
  const wordCount = words.length, sentenceCount = sentences.length;
  const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
  const averageWordsPerSentence = sentenceCount ? wordCount / sentenceCount : 0;
  const readingEase = wordCount && sentenceCount ? 206.835 - 1.015 * averageWordsPerSentence - 84.6 * (syllableCount / wordCount) : null;
  const grade = wordCount && sentenceCount ? 0.39 * averageWordsPerSentence + 11.8 * (syllableCount / wordCount) - 15.59 : null;
  return {
    wordCount, sentenceCount, paragraphCount,
    averageWordsPerSentence: Number(averageWordsPerSentence.toFixed(1)),
    fleschReadingEase: readingEase === null ? null : Number(Math.max(0, Math.min(100, readingEase)).toFixed(1)),
    fleschKincaidGrade: grade === null ? null : Number(Math.max(0, grade).toFixed(1)),
    readingTimeMinutes: Number((wordCount / 225).toFixed(1)),
    textToHtmlRatio: html.length ? Number(((text.length / html.length) * 100).toFixed(1)) : 0
  };
}
