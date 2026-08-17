function App() {
  const handleCreate = () => {
    // Action handler placeholder for future functionality
    console.log('Crear clickeado')
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand-section">
          <h1 className="app-title">Fountain</h1>
        </div>
      </aside>

      <main className="main-content">
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
      </main>
    </div>
  )
}

export default App
