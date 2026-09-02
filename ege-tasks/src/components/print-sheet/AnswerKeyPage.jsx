import MathRenderer from '../MathRenderer';

/** Лист ответов для учителя — общий для всех вариантов, всегда последним. */
export default function AnswerKeyPage({ variants, variantLabel, meta, brand, pageNumber, showFooter }) {
  return (
    <section className="ps-page ps-page--key">
      <div className="ps-runhead">
        <span>{meta.title}{meta.classLabel ? ` · ${meta.classLabel}` : ''}</span>
        <span>Для учителя</span>
      </div>

      <div className="ps-body">
        <h2 className="ps-key-title">Ответы</h2>
        {variants.map(v => (
          <div className="ps-key-block" key={v.number}>
            <div className="ps-key-variant">{variantLabel} {v.number}</div>
            <div className="ps-key-grid">
              {(v.tasks || []).map((t, i) => (
                <div className="ps-key-cell" key={t.id || i}>
                  <span className="ps-key-num">{i + 1}</span>
                  <span className="ps-key-answer">
                    {t.answer ? <MathRenderer text={t.answer} /> : <span className="ps-key-dash">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showFooter && (
        <div className="ps-foot">
          <span>{meta.footerNote || brand}</span>
          <span>{pageNumber}</span>
        </div>
      )}
    </section>
  );
}
