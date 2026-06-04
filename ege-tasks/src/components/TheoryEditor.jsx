import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Button, Select, Input, Modal, Spin, InputNumber, Radio, Tag, Space, Tooltip, Badge, App } from 'antd';
import {
  SaveOutlined, SettingOutlined,
  FormatPainterOutlined, ColumnWidthOutlined, FilePdfOutlined,
  ArrowLeftOutlined, TagsOutlined, CheckCircleOutlined, NodeIndexOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor, useKeyboardShortcuts, useDocumentStats, useAutosave, loadAutosave, useGeoGebraInjection } from '../hooks';
import { getPageDimensions, DEFAULT_SETTINGS, THEME_NAMES } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import EditorToolbar from './theory/EditorToolbar';
import GeoGebraBlocksModal from './theory/GeoGebraBlocksModal';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import './theory/TheoryGeoGebraEmbed.css';
import './theory/TheoryEditor.css';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const THEMES = [
  { id: 'classic', name: 'Классическая', description: 'Стандартное оформление с засечками' },
  { id: 'minimal', name: 'Минималистичная', description: 'Чистый и простой стиль' },
  { id: 'academic', name: 'Академическая', description: 'Для научных работ' },
  { id: 'notebook', name: 'Тетрадь', description: 'Как школьная тетрадь' },
  { id: 'compact', name: 'Компактная', description: 'Плотная вёрстка, мелкий шрифт' },
];

const DEFAULT_CONTENT = `# Заголовок статьи

Введите текст теоретического материала здесь.

## Подзаголовок

Поддерживается **жирный**, *курсив*, формулы: $E = mc^2$

Блочная формула:

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
`;

