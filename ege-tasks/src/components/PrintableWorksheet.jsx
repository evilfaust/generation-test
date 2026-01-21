import { useState } from 'react';
import { Card, Typography, Image, Modal, List, Button, Spin, Badge, Tag, Divider, Space, Tooltip, message } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';

const { Text, Title } = Typography;

const PrintableWorksheet = ({ cards: initialCards, title, showAnswers, showSolutions, format, cardsCount, tasksPerCard, topicName }) => {
  // Состояния для карточек и замены задач
  const [cards, setCards] = useState(initialCards || []);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null); // { cardIndex, taskIndex, task }
  const [replacementTasks, setReplacementTasks] = useState([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);

  // Определяем размеры карточек в зависимости от формата
  const getCardStyle = () => {
    switch (format) {
      case 'А6':
        return {
          cardsPerPage: 4,
          gridColumns: '1fr 1fr',
          gridRows: '1fr 1fr',
          cardPadding: '8mm',
          pagePadding: '7mm',
        };
      case 'А5':
        return {
          cardsPerPage: 2,
          gridColumns: '1fr',
          gridRows: '1fr 1fr',
          cardPadding: '10mm',
          pagePadding: '7mm',
        };
      case 'А4':
        return {
          cardsPerPage: 1,
          gridColumns: '1fr',
          gridRows: '1fr',
          cardPadding: '15mm',
          pagePadding: '7mm',
        };
      default:
        return {
          cardsPerPage: 4,
          gridColumns: '1fr 1fr',
          gridRows: '1fr 1fr',
          cardPadding: '8mm',
          pagePadding: '7mm',
        };
    }
  };

  const cardStyle = getCardStyle();

  // Функции для замены задач
  const handleReplaceTask = async (cardIndex, taskIndex, task) => {
    setTaskToReplace({ cardIndex, taskIndex, task });
    setReplaceModalVisible(true);
    setLoadingReplacements(true);

    try {
      // Загружаем все задачи из той же темы
      const filters = {};
      if (task.topic) filters.topic = task.topic;

      const allTopicTasks = await api.getTasks(filters);

      // Фильтруем: убираем только текущую задачу и задачи, уже используемые в карточках
      const usedTaskIds = new Set();
      cards.forEach(cardTasks => {
        cardTasks.forEach(t => usedTaskIds.add(t.id));
      });

      const filtered = allTopicTasks.filter(t =>
        t.id !== task.id &&
        !usedTaskIds.has(t.id)
      );

      // Сортируем по коду для удобства
      filtered.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      setReplacementTasks(filtered);
    } catch (error) {
      console.error('Error loading replacement tasks:', error);
      message.error('Ошибка при загрузке задач для замены');
    } finally {
      setLoadingReplacements(false);
    }
  };

  const handleConfirmReplace = (newTask) => {
    const { cardIndex, taskIndex } = taskToReplace;

    // Создаем копию карточек и заменяем задачу
    const newCards = [...cards];
    newCards[cardIndex] = [...newCards[cardIndex]];
    newCards[cardIndex][taskIndex] = newTask;

    setCards(newCards);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  const handleCancelReplace = () => {
    setReplaceModalVisible(false);
    setTaskToReplace(null);
    setReplacementTasks([]);
  };

  return (
    <div className="printable-worksheet">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-worksheet,
          .printable-worksheet * {
            visibility: visible;
          }
          .printable-worksheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-page {
            page-break-after: always;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0;
            size: A4 portrait;
          }
        }

        .print-page {
          display: grid;
          grid-template-columns: ${cardStyle.gridColumns};
          grid-template-rows: ${cardStyle.gridRows};
          gap: 0;
          width: 210mm;
          height: 297mm;
          padding: ${cardStyle.pagePadding};
          box-sizing: border-box;
          background: white;
          page-break-after: always;
        }

        .print-page:last-child {
          page-break-after: auto;
        }

        .worksheet-card {
          border: 2px solid #000;
          padding: ${cardStyle.cardPadding};
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          background: white;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 2px solid #000;
        }

        .card-code {
          font-size: 12px;
          font-weight: normal;
          border: 1px solid #000;
          padding: 3px 8px;
          background: white;
        }

        .student-info {
          flex: 1;
          border: 2px solid #000;
          height: 24px;
          margin-left: 10px;
        }

        .tasks-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .task-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          min-height: 20px;
          page-break-inside: avoid;
          position: relative;
        }

        .task-number {
          font-weight: normal;
          font-size: 13px;
          min-width: 20px;
          flex-shrink: 0;
        }

        .task-text {
          flex: 1;
          font-size: 12px;
          line-height: 1.4;
          display: flex;
          align-items: center;
        }

        .task-text img {
          max-width: 60px;
          max-height: 40px;
          margin-left: 6px;
          vertical-align: middle;
        }

        .answer-field {
          border: 1px solid #000;
          min-width: 60px;
          height: 22px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          background: white;
        }

        /* Страница с ответами */
        .answers-page {
          width: 210mm;
          min-height: 297mm;
          background: white;
          padding: 15mm;
          margin: 7mm;
          page-break-after: always;
          box-sizing: border-box;
        }

        @media print {
          .answers-page {
            margin: 0;
            padding: calc(15mm + 7mm) 15mm 15mm 15mm;
          }
        }

        .answers-page:last-child {
          page-break-after: auto;
        }

        .answers-header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #000;
        }

        .answers-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .answer-card {
          border: 2px solid #000;
          padding: 15px;
          background: #f9f9f9;
        }

        .answer-card-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #000;
        }

        .answer-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed #ccc;
        }

        .answer-item:last-child {
          border-bottom: none;
        }

        .katex {
          font-size: 0.95em !important;
        }

        .katex-display {
          margin: 0 !important;
          display: inline !important;
        }

        @media screen {
          .print-page,
          .answers-page {
            margin-bottom: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      {/* Карточки с заданиями */}
      {Array.from({ length: Math.ceil(cards.length / cardStyle.cardsPerPage) }, (_, pageIndex) => {
        const pageCards = cards.slice(
          pageIndex * cardStyle.cardsPerPage, 
          pageIndex * cardStyle.cardsPerPage + cardStyle.cardsPerPage
        );
        
        return (
          <div key={`tasks-${pageIndex}`} className="print-page">
            {pageCards.map((cardTasks, cardIndex) => {
              const globalCardIndex = pageIndex * cardStyle.cardsPerPage + cardIndex;
              
              // Если загружена одна карточка из базы - используем её title
              // Иначе генерируем название из topicName или title + номер
              let cardCode;
              if (cards.length === 1 && title.match(/\d{3}$/)) {
                // Загружена одна карточка - используем полное название
                cardCode = title;
              } else {
                // Генерируем новое название
                const cardNumber = String(globalCardIndex + 1).padStart(3, '0');
                const baseTitle = topicName || title;
                cardCode = `${baseTitle} ${cardNumber}`;
              }
              
              return (
                <div key={cardIndex} className="worksheet-card">
                  <div className="card-header">
                    <div className="card-code">{cardCode}</div>
                    <div className="student-info"></div>
                  </div>

                  <div className="tasks-container">
                    {cardTasks.map((task, taskIndex) => (
                      <div key={task.id} className="task-row">
                        <div className="task-number">{taskIndex + 1})</div>

                        <div className="task-text">
                          <MathRenderer text={task.statement_md} />

                          {task.has_image && task.image && (
                            <img
                              src={api.getImageUrl(task, task.image)}
                              alt=""
                            />
                          )}
                        </div>

                        <div className="answer-field">
                          {showAnswers && task.answer && (
                            <MathRenderer text={task.answer} />
                          )}
                        </div>

                        {/* Кнопка замены (только на экране) */}
                        <Tooltip title="Заменить задачу" className="no-print">
                          <Button
                            type="text"
                            size="small"
                            icon={<SwapOutlined />}
                            onClick={() => handleReplaceTask(globalCardIndex, taskIndex, task)}
                            style={{
                              position: 'absolute',
                              right: '5px',
                              top: '2px',
                              opacity: 0.6,
                              fontSize: '12px',
                              padding: '2px 4px',
                              height: 'auto',
                            }}
                          />
                        </Tooltip>
                      </div>
                    ))}
                  </div>

                  {showSolutions && cardTasks.some(t => t.solution_md) && (
                    <div style={{ 
                      marginTop: '8px', 
                      paddingTop: '6px', 
                      borderTop: '1px dashed #999',
                      fontSize: '10px'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Решения:</div>
                      {cardTasks.map((task, taskIndex) => (
                        task.solution_md && (
                          <div key={task.id} style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: 'bold' }}>{taskIndex + 1})</span>{' '}
                            <MathRenderer text={task.solution_md} />
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Отдельные страницы с ответами для каждой карточки */}
      {!showAnswers && cards.map((cardTasks, cardIndex) => {
        // Если загружена одна карточка из базы - используем её title
        // Иначе генерируем название из topicName или title + номер
        let cardFullName;
        if (cards.length === 1 && title.match(/\d{3}$/)) {
          // Загружена одна карточка - используем полное название
          cardFullName = title;
        } else {
          // Генерируем новое название
          const cardNumber = String(cardIndex + 1).padStart(3, '0');
          const baseTitle = topicName || title;
          cardFullName = `${baseTitle} ${cardNumber}`;
        }
        
        return (
          <div key={`answers-${cardIndex}`} className="answers-page">
            <div className="answers-header">
              <Title level={3} style={{ margin: 0 }}>
                Ответы: {cardFullName}
              </Title>
              <Text type="secondary">{title}</Text>
            </div>

            <div className="answers-grid">
              <div className="answer-card">
                <div className="answer-card-title">
                  {cardFullName} (Задания 1-{Math.ceil(cardTasks.length / 2)})
                </div>
              {cardTasks.slice(0, Math.ceil(cardTasks.length / 2)).map((task, taskIndex) => (
                <div key={task.id} className="answer-item">
                  <span><strong>{taskIndex + 1}.</strong></span>
                  <span style={{ 
                    background: '#fff', 
                    padding: '2px 8px', 
                    borderRadius: 3,
                    border: '1px solid #000',
                    minWidth: '80px',
                    textAlign: 'center',
                  }}>
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="answer-card">
              <div className="answer-card-title">
                {cardFullName} (Задания {Math.ceil(cardTasks.length / 2) + 1}-{cardTasks.length})
              </div>
              {cardTasks.slice(Math.ceil(cardTasks.length / 2)).map((task, taskIndex) => (
                <div key={task.id} className="answer-item">
                  <span><strong>{Math.ceil(cardTasks.length / 2) + taskIndex + 1}.</strong></span>
                  <span style={{ 
                    background: '#fff', 
                    padding: '2px 8px', 
                    borderRadius: 3,
                    border: '1px solid #000',
                    minWidth: '80px',
                    textAlign: 'center',
                  }}>
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Решения если включены */}
          {showSolutions && cardTasks.some(t => t.solution_md) && (
            <div style={{ marginTop: 30 }}>
              <Title level={4}>Решения:</Title>
              {cardTasks.map((task, taskIndex) => (
                task.solution_md && (
                  <div key={task.id} style={{ 
                    marginBottom: 15,
                    padding: 10,
                    background: '#f5f5f5',
                    borderRadius: 4,
                    border: '1px solid #d9d9d9',
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 5 }}>
                      Задание {taskIndex + 1}:
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <MathRenderer text={task.solution_md} />
                    </div>
                    {task.answer && (
                      <div style={{ marginTop: 5, fontWeight: 'bold', color: '#52c41a' }}>
                        Ответ: <MathRenderer text={task.answer} />
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      );})}

      {/* Модальное окно для замены задачи */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>Заменить задачу</span>
          </Space>
        }
        open={replaceModalVisible}
        onCancel={handleCancelReplace}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        {taskToReplace && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <strong>Текущая задача:</strong>
              <div style={{ marginTop: 8 }}>
                <Badge color="blue" text={`Код: ${taskToReplace.task.code}`} />
                <Divider type="vertical" />
                <Badge
                  color={
                    taskToReplace.task.difficulty === '1' ? 'green' :
                    taskToReplace.task.difficulty === '2' ? 'blue' :
                    taskToReplace.task.difficulty === '3' ? 'orange' :
                    taskToReplace.task.difficulty === '4' ? 'red' : 'purple'
                  }
                  text={`Сложность: ${taskToReplace.task.difficulty || '1'}`}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <MathRenderer text={taskToReplace.task.statement_md} />
              </div>
            </div>

            <Divider>Задачи для замены</Divider>

            {loadingReplacements ? (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <Spin tip="Загружаем задачи из темы..." />
              </div>
            ) : replacementTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                Задачи для замены не найдены
              </div>
            ) : (
              <List
                dataSource={replacementTasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleConfirmReplace(task)}
                      >
                        Заменить
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Badge color="blue" text={task.code} />
                          <Badge
                            color={
                              task.difficulty === '1' ? 'green' :
                              task.difficulty === '2' ? 'blue' :
                              task.difficulty === '3' ? 'orange' :
                              task.difficulty === '4' ? 'red' : 'purple'
                            }
                            text={`Сложность: ${task.difficulty || '1'}`}
                          />
                          {task.answer && <Tag color="green">С ответом</Tag>}
                          {task.solution && <Tag color="blue">С решением</Tag>}
                        </Space>
                      }
                      description={
                        <div style={{ maxHeight: 100, overflow: 'hidden' }}>
                          <MathRenderer text={task.statement_md} />
                        </div>
                      }
                    />
                  </List.Item>
                )}
                style={{ maxHeight: 500, overflowY: 'auto' }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PrintableWorksheet;


// import { Card, Divider, Typography, Space, Image } from 'antd';
// import MathRenderer from './MathRenderer';
// import { api } from '../services/pocketbase';

// const { Title, Text, Paragraph } = Typography;

// const PrintableWorksheet = ({ tasks, title, showAnswers, showSolutions, columns }) => {
//   const columnStyle = columns === 2 ? {
//     columnCount: 2,
//     columnGap: '20px',
//     columnRule: '1px solid #f0f0f0',
//   } : {};

//   return (
//     <Card className="printable-worksheet">
//       <style>{`
//         @media print {
//           body * {
//             visibility: hidden;
//           }
//           .printable-worksheet,
//           .printable-worksheet * {
//             visibility: visible;
//           }
//           .printable-worksheet {
//             position: absolute;
//             left: 0;
//             top: 0;
//             width: 100%;
//           }
//           .ant-card-head,
//           .ant-card-body {
//             border: none !important;
//             padding: 0 !important;
//           }
//           .task-item {
//             page-break-inside: avoid;
//             break-inside: avoid;
//           }
//           @page {
//             margin: 2cm;
//             size: A4;
//           }
//         }

//         .worksheet-header {
//           text-align: center;
//           margin-bottom: 30px;
//           border-bottom: 2px solid #000;
//           padding-bottom: 15px;
//         }

//         .student-info {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 20px;
//           font-size: 14px;
//         }

//         .student-info-field {
//           border-bottom: 1px solid #000;
//           min-width: 200px;
//           padding: 5px;
//         }

//         .task-item {
//           margin-bottom: 25px;
//           padding: 15px;
//           border: 1px solid #f0f0f0;
//           border-radius: 4px;
//         }

//         .task-number {
//           font-weight: bold;
//           font-size: 16px;
//           margin-bottom: 10px;
//         }

//         .task-statement {
//           font-size: 14px;
//           line-height: 1.8;
//           margin-bottom: 10px;
//         }

//         .answer-box {
//           border: 1px dashed #1890ff;
//           padding: 10px;
//           margin-top: 10px;
//           background: #f0f7ff;
//           border-radius: 4px;
//         }

//         .solution-box {
//           border: 1px solid #52c41a;
//           padding: 10px;
//           margin-top: 10px;
//           background: #f6ffed;
//           border-radius: 4px;
//         }
//       `}</style>

//       {/* Заголовок */}
//       <div className="worksheet-header">
//         <Title level={2} style={{ margin: 0 }}>{title}</Title>
//         <Text type="secondary">Дата: {new Date().toLocaleDateString('ru-RU')}</Text>
//       </div>

//       {/* Информация об ученике */}
//       <div className="student-info">
//         <div>
//           <Text>Фамилия, Имя: </Text>
//           <span className="student-info-field"></span>
//         </div>
//         <div>
//           <Text>Класс: </Text>
//           <span className="student-info-field"></span>
//         </div>
//         <div>
//           <Text>Оценка: </Text>
//           <span className="student-info-field"></span>
//         </div>
//       </div>

//       <Divider />

//       {/* Задания */}
//       <div style={columnStyle}>
//         {tasks.map((task, index) => (
//           <div key={task.id} className="task-item">
//             <div className="task-number">
//               Задание {index + 1}
//               {task.expand?.topic && (
//                 <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
//                   (№{task.expand.topic.ege_number})
//                 </Text>
//               )}
//             </div>

//             <div className="task-statement">
//               <MathRenderer text={task.statement_md} />
//             </div>

//             {/* Изображение */}
//             {task.has_image && task.image && (
//               <div style={{ marginTop: 10, marginBottom: 10 }}>
//                 <Image
//                   src={api.getImageUrl(task, task.image)}
//                   alt="Task image"
//                   style={{ maxWidth: '100%', maxHeight: '200px' }}
//                   preview={false}
//                 />
//               </div>
//             )}

//             {/* Место для ответа (если не показываем ответы) */}
//             {!showAnswers && (
//               <div style={{ marginTop: 15, borderTop: '1px solid #000', paddingTop: 5 }}>
//                 <Text strong>Ответ:</Text>
//                 <div style={{ height: 30 }}></div>
//               </div>
//             )}

//             {/* Ответ */}
//             {showAnswers && task.answer && (
//               <div className="answer-box">
//                 <Space align="start">
//                   <Text strong>Ответ:</Text>
//                   <span style={{ fontSize: 16 }}>
//                     <MathRenderer text={task.answer} />
//                   </span>
//                 </Space>
//               </div>
//             )}

//             {/* Решение */}
//             {showSolutions && task.solution_md && (
//               <div className="solution-box">
//                 <Text strong style={{ display: 'block', marginBottom: 8 }}>
//                   Решение:
//                 </Text>
//                 <Paragraph style={{ margin: 0 }}>
//                   <MathRenderer text={task.solution_md} />
//                 </Paragraph>
//               </div>
//             )}
//           </div>
//         ))}
//       </div>

//       {/* Футер */}
//       <Divider />
//       <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
//         <Text type="secondary">
//           Всего заданий: {tasks.length}
//         </Text>
//       </div>
//     </Card>
//   );
// };

// export default PrintableWorksheet;