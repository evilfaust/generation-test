import { Card, Form, Space, Typography } from 'antd';
import MathRenderer from '../MathRenderer';
import LatexField from '../shared/LatexField';

const { Text } = Typography;

export default function TabSolution({ fieldMode = 'plain', previewSolution, onSolutionChange }) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <Form.Item
        name="solution_md"
        label="Подробное решение (Markdown + LaTeX)"
      >
        <LatexField
          mode={fieldMode}
          rows={10}
          placeholder={
            'Пример:\n\nПо теореме о средней линии треугольника $KL \\parallel MN$ и $KL = \\dfrac{MN}{2}$.\n\nЗначит $MN - KL = MN - \\dfrac{MN}{2} = \\dfrac{MN}{2} = 6$.\n\nОтсюда $MN = 12$.'
          }
          onTextChange={onSolutionChange}
        />
      </Form.Item>

      {previewSolution && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр решения</Text>}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <MathRenderer text={previewSolution} />
        </Card>
      )}
    </Space>
  );
}
