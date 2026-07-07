import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OneSignal from 'react-onesignal';

// Inicialização do OneSignal
OneSignal.init({
  appId: 'dba12918-fbf1-4b24-9376-2740c1fd0e4b',
  serviceWorkerParam: { scope: '/' },
  allowLocalhostAsSecureOrigin: true,
  notifyButton: { enable: false } as any,
}).then(() => {
  (window as any).__oneSignalInitialized = true;
}).catch(err => {
  // Captura o erro como um aviso não-bloqueante para não interromper a aplicação
  // nem falhar em ambientes de testes/desenvolvimento onde o domínio/webpush não estão configurados.
  console.warn('OneSignal não pôde ser inicializado completamente (pode estar pendente de configuração Web Push no painel OneSignal para este domínio):', err);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);