import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado en la aplicacion.',
    };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary atrapó un error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(140deg, #0d1117, #1c2430)',
            color: '#f5f7fa',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            boxSizing: 'border-box',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          }}
        >
          <div style={{ maxWidth: '620px', textAlign: 'center' }}>
            <h1 style={{ marginTop: 0, fontSize: '2rem' }}>Se produjo un error</h1>
            <p style={{ opacity: 0.9, lineHeight: 1.55 }}>
              La escena se detuvo para evitar una pantalla en blanco. Puedes recargar e intentar de nuevo.
            </p>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '12px',
                overflowX: 'auto',
              }}
            >
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                marginTop: '14px',
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              Recargar juego
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
