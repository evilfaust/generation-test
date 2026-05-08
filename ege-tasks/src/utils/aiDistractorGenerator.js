import { buildOptions } from './distractorGenerator';

const DISTRACTORS_API = import.meta.env.VITE_DISTRACTORS_API_URL || 'https://l.oipav.ru/distractors';

/**
 * Строит варианты ответа с AI-дистракторами.
 * При ошибке — fallback на rule-based генерацию.
 * Возвращает [{text, is_correct, error_type?, explanation?}]
 */
export async function buildOptionsWithAI(correctAnswer, exprLatex, generatorType, count = 4) {
  const correct = (correctAnswer || '').split('|')[0].trim();

  try {
    const resp = await fetch(DISTRACTORS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correctAnswer: correct,
        exprLatex,
        generatorType,
        count: count - 1,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const distractors = data.distractors;

    if (!Array.isArray(distractors) || distractors.length === 0) {
      throw new Error('empty response');
    }

    const unique = distractors.filter(d => d.text && d.text.trim() !== correct);

    if (unique.length === 0) throw new Error('all distractors duplicate correct answer');

    // Если AI вернул меньше чем нужно — добиваем rule-based дистракторами
    const aiOptions = unique.slice(0, count - 1).map(d => ({
      text: d.text,
      is_correct: false,
      error_type: d.error_type || '',
      explanation: d.explanation || '',
    }));

    if (aiOptions.length < count - 1) {
      const fallback = buildOptions(correctAnswer, count);
      const extra = fallback
        .filter(o => !o.is_correct && o.text && o.text !== correct)
        .filter(o => !aiOptions.some(a => a.text === o.text))
        .slice(0, count - 1 - aiOptions.length);
      aiOptions.push(...extra);
    }

    return [{ text: correct, is_correct: true }, ...aiOptions];
  } catch (e) {
    console.warn('[aiDistractors] fallback to rule-based:', e.message);
    return buildOptions(correctAnswer, count);
  }
}
