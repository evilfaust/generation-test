import { Segmented, Button } from 'antd';
import { FileTextOutlined, AppstoreOutlined, FolderOpenOutlined } from '@ant-design/icons';

const OUTPUT_OPTIONS = [
  {
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
        <FileTextOutlined />
        Лист задач
      </span>
    ),
    value: 'sheet',
  },
  {
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
        <AppstoreOutlined />
        Карточки
      </span>
    ),
    value: 'cards',
  },
];

export default function GeneratorHeader({ outputMode, setOutputMode, onOpenLoad }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      <Segmented
        size="large"
        value={outputMode}
        onChange={setOutputMode}
        options={OUTPUT_OPTIONS}
      />
      <Button icon={<FolderOpenOutlined />} onClick={onOpenLoad}>
        Мои работы
      </Button>
    </div>
  );
}
