import React from 'react';

/** Show an actionable error if React or the initial 3D effect cannot start. */
export default class BootErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#09131f',
          color: '#e6f1f7',
          fontFamily: 'system-ui,sans-serif',
          padding: 24,
          zIndex: 10000,
        }}
      >
        <section style={{ maxWidth: 620 }}>
          <p>KRONOX · ASTRAL SENTINELS</p>
          <h1>No se pudo iniciar Kronox</h1>
          <p>Ocurrió un error al abrir la aplicación. Puedes reintentar la carga.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 18px', font: 'inherit', cursor: 'pointer' }}
          >
            Reintentar
          </button>
          <details style={{ marginTop: 20 }}>
            <summary>Información para diagnóstico</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}
