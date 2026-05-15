import { Collapse, Row, Col, Form, Radio, Switch, Select } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import FormatSettings from '../FormatSettings';

const { Option } = Select;

export default function AppearanceSection({
  outputMode,
  // sheet props
  sheetFormat,
  setSheetFormat,
  columns,
  setColumns,
  fontSize,
  setFontSize,
  solutionSpace,
  setSolutionSpace,
  compactMode,
  setCompactMode,
  hideTaskPrefixes,
  setHideTaskPrefixes,
  showStudentInfo,
  setShowStudentInfo,
  showAnswersInline,
  setShowAnswersInline,
  showAnswersPage,
  setShowAnswersPage,
  variantLabel,
  setVariantLabel,
  cryptogramEnabled,
  setCryptogramEnabled,
  cryptogramPhrase,
  setCryptogramPhrase,
  tasksCount,
  // cards props
  cardFormat,
  setCardFormat,
  showCardAnswers,
  setShowCardAnswers,
  showCardSolutions,
  setShowCardSolutions,
  showCardStudentInfo,
  setShowCardStudentInfo,
}) {
  const sheetBody = (
    <>
      <FormatSettings
        columns={columns}
        setColumns={setColumns}
        fontSize={fontSize}
        setFontSize={setFontSize}
        solutionSpace={solutionSpace}
        setSolutionSpace={setSolutionSpace}
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        hideTaskPrefixes={hideTaskPrefixes}
        setHideTaskPrefixes={setHideTaskPrefixes}
        showStudentInfo={showStudentInfo}
        setShowStudentInfo={setShowStudentInfo}
        showAnswersInline={showAnswersInline}
        setShowAnswersInline={setShowAnswersInline}
        showAnswersPage={showAnswersPage}
        setShowAnswersPage={setShowAnswersPage}
        variantLabel={variantLabel}
        setVariantLabel={setVariantLabel}
        cryptogramEnabled={cryptogramEnabled}
        setCryptogramEnabled={setCryptogramEnabled}
        cryptogramPhrase={cryptogramPhrase}
        setCryptogramPhrase={setCryptogramPhrase}
        tasksCount={tasksCount}
      />

      <Row gutter={16} style={{ marginTop: 8 }}>
        <Col xs={24} md={8}>
          <Form.Item label="Формат листа" style={{ marginBottom: 0 }}>
            <Radio.Group
              value={sheetFormat}
              onChange={(e) => setSheetFormat(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="A4">A4</Radio.Button>
              <Radio.Button value="A5">A5</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const cardsBody = (
    <Row gutter={16}>
      <Col xs={24} md={6}>
        <Form.Item label="Формат карточек">
          <Select value={cardFormat} onChange={setCardFormat}>
            <Option value="А6">A6</Option>
            <Option value="А5">A5</Option>
            <Option value="А4">A4</Option>
          </Select>
        </Form.Item>
      </Col>

      <Col xs={24} md={6}>
        <Form.Item label="Показать ответы">
          <Switch checked={showCardAnswers} onChange={setShowCardAnswers} />
        </Form.Item>
      </Col>

      <Col xs={24} md={6}>
        <Form.Item label="Показать решения">
          <Switch checked={showCardSolutions} onChange={setShowCardSolutions} />
        </Form.Item>
      </Col>

      <Col xs={24} md={6}>
        <Form.Item label="Поля для ФИО">
          <Switch checked={showCardStudentInfo} onChange={setShowCardStudentInfo} />
        </Form.Item>
      </Col>
    </Row>
  );

  return (
    <Collapse
      items={[
        {
          key: 'appearance',
          label: (
            <span style={{ fontWeight: 500 }}>
              <BgColorsOutlined /> Оформление
              <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>
                {outputMode === 'sheet' ? 'для листа задач' : 'для карточек'}
              </span>
            </span>
          ),
          children: outputMode === 'sheet' ? sheetBody : cardsBody,
        },
      ]}
      style={{ marginBottom: 16, background: '#fafafa' }}
    />
  );
}
