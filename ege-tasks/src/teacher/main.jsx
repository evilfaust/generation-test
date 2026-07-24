import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp } from 'antd'
import '../App.css'
import App from '../App.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { installGlobalErrorHandlers } from '../shared/reportError'

installGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AntApp>
      <ErrorBoundary source="teacher-root">
        <App />
      </ErrorBoundary>
    </AntApp>
  </React.StrictMode>,
)
