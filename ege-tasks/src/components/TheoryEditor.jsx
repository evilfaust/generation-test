import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Button, Select, Input, Modal, Spin, InputNumber, Radio, Tag, Space, Tooltip, Badge, Popover, App } from 'antd';
import {
  SaveOutlined, SettingOutlined,
  ColumnWidthOutlined, FilePdfOutlined, PrinterOutlined,
  ArrowLeftOutlined, TagsOutlined, CheckCircleOutlined, NodeIndexOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor, useKeyboardShortcuts, useDocumentStats, useAutosave, loadAutosave, useGeoGebraInjection } from '../hooks';
import { getPageDimensions, DEFAULT_SETTINGS, printWithPageSize } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import EditorToolbar from './theory/EditorToolbar';
import GeoGebraBlocksModal from './theory/GeoGebraBlocksModal';
import { Chip } from './workspace/ui';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import './theory/TheoryGeoGebraEmbed.css';
import './theory/TheoryEditor.css';

const TheoryMarkdownEditor = lazy(() => import('./theory/TheoryMarkdownEditor'));

// Единый печатный стиль теории (бывшая «компактная» тема). Хранится в
// theme_settings.currentTheme для обратной совместимости со схемой.
const THEME = 'compact';

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
      geogebraApplets: Array.isArray(settings?.geogebra_applets) ? settings.geogebra_applets : [],
    };
  }, [articleId]);

  const [markdown, setMarkdown] = useState(initialData.content);
  const [pageSettings, setPageSettings] = useState(initialData.pageSettings);
  const [geogebraApplets, setGeogebraApplets] = useState(initialData.geogebraApplets);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
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
  const previewWrapRef = useRef(null);

  // Масштаб превью «вписать по ширине»: реальная страница (мм) ужимается,
  // чтобы целиком влезать в правую панель без горизонтального скролла.
  const [previewScale, setPreviewScale] = useState(1);
  const [previewContentH, setPreviewContentH] = useState(0);

  // Dirty-трекинг: сравниваем сигнатуру контента с последней сохранённой в БД.
  const savedSigRef = useRef(null);
  const resyncRef = useRef(true);

  // Process markdown
  const html = useMarkdownProcessor(markdown, pageSettings.columns);
  const stats = useDocumentStats(markdown);
  const autosaveExtraSettings = useMemo(
    () => ({ geogebra_applets: geogebraApplets }),
    [geogebraApplets],
  );

  // Autosave (локальный черновик в localStorage)
  useAutosave(markdown, pageSettings, THEME, articleId, autosaveExtraSettings);

  // Сигнатура контента для dirty-трекинга относительно сохранения в БД
  const contentSignature = useMemo(
    () => JSON.stringify({ markdown, title, categoryId, articleTags, summary, pageSettings, geogebraApplets }),
    [markdown, title, categoryId, articleTags, summary, pageSettings, geogebraApplets],
  );

  useEffect(() => {
    if (resyncRef.current) {
      // Первый рендер или после загрузки/сохранения — принимаем текущее за «сохранённое».
      resyncRef.current = false;
      savedSigRef.current = contentSignature;
      setDirty(false);
      return;
    }
    setDirty(contentSignature !== savedSigRef.current);
  }, [contentSignature]);

  // Предупреждение при уходе со страницы с несохранёнными правками
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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
          if (Array.isArray(article.theme_settings.geogebra_applets)) {
            setGeogebraApplets(article.theme_settings.geogebra_applets);
          }
        }
      }
    } catch (error) {
      message.error('Ошибка при загрузке статьи');
    } finally {
      setArticleLoading(false);
      resyncRef.current = true; // после загрузки принять контент за «сохранённый»
    }
  };

  const insertGeoBlockAtCursor = useCallback((applet) => {
    if (!applet?.id) return;
    editorRef.current?.insert({ text: `\n:::geogebra ${applet.id}:::\n` });
  }, []);

  // Insert formula at cursor
  const insertFormula = useCallback((type) => {
    if (type === 'inline') {
      editorRef.current?.insert({ before: '$', after: '$' });
    } else if (type === 'block') {
      editorRef.current?.insert({ before: '\n$$\n', after: '\n$$\n' });
    }
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
          currentTheme: THEME,
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
      savedSigRef.current = contentSignature; // зафиксировать как сохранённое
      setDirty(false);
      reloadData();
    } catch (error) {
      message.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }, [title, categoryId, markdown, articleTags, summary, pageSettings, geogebraApplets, articleId, onSaved, reloadData, message, contentSignature]);

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
    // На время съёмки снимаем масштаб со scaler — html2canvas рендерит лист
    // в реальном размере (а не уменьшенным под превью).
    const scaler = previewRef.current.parentElement;
    const prevTransform = scaler ? scaler.style.transform : '';
    if (scaler) scaler.style.transform = 'none';
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
      if (scaler) scaler.style.transform = prevTransform;
      setIsExporting(false);
    }
  }, [title, pageSettings, message]);

  // Печать прямо из редактора (печатается только лист превью — см. @media print).
  const handlePrint = useCallback(() => printWithPageSize(pageSettings), [pageSettings]);

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

  // CodeMirror сам пересчитывает раскладку при ресайзе панели — спец-вызов не нужен.

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

  // Ширина страницы в px (мм → px при 96 dpi) — для масштабирования превью
  const MM_TO_PX = 96 / 25.4;
  const pageWidthPx = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    return dims.width * MM_TO_PX;
  }, [pageSettings.pageSize, pageSettings.orientation, MM_TO_PX]);

  // Вписать страницу по ширине панели превью (ужать, не увеличивать).
  // Масштаб вешаем на обёртку-scaler, сама .theory-preview-content остаётся
  // в реальном размере — чтобы экспорт PDF (html2canvas с previewRef) снимал
  // лист в полном разрешении, а не уменьшенным.
  useEffect(() => {
    const wrap = previewWrapRef.current;
    const content = previewRef.current;
    if (!wrap || !content) return undefined;
    const recompute = () => {
      const avail = wrap.clientWidth - 40; // padding обёртки 20px с двух сторон
      const s = Math.min(1, Math.max(0.25, avail / pageWidthPx));
      setPreviewScale(s);
      setPreviewContentH(content.offsetHeight);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    ro.observe(content);
    return () => ro.disconnect();
  }, [pageWidthPx, html, pageSettings]);

  // Панель параметров листа (в Popover у кнопки настроек)
  const pageSettingsPanel = (
    <div className="theory-settings-content" style={{ width: 320 }}>
      <div className="theory-settings-section">
        <div className="theory-settings-section-title">Формат и ориентация</div>
        <Space wrap>
          <Radio.Group
            size="small"
            value={pageSettings.pageSize}
            onChange={e => setPageSettings(prev => ({ ...prev, pageSize: e.target.value }))}
          >
            <Radio.Button value="A4">A4</Radio.Button>
            <Radio.Button value="A5">A5</Radio.Button>
          </Radio.Group>
          <Radio.Group
            size="small"
            value={pageSettings.orientation}
            onChange={e => setPageSettings(prev => ({ ...prev, orientation: e.target.value }))}
          >
            <Radio.Button value="portrait">Книжная</Radio.Button>
            <Radio.Button value="landscape">Альбомная</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      <div className="theory-settings-section">
        <div className="theory-settings-section-title">Поля (мм)</div>
        <Space>
          {[
            ['Верх', 'marginTop'],
            ['Низ', 'marginBottom'],
            ['Лево', 'marginLeft'],
            ['Право', 'marginRight'],
          ].map(([label, key]) => (
            <div key={key}>
              <div className="theory-settings-hint">{label}</div>
              <InputNumber
                size="small"
                min={5}
                max={50}
                style={{ width: 60 }}
                value={pageSettings[key]}
                onChange={v => setPageSettings(prev => ({ ...prev, [key]: v || 15 }))}
              />
            </div>
          ))}
        </Space>
      </div>

      <div className="theory-settings-section">
        <div className="theory-settings-section-title">Размер шрифта (px)</div>
        <InputNumber
          size="small"
          min={10}
          max={24}
          value={pageSettings.fontSize}
          onChange={v => setPageSettings(prev => ({ ...prev, fontSize: v || 16 }))}
        />
      </div>

      <div className="theory-settings-section">
        <div className="theory-settings-section-title">Пресеты</div>
        <div className="theory-settings-presets">
          <Button size="small" onClick={() => setPageSettings({
            pageSize: 'A4', orientation: 'portrait', columns: 1,
            marginTop: 12, marginBottom: 12, marginLeft: 10, marginRight: 10, fontSize: 16
          })}>A4 стандарт</Button>
          <Button size="small" onClick={() => setPageSettings({
            pageSize: 'A4', orientation: 'landscape', columns: 2,
            marginTop: 10, marginBottom: 10, marginLeft: 15, marginRight: 15, fontSize: 12
          })}>A4 в 2 колонки</Button>
          <Button size="small" onClick={() => setPageSettings({
            pageSize: 'A5', orientation: 'portrait', columns: 1,
            marginTop: 15, marginBottom: 15, marginLeft: 15, marginRight: 15, fontSize: 14
          })}>A5 компакт</Button>
          <Button size="small" onClick={() => setPageSettings({
            pageSize: 'A4', orientation: 'portrait', columns: 1,
            marginTop: 8, marginBottom: 8, marginLeft: 8, marginRight: 8, fontSize: 11
          })}>A4 плотная</Button>
        </div>
      </div>
    </div>
  );

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
            variant="borderless"
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
          <Popover
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            trigger="click"
            placement="bottomRight"
            content={pageSettingsPanel}
            title="Параметры листа"
          >
            <Tooltip title="Параметры листа">
              <Button type="text" size="small" icon={<SettingOutlined />} />
            </Tooltip>
          </Popover>
          <Tooltip title="GeoGebra-блоки">
            <Badge count={geogebraApplets.length} size="small" offset={[-4, 0]}>
              <Button type="text" size="small" icon={<NodeIndexOutlined />} onClick={() => setIsGeoModalOpen(true)} />
            </Badge>
          </Tooltip>
          <div className="toolbar-divider" />
          <span className="theory-save-status">
            {saving
              ? <Chip tone="neutral" dot={false}>Сохранение…</Chip>
              : dirty
                ? <Chip tone="amber" dot={false}>Не сохранено</Chip>
                : <Chip tone="teal" dot={false}>Сохранено</Chip>}
          </span>
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
          <Tooltip title="Печать">
            <Button
              type="text"
              size="small"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
            />
          </Tooltip>
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
          </div>
          <Suspense fallback={<div className="theory-editor-loading">Загрузка редактора...</div>}>
            <TheoryMarkdownEditor
              ref={editorRef}
              value={markdown}
              onChange={(value) => setMarkdown(value || '')}
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
            <span className="hint">{pageSettings.columns > 1 ? `${pageSettings.columns} колонки` : '1 колонка'}</span>
          </div>
          <div className="theory-preview-wrapper" ref={previewWrapRef}>
            <div
              className="theory-preview-sizer"
              style={{
                width: `${pageWidthPx * previewScale}px`,
                height: previewContentH ? `${previewContentH * previewScale}px` : undefined,
              }}
            >
              <div
                className="theory-preview-scaler"
                style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
              >
                <div
                  ref={previewRef}
                  className="theory-preview-content"
                  style={previewStyles}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
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
        <div className="statusbar-spacer" />
        <span className="statusbar-item statusbar-autosave">
          <CheckCircleOutlined /> Черновик в браузере
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
    </div>
  );
}