export default function TheoryEditor({ articleId = null, onBack, onSaved }) {
  const { message } = App.useApp();
  const { theoryCategories: categories, reloadData } = useReferenceData();
  const initialData = useMemo(() => {
    const { content, settings } = loadAutosave(articleId);
    return {
      content: content || DEFAULT_CONTENT,
      pageSettings: settings?.pageSettings || DEFAULT_SETTINGS,
      theme: settings?.currentTheme || 'classic',
      geogebraApplets: Array.isArray(settings?.geogebra_applets) ? settings.geogebra_applets : [],
    };
  }, [articleId]);

  const [markdown, setMarkdown] = useState(initialData.content);
  const [currentTheme, setCurrentTheme] = useState(initialData.theme);
  const [pageSettings, setPageSettings] = useState(initialData.pageSettings);
  const [geogebraApplets, setGeogebraApplets] = useState(initialData.geogebraApplets);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articleLoading, setArticleLoading] = useState(!!articleId);
  const [splitPos, setSplitPos] = useState(50);
  const [isGeoModalOpen, setIsGeoModalOpen] = useState(false);

  // Article metadata
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [articleTags, setArticleTags] = useState([]);
  const [summary, setSummary] = useState('');

  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const containerRef = useRef(null);

  // Process markdown
  const html = useMarkdownProcessor(markdown, pageSettings.columns);
  const stats = useDocumentStats(markdown);
  const autosaveExtraSettings = useMemo(
    () => ({ geogebra_applets: geogebraApplets }),
    [geogebraApplets],
  );

  // Autosave
  useAutosave(markdown, pageSettings, currentTheme, articleId, autosaveExtraSettings);

  // Load article if editing
  useEffect(() => {
    if (articleId) {
      loadArticle(articleId);
    }
  }, [articleId]);

  const loadArticle = async (id) => {
    setArticleLoading(true);
    try {
      const article = await api.getTheoryArticle(id);
      if (article) {
        setMarkdown(article.content_md || '');
        setTitle(article.title || '');
        setCategoryId(article.category || null);
        setArticleTags(article.tags || []);
        setSummary(article.summary || '');
        if (article.theme_settings) {
          if (article.theme_settings.pageSettings) {
            setPageSettings(article.theme_settings.pageSettings);
          }
          if (article.theme_settings.currentTheme) {
            setCurrentTheme(article.theme_settings.currentTheme);
          }
          if (Array.isArray(article.theme_settings.geogebra_applets)) {
            setGeogebraApplets(article.theme_settings.geogebra_applets);
          }
        }
      }
    } catch (error) {
      message.error('Ошибка при загрузке статьи');
    } finally {
      setArticleLoading(false);
    }
  };

  const insertGeoBlockAtCursor = useCallback((applet) => {
    const editor = editorRef.current;
    if (!editor || !applet?.id) return;
    const block = `\n:::geogebra ${applet.id}:::\n`;
    const selection = editor.getSelection();
    editor.executeEdits('geogebra', [{ range: selection, text: block }]);
    editor.focus();
  }, []);

  // Insert formula at cursor
  const insertFormula = useCallback((type) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (type === 'inline') {
      editor.executeEdits('', [{ range: selection, text: '$ $' }]);
      const pos = selection.getStartPosition();
      editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 2 });
    } else if (type === 'block') {
      editor.executeEdits('', [{ range: selection, text: '\n$$\n\n$$\n' }]);
      const pos = selection.getStartPosition();
      editor.setPosition({ lineNumber: pos.lineNumber + 2, column: 1 });
    }
    editor.focus();
  }, []);

  // Save article
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      message.warning('Введите название статьи');
      return;
    }
    if (!categoryId) {
      message.warning('Выберите категорию');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        content_md: markdown,
        category: categoryId,
        tags: articleTags,
        summary: summary.trim(),
        theme_settings: {
          pageSettings,
          currentTheme,
          geogebra_applets: geogebraApplets,
        },
      };
      if (articleId) {
        await api.updateTheoryArticle(articleId, data);
        message.success('Статья обновлена');
      } else {
        const created = await api.createTheoryArticle(data);
        message.success('Статья создана');
        onSaved?.(created.id);
      }
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }, [title, categoryId, markdown, articleTags, summary, pageSettings, currentTheme, geogebraApplets, articleId, onSaved, reloadData, message]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSave,
    onInsertInlineFormula: useCallback(() => insertFormula('inline'), [insertFormula]),
    onInsertBlockFormula: useCallback(() => insertFormula('block'), [insertFormula]),
  });

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    const filename = (title || 'theory-article').trim();
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
      const opt = {
        margin: 0,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: [dims.width, dims.height], orientation: pageSettings.orientation },
      };
      await html2pdf().set(opt).from(previewRef.current).save();
      message.success('PDF экспортирован');
    } catch (error) {
      console.error('PDF export error:', error);
      message.error('Ошибка при экспорте PDF');
    } finally {
      setIsExporting(false);
    }
  }, [title, pageSettings, message]);

  // Toggle columns
  const toggleColumns = useCallback(() => {
    setPageSettings(prev => ({ ...prev, columns: prev.columns === 1 ? 2 : 1 }));
  }, []);

  // Resize handler
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPos = splitPos;
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.offsetWidth;

    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newPos = Math.min(80, Math.max(20, startPos + (delta / containerWidth) * 100));
      setSplitPos(newPos);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitPos]);

  // Trigger Monaco layout on split change
  useEffect(() => {
    editorRef.current?.layout();
  }, [splitPos]);

  // Map applets by id for preview injection
  const geogebraAppletsById = useMemo(
    () => new Map(geogebraApplets.filter(a => a?.id).map(a => [a.id, a])),
    [geogebraApplets],
  );

  // Inject GeoGebra images into editor preview
  useGeoGebraInjection(previewRef, html, geogebraAppletsById);

  // Preview styles
  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    const base = {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.3',
      boxSizing: 'border-box',
    };
    if (pageSettings.columns > 1) {
      base.display = 'grid';
      base.gridTemplateColumns = `repeat(${pageSettings.columns}, 1fr)`;
      base.columnGap = '15px';
      base.alignContent = 'start';
    }
    return base;
  }, [pageSettings]);

  if (articleLoading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div className="theory-editor-container">
      {/* Meta toolbar */}
      <div className="theory-editor-meta-toolbar">
        <div className="toolbar-left">
          {onBack && (
            <Tooltip title="Назад">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
            </Tooltip>
          )}
          <Input
            placeholder="Название статьи"
            value={title}
            onChange={e => setTitle(e.target.value)}
            size="small"
            className="theory-title-input"
          />
          <Select
            placeholder="Категория"
            value={categoryId}
            onChange={setCategoryId}
            size="small"
            style={{ width: 160 }}
            options={categories.map(c => ({
              label: <Tag color={c.color} style={{ margin: 0 }}>{c.title}</Tag>,
              value: c.id,
            }))}
          />
          <Tooltip title={articleTags.length > 0 ? `Теги: ${articleTags.join(', ')}` : 'Теги'}>
            <Badge count={articleTags.length} size="small" offset={[-4, 0]}>
              <Button type="text" size="small" icon={<TagsOutlined />} onClick={() => setIsTagsModalOpen(true)} />
            </Badge>
          </Tooltip>
        </div>

        <div className="toolbar-right">
          <Tooltip title={pageSettings.columns > 1 ? '1 колонка' : '2 колонки'}>
            <Button
              type={pageSettings.columns > 1 ? 'primary' : 'text'}
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={toggleColumns}
            />
          </Tooltip>
          <Tooltip title="Настройки страницы">
            <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setIsSettingsModalOpen(true)} />
          </Tooltip>
          <Tooltip title="Тема оформления">
            <Button type="text" size="small" icon={<FormatPainterOutlined />} onClick={() => setIsThemeModalOpen(true)} />
          </Tooltip>
          <Tooltip title="GeoGebra-блоки">
            <Badge count={geogebraApplets.length} size="small" offset={[-4, 0]}>
              <Button type="text" size="small" icon={<NodeIndexOutlined />} onClick={() => setIsGeoModalOpen(true)} />
            </Badge>
          </Tooltip>
          <div className="toolbar-divider" />
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            className="theory-save-btn"
          >
            Сохранить
          </Button>
          <Tooltip title="Экспорт PDF">
            <Button
              type="text"
              size="small"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              loading={isExporting}
            />
          </Tooltip>
        </div>
      </div>

      {/* Formatting toolbar */}
      <EditorToolbar editorRef={editorRef} />

      {/* Editor + Preview */}
      <div className="theory-editor-body" ref={containerRef}>
        {/* Editor Panel */}
        <div className="theory-editor-panel editor-panel" style={{ width: `calc(${splitPos}% - 3px)` }}>
          <div className="panel-header">
            <span>Markdown + LaTeX</span>
            <span className="hint">Ctrl+I — inline, Ctrl+B — блочная формула</span>
          </div>
          <Suspense fallback={<div className="theory-editor-loading">Загрузка редактора...</div>}>
            <MonacoEditor
              height="100%"
              defaultLanguage="markdown"
              value={markdown}
              onChange={(value) => setMarkdown(value || '')}
              onMount={(editor) => { editorRef.current = editor; }}
              theme="vs-light"
              options={{
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              }}
              loading={<div className="theory-editor-loading">Загрузка Monaco Editor...</div>}
            />
          </Suspense>
        </div>

        {/* Resize handle */}
        <div className="theory-editor-resize-handle" onMouseDown={handleResizeStart} />

        {/* Preview Panel */}
        <div className="theory-editor-panel preview-panel">
          <div className="panel-header">
            <span>
              Превью ({pageSettings.pageSize} {pageSettings.orientation === 'landscape' ? '↔' : '↕'})
            </span>
            <span className="hint">{THEME_NAMES[currentTheme] || currentTheme}</span>
          </div>
          <div className="theory-preview-wrapper">
            <div
              ref={previewRef}
              className="theory-preview-content"
              data-theme={currentTheme}
              style={previewStyles}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="theory-editor-statusbar">
        <span className="statusbar-item">{stats.words} слов</span>
        <span className="statusbar-divider" />
        <span className="statusbar-item">{stats.formulas} формул</span>
        <span className="statusbar-divider" />
        <span className="statusbar-item">{stats.chars} символов</span>
        <span className="statusbar-divider" />
        <span
          className="statusbar-item statusbar-theme"
          onClick={() => setIsThemeModalOpen(true)}
        >
          <FormatPainterOutlined /> {THEME_NAMES[currentTheme] || currentTheme}
        </span>
        <div className="statusbar-spacer" />
        <span className="statusbar-item statusbar-autosave">
          <CheckCircleOutlined /> Автосохранение
        </span>
      </div>

      {/* Tags Modal */}
      <Modal
        title="Теги статьи"
        open={isTagsModalOpen}
        onCancel={() => setIsTagsModalOpen(false)}
        footer={null}
        width={400}
      >
        <div className="theory-tags-content">
          <Select
            mode="tags"
            placeholder="Введите теги через Enter"
            value={articleTags}
            onChange={setArticleTags}
            style={{ width: '100%' }}
            tokenSeparators={[',']}
            open={false}
          />
          {articleTags.length > 0 && (
            <div className="theory-tags-list">
              {articleTags.map(tag => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => setArticleTags(prev => prev.filter(t => t !== tag))}
                  style={{ marginBottom: 4 }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          )}
          <Input.TextArea
            placeholder="Краткое описание (summary)"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={2}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* GeoGebra blocks modal */}
      <GeoGebraBlocksModal
        open={isGeoModalOpen}
        onClose={() => setIsGeoModalOpen(false)}
        applets={geogebraApplets}
        onAppletsChange={setGeogebraApplets}
        onInsertBlock={insertGeoBlockAtCursor}
      />

      {/* Theme Selector Modal */}
      <Modal
        title="Выбор темы"
        open={isThemeModalOpen}
        onCancel={() => setIsThemeModalOpen(false)}
        footer={null}
        width={700}
      >
        <div className="theory-theme-grid">
          {THEMES.map(theme => (
            <div
              key={theme.id}
              className={`theory-theme-card ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => { setCurrentTheme(theme.id); setIsThemeModalOpen(false); }}
            >
              <div className="theme-preview" data-theme={theme.id}>
                <div className="preview-title">Заголовок</div>
                <div className="preview-text">Текст документа</div>
                <div className="preview-formula">x² + y² = r²</div>
              </div>
              <div className="theme-info">
                <h4>{theme.name}</h4>
                <p>{theme.description}</p>
                {currentTheme === theme.id && <Tag color="green" style={{ marginTop: 4 }}>Выбрана</Tag>}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Page Settings Modal */}
      <Modal
        title="Настройки страницы"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
        width={500}
      >
        <div className="theory-settings-content">
          <div className="theory-settings-section">
            <div className="theory-settings-section-title">Формат страницы</div>
            <Radio.Group
              value={pageSettings.pageSize}
              onChange={e => setPageSettings(prev => ({ ...prev, pageSize: e.target.value }))}
            >
              <Radio.Button value="A4">A4 (210 × 297 мм)</Radio.Button>
              <Radio.Button value="A5">A5 (148 × 210 мм)</Radio.Button>
            </Radio.Group>
          </div>

          <div className="theory-settings-section">
            <div className="theory-settings-section-title">Ориентация</div>
            <Radio.Group
              value={pageSettings.orientation}
              onChange={e => setPageSettings(prev => ({ ...prev, orientation: e.target.value }))}
            >
              <Radio.Button value="portrait">Книжная</Radio.Button>
              <Radio.Button value="landscape">Альбомная</Radio.Button>
            </Radio.Group>
          </div>

          <div className="theory-settings-section">
            <div className="theory-settings-section-title">Поля (мм)</div>
            <Space>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>Верх</div>
                <InputNumber min={5} max={50} value={pageSettings.marginTop}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginTop: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>Низ</div>
                <InputNumber min={5} max={50} value={pageSettings.marginBottom}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginBottom: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>Лево</div>
                <InputNumber min={5} max={50} value={pageSettings.marginLeft}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginLeft: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>Право</div>
                <InputNumber min={5} max={50} value={pageSettings.marginRight}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginRight: v || 15 }))} />
              </div>
            </Space>
          </div>

          <div className="theory-settings-section">
            <div className="theory-settings-section-title">Размер шрифта (px)</div>
            <InputNumber min={10} max={24} value={pageSettings.fontSize}
              onChange={v => setPageSettings(prev => ({ ...prev, fontSize: v || 16 }))} />
          </div>

          <div className="theory-settings-section">
            <div className="theory-settings-section-title">Быстрые пресеты</div>
            <div className="theory-settings-presets">
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'portrait', columns: 1,
                marginTop: 20, marginBottom: 20, marginLeft: 20, marginRight: 20, fontSize: 16
              })}>A4 Стандарт</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'landscape', columns: 2,
                marginTop: 10, marginBottom: 10, marginLeft: 15, marginRight: 15, fontSize: 12
              })}>A4 Альбомная</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A5', orientation: 'portrait', columns: 1,
                marginTop: 15, marginBottom: 15, marginLeft: 15, marginRight: 15, fontSize: 14
              })}>A5 Компакт</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'portrait', columns: 1,
                marginTop: 8, marginBottom: 8, marginLeft: 8, marginRight: 8, fontSize: 11
              })}>A4 Плотная</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
