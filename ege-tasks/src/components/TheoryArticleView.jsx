import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Spin, Tag, Select, Tooltip, Drawer, App } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, FilePdfOutlined,
  PrinterOutlined, FormatPainterOutlined, BookOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor, useGeoGebraInjection } from '../hooks';
import { getPageDimensions, DEFAULT_SETTINGS, THEME_NAMES } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import MathRenderer from './MathRenderer';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import './theory/TheoryGeoGebraEmbed.css';
import './theory/TheoryArticleView.css';

export default function TheoryArticleView({ articleId, onBack, onEdit }) {
  const { message } = App.useApp();
  const { theoryCategories: categories } = useReferenceData();
  const { canEdit } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [pageSettings, setPageSettings] = useState(DEFAULT_SETTINGS);
  const [isExporting, setIsExporting] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [relatedTags, setRelatedTags] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [toc, setToc] = useState([]);
  const [activeHeading, setActiveHeading] = useState(-1);
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
  const previewRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (articleId) loadArticle(articleId);
  }, [articleId]);

  useEffect(() => {
    if (article?.tags && article.tags.length > 0) {
      loadRelatedTasks(article.tags);
    } else {
      setRelatedTasks([]);
      setRelatedTags([]);
    }
  }, [article?.id, article?.tags]);

  const loadArticle = async (id) => {
    setLoading(true);
    try {
      const data = await api.getTheoryArticle(id);
      setArticle(data);
      if (data?.theme_settings) {
        if (data.theme_settings.pageSettings) setPageSettings(data.theme_settings.pageSettings);
        if (data.theme_settings.currentTheme) setCurrentTheme(data.theme_settings.currentTheme);
      }
    } catch (error) {
      message.error('Ошибка при загрузке статьи');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedTasks = async (tagTitles = []) => {
    setLoadingRelated(true);
    try {
      const allTags = await api.getTags();
      const tagMap = new Map(allTags.map(t => [t.title.toLowerCase(), t]));
      const matched = tagTitles.map(t => tagMap.get(t.toLowerCase())).filter(Boolean);
      const tagIds = matched.map(t => t.id);
      setRelatedTags(matched);
      if (tagIds.length === 0) { setRelatedTasks([]); return; }
      const tasks = await api.getTasks({ tags: tagIds });
      setRelatedTasks([...tasks].sort((a, b) => (a.code || '').localeCompare(b.code || '')));
    } catch (error) {
      console.error('Error loading related tasks:', error);
      setRelatedTasks([]);
      setRelatedTags([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const html = useMarkdownProcessor(article?.content_md || '', pageSettings.columns);

  // Generate TOC from rendered HTML
  useEffect(() => {
    if (!html) { setToc([]); return; }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const headings = tempDiv.querySelectorAll('h1, h2, h3');
    const tocItems = Array.from(headings).map((h, i) => ({
      id: `heading-${i}`,
      text: h.textContent,
      level: parseInt(h.tagName[1]),
    }));
    setToc(tocItems);
  }, [html]);

  // Add IDs to headings after render
  useEffect(() => {
    if (!previewRef.current) return;
    const headings = previewRef.current.querySelectorAll('h1, h2, h3');
    headings.forEach((h, i) => { h.id = `heading-${i}`; });
  }, [html]);

  const geogebraAppletsById = useMemo(() => {
    const applets = article?.theme_settings?.geogebra_applets;
    if (!Array.isArray(applets)) return new Map();
    return new Map(
      applets
        .filter(item => item?.id)
        .map(item => [item.id, item]),
    );
  }, [article?.theme_settings]);

  // Inject GeoGebra images into rendered HTML
  useGeoGebraInjection(previewRef, html, geogebraAppletsById);

  // IntersectionObserver for active TOC item
  useEffect(() => {
    if (!previewRef.current || toc.length === 0) return;
    const headings = previewRef.current.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Array.from(headings).indexOf(entry.target);
            if (index >= 0) setActiveHeading(index);
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', root: contentRef.current }
    );
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [html, toc.length]);

  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    return {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.4',
      boxSizing: 'border-box',
      margin: '0 auto',
      background: 'white',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      ...(pageSettings.columns > 1 && {
        display: 'grid',
        gridTemplateColumns: `repeat(${pageSettings.columns}, 1fr)`,
        columnGap: '15px',
        alignContent: 'start',
      }),
    };
  }, [pageSettings]);

  const handleExportPDF = useCallback(async () => {
    if (!article) return;
    const filename = (article.title || 'theory').trim();
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
  }, [article, pageSettings, message]);

  const handlePrint = useCallback(() => window.print(), []);

  const scrollToHeading = useCallback((headingId) => {
    const el = document.getElementById(headingId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  if (!article) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Статья не найдена</div>;
  }

  const cat = article.expand?.category || categories.find(c => c.id === article.category);

  return (
    <div className="theory-article-view">
      {/* Toolbar */}
      <div className="theory-article-toolbar no-print">
        <div className="theory-article-toolbar-left">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <div className="theory-article-toolbar-divider" />
          <Select
            value={currentTheme}
            onChange={setCurrentTheme}
            size="small"
            style={{ width: 160 }}
            options={Object.entries(THEME_NAMES).map(([key, label]) => ({
              value: key, label,
            }))}
          />
        </div>
        <div className="theory-article-toolbar-right">
          {canEdit && (
            <Tooltip title="Редактировать">
              <Button type="text" icon={<EditOutlined />} onClick={() => onEdit?.(articleId)} />
            </Tooltip>
          )}
          <Tooltip title="Печать">
            <Button type="text" icon={<PrinterOutlined />} onClick={handlePrint} />
          </Tooltip>
          <Tooltip title="Экспорт PDF">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              loading={isExporting}
            />
          </Tooltip>
        </div>
      </div>

      {/* Layout with optional TOC */}
      <div className="theory-article-layout">
        {/* TOC Sidebar */}
        {toc.length > 3 && (
          <aside className="theory-article-toc no-print">
            <div className="toc-title">Содержание</div>
            {toc.map((item, i) => (
              <a
                key={i}
                className={`toc-item toc-level-${item.level} ${activeHeading === i ? 'active' : ''}`}
                onClick={() => scrollToHeading(item.id)}
              >
                {item.text}
              </a>
            ))}
          </aside>
        )}

        {/* Main content */}
        <div className="theory-article-main" ref={contentRef}>
          {/* Article header */}
          <div className="theory-article-header no-print">
            {cat && (
              <span
                className="theory-article-category"
                style={{ color: cat.color, borderColor: cat.color }}
              >
                {cat.title}
              </span>
            )}
            <h1 className="theory-article-title">{article.title}</h1>
            {article.summary && (
              <p className="theory-article-summary">{article.summary}</p>
            )}
            <div className="theory-article-meta">
              {(article.tags || []).map(tag => (
                <span key={tag} className="theory-meta-tag">{tag}</span>
              ))}
              <span className="theory-meta-date">{formatDate(article.updated)}</span>
            </div>
          </div>

          {/* Article body */}
          <div className="theory-article-content-wrapper">
            <div
              ref={previewRef}
              className="theory-preview-content theory-article-print-area"
              data-theme={currentTheme}
              style={previewStyles}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>

          {/* Related tasks */}
          {(article.tags?.length > 0) && (
            <div className="theory-related-section no-print">
              <div className="theory-related-header">
                <BookOutlined /> Связанные задачи ({relatedTasks.length})
              </div>

              {relatedTags.length > 0 && (
                <div className="theory-related-tags">
                  {relatedTags.map(tag => (
                    <Tag key={tag.id} color={tag.color}>{tag.title}</Tag>
                  ))}
                </div>
              )}

              {loadingRelated ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : relatedTasks.length === 0 ? (
                <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                  {relatedTags.length === 0 ? 'Теги статьи не найдены в базе задач.' : 'Нет задач по выбранным тегам.'}
                </div>
              ) : (
                <div className="theory-related-scroll">
                  {relatedTasks.slice(0, 12).map(task => (
                    <div key={task.id} className="theory-related-card">
                      <div className="related-card-code">
                        <Tag color="blue">{task.code}</Tag>
                        <span className={`difficulty-dot difficulty-${task.difficulty || 1}`} />
                      </div>
                      <div className="related-card-text">
                        <MathRenderer text={task.statement_md} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating actions */}
      <div className="theory-floating-actions no-print">
        {canEdit && (
          <Tooltip title="Редактировать" placement="left">
            <Button shape="circle" icon={<EditOutlined />} onClick={() => onEdit?.(articleId)} />
          </Tooltip>
        )}
        <Tooltip title="Печать" placement="left">
          <Button shape="circle" icon={<PrinterOutlined />} onClick={handlePrint} />
        </Tooltip>
        <Tooltip title="Экспорт PDF" placement="left">
          <Button
            shape="circle"
            icon={<FilePdfOutlined />}
            onClick={handleExportPDF}
            loading={isExporting}
          />
        </Tooltip>
        <Tooltip title="Тема" placement="left">
          <Button
            shape="circle"
            icon={<FormatPainterOutlined />}
            onClick={() => setThemeDrawerOpen(true)}
          />
        </Tooltip>
      </div>

      {/* Theme drawer */}
      <Drawer
        title="Тема оформления"
        open={themeDrawerOpen}
        onClose={() => setThemeDrawerOpen(false)}
        width={280}
      >
        <div className="theory-theme-drawer">
          {Object.entries(THEME_NAMES).map(([key, label]) => (
            <div
              key={key}
              className={`theory-theme-option ${currentTheme === key ? 'active' : ''}`}
              onClick={() => { setCurrentTheme(key); setThemeDrawerOpen(false); }}
            >
              <span>{label}</span>
              {currentTheme === key && <Tag color="green">Выбрана</Tag>}
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
