import { useState, useEffect } from 'react';
import { Input, Select, Button, Tag, Spin, Popconfirm, Tooltip, App } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, BookOutlined, AppstoreOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import './theory/TheoryBrowser.css';

export default function TheoryBrowser({ onEditArticle, onViewArticle, onCreateArticle }) {
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const { theoryCategories: categories } = useReferenceData();
  const [articles, setArticles] = useState([]);
  const [articleCounts, setArticleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadArticles();
  }, [selectedCategory]);

  useEffect(() => {
    loadArticleCounts();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (selectedCategory) filters.category = selectedCategory;
      const data = await api.getTheoryArticles(filters);
      setArticles(data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArticleCounts = async () => {
    try {
      const counts = await api.getTheoryArticleCountByCategory();
      setArticleCounts(counts);
    } catch (error) {
      console.error('Error loading article counts:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTheoryArticle(id);
      message.success('Статья удалена');
      loadArticles();
      loadArticleCounts();
    } catch (error) {
      message.error('Ошибка при удалении');
    }
  };

  const filteredArticles = articles.filter(a => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      a.title?.toLowerCase().includes(search) ||
      a.summary?.toLowerCase().includes(search) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search))
    );
  });

  const getCategoryInfo = (categoryId) => {
    return categories.find(c => c.id === categoryId) || null;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Статистика для hero
  const totalArticles = articles.length;
  const recentCount = articles.filter(a => {
    if (!a.updated) return false;
    const diff = Date.now() - new Date(a.updated).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000; // 7 дней
  }).length;

  return (
    <div>
      {/* Hero секция */}
      <div className="theory-browser-hero">
        <div className="theory-hero-card theory-hero-card--articles">
          <div className="theory-hero-icon"><BookOutlined /></div>
          <div className="theory-hero-value">{totalArticles}</div>
          <div className="theory-hero-label">Статей</div>
        </div>
        <div className="theory-hero-card theory-hero-card--categories">
          <div className="theory-hero-icon"><AppstoreOutlined /></div>
          <div className="theory-hero-value">{categories.length}</div>
          <div className="theory-hero-label">Категорий</div>
        </div>
        <div className="theory-hero-card theory-hero-card--recent">
          <div className="theory-hero-icon"><ClockCircleOutlined /></div>
          <div className="theory-hero-value">{recentCount}</div>
          <div className="theory-hero-label">За неделю</div>
        </div>
      </div>

      {/* Панель поиска */}
      <div className="theory-browser-search-bar">
        <div className="theory-search-input">
          <Input
            placeholder="Поиск по названию, описанию или тегам..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            size="large"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
        </div>
        {canEdit && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            className="theory-create-btn"
            onClick={onCreateArticle}
          >
            Новая статья
          </Button>
        )}
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="theory-category-pills">
          <div
            className={`theory-category-pill ${!selectedCategory ? 'active' : ''}`}
            style={{ '--pill-color': '#4361ee' }}
            onClick={() => setSelectedCategory(null)}
          >
            Все
            <span className="pill-count">{totalArticles}</span>
          </div>
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`theory-category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              style={{ '--pill-color': cat.color }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <span className="pill-dot" style={{ background: cat.color }} />
              {cat.title}
              <span className="pill-count">{articleCounts[cat.id] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Контент */}
      {loading ? (
        <div className="theory-browser-loading">
          <Spin size="large" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="theory-browser-empty">
          <div className="theory-browser-empty-icon"><BookOutlined /></div>
          <div className="theory-browser-empty-text">
            {articles.length === 0 ? 'Нет статей. Создайте первую!' : 'Ничего не найдено'}
          </div>
          {articles.length === 0 && canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateArticle}>
              Создать статью
            </Button>
          )}
        </div>
      ) : (
        <div className="theory-articles-grid">
          {filteredArticles.map(article => {
            const cat = getCategoryInfo(article.category) || article.expand?.category;
            return (
              <div
                key={article.id}
                className="theory-article-card"
                style={{ '--card-accent': cat?.color || '#d9d9d9' }}
                onClick={() => onViewArticle?.(article.id)}
              >
                <div className="theory-article-card-header">
                  {cat && (
                    <span
                      className="theory-article-category-badge"
                      style={{ color: cat.color }}
                    >
                      {cat.title}
                    </span>
                  )}
                  <span className="theory-article-date">
                    {formatDate(article.updated)}
                  </span>
                </div>

                <h3 className="theory-article-card-title">{article.title}</h3>

                {article.summary && (
                  <p className="theory-article-card-summary">{article.summary}</p>
                )}

                <div className="theory-article-card-footer">
                  <div className="theory-article-tags">
                    {(article.tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="theory-article-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="theory-article-actions">
                    <Tooltip title="Просмотр">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => { e.stopPropagation(); onViewArticle?.(article.id); }}
                      />
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Редактировать">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); onEditArticle?.(article.id); }}
                        />
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Popconfirm
                        title="Удалить статью?"
                        onConfirm={() => handleDelete(article.id)}
                        okText="Да"
                        cancelText="Нет"
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
