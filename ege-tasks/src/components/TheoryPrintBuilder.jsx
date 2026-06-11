import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Checkbox, Select, Input, Tag, Spin, Tooltip, App } from 'antd';
import {
  FilePdfOutlined, PrinterOutlined, ArrowLeftOutlined,
  HolderOutlined, CloseOutlined, FileTextOutlined,
  BookOutlined, OrderedListOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor } from '../hooks';
import { getPageDimensions, DEFAULT_SETTINGS, printWithPageSize } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import './theory/TheoryPrintBuilder.css';
import { useReferenceData } from '../contexts/ReferenceDataContext';

export default function TheoryPrintBuilder({ onBack }) {
  const { message } = App.useApp();
  const { theoryCategories: categories } = useReferenceData();
  const [allArticles, setAllArticles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [includeToc, setIncludeToc] = useState(true);
  const [docTitle, setDocTitle] = useState('Конспект');
  const [pageSettings] = useState(DEFAULT_SETTINGS);
  const [isExporting, setIsExporting] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    loadArticlesList();
  }, [categoryFilter]);

  const loadArticlesList = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (categoryFilter) filters.category = categoryFilter;
      const data = await api.getTheoryArticles(filters);
      setAllArticles(data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedArticles([]);
      return;
    }
    loadSelectedContent();
  }, [selectedIds]);

  const loadSelectedContent = async () => {
    setLoadingContent(true);
    try {
      const articles = await Promise.all(
        selectedIds.map(id => api.getTheoryArticle(id))
      );
      setSelectedArticles(articles.filter(Boolean));
    } catch (error) {
      console.error('Error loading article content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const toggleArticle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const removeArticle = (id) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  // Drag-and-drop reorder for selected articles
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newIds = [...selectedIds];
    const [moved] = newIds.splice(dragIndex, 1);
    newIds.splice(index, 0, moved);
    setSelectedIds(newIds);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const combinedMarkdown = useMemo(() => {
    if (selectedArticles.length === 0) return '';

    // Reorder selectedArticles to match selectedIds order
    const ordered = selectedIds
      .map(id => selectedArticles.find(a => a.id === id))
      .filter(Boolean);

    let parts = [];

    if (includeToc && ordered.length > 1) {
      parts.push(`# ${docTitle}\n\n## Содержание\n`);
      ordered.forEach((a, i) => {
        parts.push(`${i + 1}. ${a.title}`);
      });
      parts.push('\n---\n');
    }

    ordered.forEach((article, index) => {
      if (index > 0) parts.push('\n---\n');
      parts.push(article.content_md || '');
    });

    return parts.join('\n');
  }, [selectedArticles, selectedIds, includeToc, docTitle]);

  const html = useMarkdownProcessor(combinedMarkdown, pageSettings.columns);

  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    return {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.3',
      boxSizing: 'border-box',
      margin: '0 auto',
      background: 'white',
      boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
      borderRadius: '4px',
    };
  }, [pageSettings]);

  // Estimate page count
  const estimatedPages = useMemo(() => {
    if (!html) return 0;
    const charCount = html.replace(/<[^>]+>/g, '').length;
    const charsPerPage = 3000;
    return Math.max(1, Math.ceil(charCount / charsPerPage));
  }, [html]);

  const handleExportPDF = useCallback(async () => {
    if (selectedArticles.length === 0) {
      message.warning('Выберите хотя бы одну статью');
      return;
    }
    const filename = (docTitle || 'conspect').trim();
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
      const opt = {
        margin: 0,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: [dims.width, dims.height],
          orientation: pageSettings.orientation,
        },
      };

      await html2pdf().set(opt).from(previewRef.current).save();
      message.success('PDF конспект экспортирован');
    } catch (error) {
      console.error('PDF export error:', error);
      message.error('Ошибка при экспорте PDF');
    } finally {
      setIsExporting(false);
    }
  }, [selectedArticles, docTitle, pageSettings, message]);

  const handlePrint = () => printWithPageSize(pageSettings);

  // Get ordered selected articles for the reorder panel
  const orderedSelected = useMemo(() => {
    return selectedIds
      .map(id => {
        const article = allArticles.find(a => a.id === id);
        if (!article) return null;
        const cat = article.expand?.category || categories.find(c => c.id === article.category);
        return { ...article, categoryData: cat };
      })
      .filter(Boolean);
  }, [selectedIds, allArticles, categories]);

  return (
    <div className="theory-print-view">
      {/* Toolbar */}
      <div className="theory-print-toolbar no-print">
        <div className="theory-print-toolbar-left">
          {onBack && (
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
              Назад
            </Button>
          )}
          <div className="theory-print-toolbar-divider" />
          <Input
            placeholder="Название конспекта"
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
            style={{ width: 200 }}
          />
          <Checkbox checked={includeToc} onChange={e => setIncludeToc(e.target.checked)}>
            Оглавление
          </Checkbox>
        </div>
        <div className="theory-print-toolbar-right">
          <Tooltip title="Печать">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={selectedArticles.length === 0}
            />
          </Tooltip>
          <Tooltip title="Экспорт PDF">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              loading={isExporting}
              disabled={selectedArticles.length === 0}
            />
          </Tooltip>
        </div>
      </div>

      <div className="theory-print-layout">
        {/* Left sidebar */}
        <div className="theory-print-sidebar no-print">
          <div className="theory-print-sidebar-header">
            <h3><BookOutlined /> Статьи</h3>
            <Select
              placeholder="Все категории"
              allowClear
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: '100%' }}
              options={categories.map(c => ({
                label: <Tag color={c.color}>{c.title}</Tag>,
                value: c.id,
              }))}
            />
            <div className="theory-print-counter">
              Выбрано: <strong>{selectedIds.length}</strong> из {allArticles.length}
            </div>
          </div>

          <div className="theory-print-article-list">
            {loading ? (
              <Spin style={{ display: 'block', margin: '30px auto' }} />
            ) : allArticles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#8c8c8c' }}>
                <FileTextOutlined style={{ fontSize: 32, color: '#d9d9d9', display: 'block', marginBottom: 8 }} />
                Нет статей
              </div>
            ) : (
              allArticles.map(article => {
                const cat = article.expand?.category || categories.find(c => c.id === article.category);
                const isSelected = selectedIds.includes(article.id);
                const orderNum = isSelected ? selectedIds.indexOf(article.id) + 1 : null;
                return (
                  <div
                    key={article.id}
                    className={`theory-print-article-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleArticle(article.id)}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="theory-print-article-info">
                      <div className="theory-print-article-title">{article.title}</div>
                      {cat && (
                        <Tag color={cat.color} className="theory-print-article-category">
                          {cat.title}
                        </Tag>
                      )}
                    </div>
                    {orderNum && (
                      <span className="theory-print-article-order">{orderNum}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Reorder selected */}
          {orderedSelected.length > 0 && (
            <div className="theory-print-selected">
              <div className="theory-print-selected-header">
                <span><OrderedListOutlined /> Порядок ({orderedSelected.length})</span>
              </div>
              <div className="theory-print-selected-list">
                {orderedSelected.map((article, index) => (
                  <div
                    key={article.id}
                    className={`theory-print-selected-item ${dragIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="theory-print-selected-item-drag">
                      <HolderOutlined />
                    </span>
                    <span className="theory-print-selected-item-num">{index + 1}</span>
                    <span className="theory-print-selected-item-title">{article.title}</span>
                    <span
                      className="theory-print-selected-item-remove"
                      onClick={(e) => { e.stopPropagation(); removeArticle(article.id); }}
                    >
                      <CloseOutlined />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — preview */}
        <div className="theory-print-preview-area">
          {loadingContent ? (
            <Spin style={{ display: 'block', margin: '60px auto' }} />
          ) : selectedArticles.length === 0 ? (
            <div className="theory-print-empty">
              <div className="theory-print-empty-icon"><FileTextOutlined /></div>
              <div className="theory-print-empty-text">Выберите статьи для конспекта</div>
              <div className="theory-print-empty-hint">
                Отмечайте статьи слева — они появятся в предпросмотре
              </div>
            </div>
          ) : (
            <>
              <div className="theory-print-page-info no-print">
                <FileTextOutlined />
                <span>
                  <strong>{selectedArticles.length}</strong> {selectedArticles.length === 1 ? 'статья' : selectedArticles.length < 5 ? 'статьи' : 'статей'}
                </span>
                <span>~<strong>{estimatedPages}</strong> {estimatedPages === 1 ? 'страница' : estimatedPages < 5 ? 'страницы' : 'страниц'}</span>
              </div>
              <div className="theory-print-content">
                <div
                  ref={previewRef}
                  className="theory-preview-content theory-article-print-area"
                  style={previewStyles}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
