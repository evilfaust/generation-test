import { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import { FileTextOutlined, PrinterOutlined, FileSearchOutlined } from '@ant-design/icons';
import TaskList from './components/TaskList';
import WorksheetGenerator from './components/WorksheetGenerator';
import TaskWorksheet from './components/TaskWorksheet';
import { api } from './services/pocketbase';
import 'katex/dist/katex.min.css';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [currentView, setCurrentView] = useState('tasks');
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasksKey, setTasksKey] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsData, tagsData] = await Promise.all([
        api.getTopics(),
        api.getTags(),
      ]);
      setTopics(topicsData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = () => {
    setTasksKey(prev => prev + 1);
  };

  const menuItems = [
    {
      key: 'tasks',
      icon: <FileTextOutlined />,
      label: 'Все задачи',
    },
    {
      key: 'generator',
      icon: <PrinterOutlined />,
      label: 'Генератор карточек',
    },
    {
      key: 'worksheet',
      icon: <FileSearchOutlined />,
      label: 'Лист задач (А4)',
    },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'tasks':
        return (
          <TaskList 
            key={tasksKey}
            topics={topics} 
            tags={tags} 
            loading={loading}
            onUpdate={handleTaskUpdate}
          />
        );
      case 'generator':
        return (
          <WorksheetGenerator 
            topics={topics} 
            tags={tags}
          />
        );
      case 'worksheet':
        return (
          <TaskWorksheet 
            topics={topics} 
            tags={tags}
          />
        );
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'tasks':
        return 'Все задачи';
      case 'generator':
        return 'Генератор карточек';
      case 'worksheet':
        return 'Лист задач (А4)';
      default:
        return '';
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          style={{
            background: '#fff',
            boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: '#1890ff'
          }}>
            ЕГЭ Задачи
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentView]}
            items={menuItems}
            onClick={({ key }) => setCurrentView(key)}
            style={{ borderRight: 0 }}
          />
        </Sider>

        <Layout>
          <Header style={{ 
            background: '#fff', 
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            fontSize: 20,
            fontWeight: 500,
          }}>
            {getHeaderTitle()}
          </Header>

          <Content style={{ margin: '24px 16px 0' }}>
            <div style={{ 
              padding: 24, 
              minHeight: 360, 
              background: '#fff',
              borderRadius: 8,
            }}>
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;


// import { useState, useEffect } from 'react';
// import { Layout, Menu, ConfigProvider, theme } from 'antd';
// import { FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
// import TaskList from './components/TaskList';
// import WorksheetGenerator from './components/WorksheetGenerator';
// import { api } from './services/pocketbase';
// import 'katex/dist/katex.min.css';
// import './App.css';

// const { Header, Content, Sider } = Layout;

// function App() {
//   const [currentView, setCurrentView] = useState('tasks');
//   const [topics, setTopics] = useState([]);
//   const [tags, setTags] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [tasksKey, setTasksKey] = useState(0); // Для принудительного обновления списка

//   useEffect(() => {
//     loadData();
//   }, []);

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       const [topicsData, tagsData] = await Promise.all([
//         api.getTopics(),
//         api.getTags(),
//       ]);
//       setTopics(topicsData);
//       setTags(tagsData);
//     } catch (error) {
//       console.error('Error loading data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Функция для обновления списка задач после редактирования
//   const handleTaskUpdate = () => {
//     // Увеличиваем ключ, чтобы TaskList перезагрузил данные
//     setTasksKey(prev => prev + 1);
//   };

//   const menuItems = [
//     {
//       key: 'tasks',
//       icon: <FileTextOutlined />,
//       label: 'Все задачи',
//     },
//     {
//       key: 'generator',
//       icon: <PrinterOutlined />,
//       label: 'Генератор карточек',
//     },
//   ];

//   return (
//     <ConfigProvider
//       theme={{
//         algorithm: theme.defaultAlgorithm,
//         token: {
//           colorPrimary: '#1890ff',
//         },
//       }}
//     >
//       <Layout style={{ minHeight: '100vh' }}>
//         <Sider
//           breakpoint="lg"
//           collapsedWidth="0"
//           style={{
//             background: '#fff',
//             boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
//           }}
//         >
//           <div style={{ 
//             height: 64, 
//             display: 'flex', 
//             alignItems: 'center', 
//             justifyContent: 'center',
//             fontSize: 18,
//             fontWeight: 600,
//             color: '#1890ff'
//           }}>
//             ЕГЭ Задачи
//           </div>
//           <Menu
//             mode="inline"
//             selectedKeys={[currentView]}
//             items={menuItems}
//             onClick={({ key }) => setCurrentView(key)}
//             style={{ borderRight: 0 }}
//           />
//         </Sider>

//         <Layout>
//           <Header style={{ 
//             background: '#fff', 
//             padding: '0 24px',
//             boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
//             display: 'flex',
//             alignItems: 'center',
//             fontSize: 20,
//             fontWeight: 500,
//           }}>
//             {currentView === 'tasks' && 'Все задачи'}
//             {currentView === 'generator' && 'Генератор карточек'}
//           </Header>

//           <Content style={{ margin: '24px 16px 0' }}>
//             <div style={{ 
//               padding: 24, 
//               minHeight: 360, 
//               background: '#fff',
//               borderRadius: 8,
//             }}>
//               {currentView === 'tasks' && (
//                 <TaskList 
//                   key={tasksKey} // Ключ для принудительного обновления
//                   topics={topics} 
//                   tags={tags} 
//                   loading={loading}
//                   onUpdate={handleTaskUpdate} // Передаём функцию обновления
//                 />
//               )}
//               {currentView === 'generator' && (
//                 <WorksheetGenerator 
//                   topics={topics} 
//                   tags={tags}
//                 />
//               )}
//             </div>
//           </Content>
//         </Layout>
//       </Layout>
//     </ConfigProvider>
//   );
// }

// export default App;

