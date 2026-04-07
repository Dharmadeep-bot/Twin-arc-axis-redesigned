import React from 'react'
import ReactDOM from 'react-dom/client'
import StudyTimeline from './components/ScientificStudies/StudyTimeline'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <div style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
            <StudyTimeline isDarkMode={false} />
            <div style={{ marginTop: '40px' }}>
                <StudyTimeline isDarkMode={true} />
            </div>
        </div>
    </React.StrictMode>,
)
