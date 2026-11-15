import React from 'react';
import { logError } from '../lib/errorLog';

/** Se uma tela quebrar, registra o erro e mostra uma mensagem em vez da página em branco. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { logError(error.message, `${error.stack || ''}\n${info.componentStack || ''}`); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-semibold text-gray-800">Algo deu errado nesta tela. · Something went wrong.</p>
          <p className="mt-2 text-sm text-gray-500">A equipe já foi avisada. · The team has been notified.</p>
          <button onClick={() => location.reload()} className="mt-5 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold">Recarregar · Reload</button>
        </div>
      </div>
    );
  }
}
