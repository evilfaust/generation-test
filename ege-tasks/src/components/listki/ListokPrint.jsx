import { useEffect, useState } from 'react';
import { Button, Checkbox, Segmented, Space } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import './listki.css';

// Печать листка как раздатки. Канон проекта: scoped print `body:has(.listok-print-root)`,
// корень position:absolute, @page инжектируется динамически перед window.print().
export default function ListokPrint({ sheet, problems, onBack }) {
  const [withTheory, setWithTheory] = useState(sheet.kind === 'official');
  const [cols, setCols] = useState(1);
  const [size, setSize] = useState('M');

  // постоянное @page для предсказуемых полей (как в OGE/КИМ-печати)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 12mm 14mm; }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const doPrint = () => window.print();

  return (
    <div className="listok-print-overlay">
      <div className="listok-print-controls">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
        <div style={{ flex: 1 }} />
        <Space>
          {sheet.intro_md?.trim() && (
            <Checkbox checked={withTheory} onChange={(e) => setWithTheory(e.target.checked)}>Теория</Checkbox>
          )}
          <Segmented value={cols} onChange={setCols} options={[{ label: '1 колонка', value: 1 }, { label: '2 колонки', value: 2 }]} />
          <Segmented value={size} onChange={setSize} options={['S', 'M', 'L']} />
          <Button type="primary" icon={<PrinterOutlined />} onClick={doPrint}>Печать</Button>
        </Space>
      </div>

      <div className={`listok-print-root listok-size-${size}`}>
        <h1 className="lp-title">{sheet.title}</h1>
        {sheet.kind === 'official' && <div className="lp-author">Р. К. Гордин · математическая школа №57</div>}

        {withTheory && sheet.intro_md?.trim() && (
          <div className="lp-theory listok-md"><MathRenderer content={sheet.intro_md} /></div>
        )}

        <ol className={`lp-problems lp-cols-${cols}`}>
          {problems.map((p) => p.type === 'heading' ? (
            <li key={p.id} className="lp-heading"><b>{p.heading_text}</b></li>
          ) : (
            <li key={p.id} className="lp-problem">
              <span className="lp-num">
                {p.num || '•'}
                {p.flag === 'basic' && <span className="lp-flag">°</span>}
                {p.flag === 'hard' && <span className="lp-flag">∗</span>}
              </span>
              <span className="lp-body listok-md"><MathRenderer content={p.statement} /></span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
