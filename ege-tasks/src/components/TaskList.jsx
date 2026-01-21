import { useState, useEffect, useRef } from 'react';
import { Row, Col, Spin, Empty, Pagination, message, Skeleton, Card } from 'antd';
import TaskFilters from './TaskFilters';
import TaskCard from './TaskCard';
import { api } from '../services/pocketbase';

const TaskList = ({ topics, tags, years, sources, subtopics, loading: initialLoading }) => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({});
  const filtersRef = useRef({}); // Сохраняем фильтры в ref, чтобы они не терялись

  useEffect(() => {
    loadTasks();
  }, []);

  // Применяем клиентский поиск, фильтрацию и сортировку
  useEffect(() => {
    let result = [...tasks];

    // Применяем поиск
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(task => {
        return (
          task.code?.toLowerCase().includes(searchLower) ||
          task.statement_md?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Применяем фильтрацию по тегам
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(task => {
        // Проверяем есть ли у задачи хотя бы один из выбранных тегов
        if (!task.tags || task.tags.length === 0) return false;
        return filters.tags.some(tagId => task.tags.includes(tagId));
      });
    }

    // Применяем сортировку
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'code':
          result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          break;
        case 'difficulty':
          result.sort((a, b) => {
            const diffA = parseInt(a.difficulty || '1');
            const diffB = parseInt(b.difficulty || '1');
            return diffA - diffB;
          });
          break;
        case 'created':
          result.sort((a, b) => new Date(b.created) - new Date(a.created));
          break;
        case 'updated':
          result.sort((a, b) => new Date(b.updated) - new Date(a.updated));
          break;
        default:
          result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      }
    } else {
      // Сортировка по умолчанию - по коду
      result.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }

    setFilteredTasks(result);

    // Сбрасываем на первую страницу при изменении поиска или фильтров
    if (filters.search || (filters.tags && filters.tags.length > 0)) {
      setCurrentPage(1);
    }
  }, [filters.search, filters.tags, filters.sortBy, tasks]);

  const loadTasks = async (newFilters = {}, resetPage = false) => {
    setLoading(true);
    try {
      const data = await api.getTasks(newFilters);
      setTasks(data);
      setFilteredTasks(data);
      if (resetPage) {
        setCurrentPage(1);
      }
      // Сохраняем фильтры в ref
      filtersRef.current = newFilters;
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    // Разделяем поиск от остальных фильтров
    const { search, ...serverFilters } = newFilters;

    // Загружаем задачи с серверными фильтрами и сбрасываем страницу
    loadTasks(serverFilters, true);
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleTaskUpdate = () => {
    // Перезагружаем задачи с СОХРАНЁННЫМИ фильтрами из ref
    // Фильтры и страница НЕ сбрасываются!
    loadTasksWithoutReset(filtersRef.current);
  };

  const loadTasksWithoutReset = async (currentFilters = {}) => {
    setLoading(true);
    try {
      const data = await api.getTasks(currentFilters);
      setTasks(data);
      // filteredTasks обновится через useEffect с клиентским поиском
      // НЕ сбрасываем currentPage и фильтры!
      filtersRef.current = currentFilters; // Обновляем ref
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  // Пагинация
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <TaskFilters
        topics={topics}
        tags={tags}
        years={years}
        sources={sources}
        subtopics={subtopics}
        onFilterChange={handleFilterChange}
        totalCount={filteredTasks.length}
      />

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Col xs={24} sm={24} md={12} lg={8} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : filteredTasks.length === 0 ? (
        <Empty 
          description="Задачи не найдены"
          style={{ marginTop: 50 }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {paginatedTasks.map((task) => (
              <Col xs={24} sm={24} md={12} lg={8} key={task.id}>
                <TaskCard
                  task={task}
                  allTags={tags}
                  allSources={sources}
                  allYears={years}
                  allSubtopics={subtopics}
                  allTopics={topics}
                  onUpdate={handleTaskUpdate}
                />
              </Col>
            ))}
          </Row>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredTasks.length}
              onChange={handlePageChange}
              showSizeChanger
              showTotal={(total) => `Всего задач: ${total}`}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TaskList;

