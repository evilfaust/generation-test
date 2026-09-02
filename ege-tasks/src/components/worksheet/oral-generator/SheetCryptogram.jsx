import MathRenderer from '../../MathRenderer';
import { buildCryptogramForVariant } from '../../../utils/cryptogram';

/**
 * Шифровка по ответам — хвостовой блок варианта на печатном листе.
 *
 * Экранная версия панели (VariantRenderer) цветная; здесь монохром, как и весь
 * лист. Блок участвует в пагинации наравне с задачами — если не влезает в
 * остаток страницы, уезжает на следующую целиком.
 */
export default function SheetCryptogram({ variant, phrase }) {
  const crypt = buildCryptogramForVariant({ variant, phrase });

  return (
    <section className="ps-crypt">
      <div className="ps-crypt-title">Шифровка по ответам</div>

      {crypt?.valid ? (
        <>
          <div className="ps-crypt-note">
            Решите задачи, найдите каждый ответ в таблице и запишите буквы по порядку.
          </div>

          <div className="ps-crypt-grid">
            {crypt.entries.map((entry, index) => (
              <div className="ps-crypt-cell" key={`${entry.letter}-${entry.answer}-${index}`}>
                <span className="ps-crypt-answer"><MathRenderer text={entry.answer} /></span>
                <span className="ps-crypt-letter">{entry.letter}</span>
              </div>
            ))}
          </div>

          <div className="ps-crypt-result">
            <div className="ps-crypt-result-label">Получившееся слово / фраза:</div>
            <div className="ps-crypt-cells">
              {crypt.answerCells.map((cell, index) => (
                cell.type === 'space'
                  ? <span key={`space-${index}`} className="ps-crypt-gap" />
                  : <span key={`cell-${index}`} className="ps-crypt-slot" />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="ps-crypt-warn">{crypt?.warnings?.join(' ')}</div>
      )}
    </section>
  );
}
