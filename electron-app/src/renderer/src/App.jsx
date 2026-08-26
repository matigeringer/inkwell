import { useState } from 'react'
import Editor from './components/Editor'

function App() {
  const [view, setView] = useState('home') // 'home' | 'editor'
  const [activeDoc, setActiveDoc] = useState(null)

  const handleCreate = () => {
    setActiveDoc({
      id: Date.now().toString(),
      fileName: 'documento.md',
      filePath: null,
      content: ''
    })
    setView('editor')
  }

  const handleBackToHome = () => {
    setView('home')
  }

  if (view === 'editor') {
    return <Editor initialDoc={activeDoc} onBack={handleBackToHome} />
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand-section">
          <h1 className="app-title">Fountain</h1>
        </div>
      </aside>

      <main className="main-content">
        <div className="welcome-hero">
          <h2 className="welcome-title">Empezá a escribir</h2>

          <button className="btn-create" onClick={handleCreate} type="button">
            <span className="btn-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span>Crear</span>
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
