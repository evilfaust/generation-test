import { InlineMath, BlockMath } from 'react-katex';

/**
 * Универсальный компонент для рендеринга текста с LaTeX формулами
 * Поддерживает inline формулы $...$ и блочные формулы $$...$$
 */
const MathRenderer = ({ text, inline = true }) => {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  
  // Сначала ищем блочные формулы $$...$$
  const blockRegex = /\$\$([^$]+)\$\$/g;
  let blockMatch;
  const blockMatches = [];

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    blockMatches.push({
      start: blockMatch.index,
      end: blockMatch.index + blockMatch[0].length,
      content: blockMatch[1],
      type: 'block'
    });
  }

  // Затем ищем inline формулы $...$, исключая блочные
  const inlineRegex = /\$([^$]+)\$/g;
  let inlineMatch;
  const inlineMatches = [];

  while ((inlineMatch = inlineRegex.exec(text)) !== null) {
    // Проверяем, не находится ли эта формула внутри блочной
    const isInsideBlock = blockMatches.some(
      block => inlineMatch.index >= block.start && inlineMatch.index < block.end
    );
    
    if (!isInsideBlock) {
      inlineMatches.push({
        start: inlineMatch.index,
        end: inlineMatch.index + inlineMatch[0].length,
        content: inlineMatch[1],
        type: 'inline'
      });
    }
  }

  // Объединяем и сортируем все совпадения
  const allMatches = [...blockMatches, ...inlineMatches].sort((a, b) => a.start - b.start);

  // Строим итоговый массив элементов
  allMatches.forEach((match, index) => {
    // Добавляем текст до формулы
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }

    // Добавляем формулу
    if (match.type === 'block') {
      parts.push(
        <div key={`block-${index}`} style={{ margin: '10px 0' }}>
          <BlockMath math={match.content} />
        </div>
      );
    } else {
      parts.push(
        <InlineMath key={`inline-${index}`} math={match.content} />
      );
    }

    lastIndex = match.end;
  });

  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Если ничего не нашли, возвращаем исходный текст
  return parts.length > 0 ? <>{parts}</> : text;
};

export default MathRenderer;