import { Row, Col } from 'antd';
import VariantSimilarityWarning from './VariantSimilarityWarning';

/**
 * Блок статистики сгенерированных вариантов.
 *
 * @param {Array} variants - массив вариантов
 * @param {boolean} showAnswersPage - показывается ли лист ответов
 */
const VariantStats = ({
  variants = [],
  showAnswersPage = true,
}) => {
  if (variants.length === 0) return null;

  return (
    <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
      <Row gutter={16}>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              {variants.length}
            </div>
            <div style={{ color: '#666' }}>Вариант(ов)</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
              {variants[0]?.tasks.length || 0}
            </div>
            <div style={{ color: '#666' }}>Задач в варианте</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
              {variants.reduce((sum, v) => sum + v.tasks.length, 0)}
            </div>
            <div style={{ color: '#666' }}>Всего задач</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: showAnswersPage ? '#52c41a' : '#ff4d4f',
              }}
            >
              {showAnswersPage ? '\u2713' : '\u2717'}
            </div>
            <div style={{ color: '#666' }}>Лист ответов</div>
          </div>
        </Col>
      </Row>
      <VariantSimilarityWarning variants={variants} />
    </div>
  );
};

export default VariantStats;
