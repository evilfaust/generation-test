import { useState, useEffect, useRef } from 'react';
import { Row, Col, Spin, Empty, Pagination } from 'antd';
import TaskFilters from './TaskFilters';
import TaskCard from './TaskCard';
import { api } from '../services/pocketbase';

const TaskList = ({ topics, tags, loading: initialLoading, onUpdate }) => {
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

  const loadTasks = async (newFilters = {}) => {
    setLoading(true);
    try {
      const data = await api.getTasks(newFilters);
      setTasks(data);
      setFilteredTasks(data);
      setCurrentPage(1);
      // Сохраняем фильтры в ref
      filtersRef.current = newFilters;
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadTasks(newFilters);
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleTaskUpdate = () => {
    // Перезагружаем задачи с СОХРАНЁННЫМИ фильтрами из ref
    loadTasksWithoutReset(filtersRef.current);
    // Вызываем родительский callback если есть
    if (onUpdate) {
      onUpdate();
    }
  };

  const loadTasksWithoutReset = async (currentFilters = {}) => {
    setLoading(true);
    try {
      const data = await api.getTasks(currentFilters);
      setTasks(data);
      setFilteredTasks(data);
      // НЕ сбрасываем currentPage и фильтры!
    } catch (error) {
      console.error('Error loading tasks:', error);
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
        onFilterChange={handleFilterChange}
        totalCount={filteredTasks.length}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
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

