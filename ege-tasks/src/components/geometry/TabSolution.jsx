import { Card, Divider, Form, Space, Typography } from 'antd';
import MathRenderer from '../MathRenderer';
import LatexField from '../shared/LatexField';
import SolutionAttachments from './SolutionAttachments';

const { Text } = Typography;

export default function TabSolution({
  fieldMode = 'plain', previewSolution, onSolutionChange,
  solutionFiles = [], onSolutionFilesChange,
}) {
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

      <Divider style={{ margin: 0 }} orientation="left" plain>
        <Text type="secondary" style={{ fontSize: 12 }}>Вложения (фото решения)</Text>
      </Divider>
      <SolutionAttachments files={solutionFiles} onChange={onSolutionFilesChange} />

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
