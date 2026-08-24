import React, { useState } from 'react';
import { Logo } from './Logo';
import { MONTH_NAMES } from '../hooks/useEditorialData';

interface NameGateScreenProps {
  monthNumber?: number; // 1-12
  year?: number;
  onEnter: (name: string) => void;
  clientName?: string;
}

export const NameGateScreen: React.FC<NameGateScreenProps> = ({
  monthNumber,
  year,
  onEnter,
  clientName
}) => {
  const [nameInput, setNameInput] = useState('');

  const currentMonthIdx = monthNumber && monthNumber >= 1 && monthNumber <= 12 
    ? monthNumber - 1 
    : new Date().getMonth();
  const nomeMes = MONTH_NAMES[currentMonthIdx] || 'Mês';
  const ano = year || new Date().getFullYear();

  const handleEnter = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem('visitor_name', trimmed);
    onEnter(trimmed);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F4F3EF',
        padding: '24px 16px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}
      >
        {/* Logo da Bolsa / Canguru Digital */}
        <div className="flex justify-center mb-8">
          <Logo size="small" />
        </div>

        {clientName && (
          <p style={{ color: '#13284D', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            {clientName}
          </p>
        )}

        <p
          style={{
            color: '#8A8F98',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8
          }}
        >
          MAPA EDITORIAL
        </p>

        <h1
          style={{
            color: '#13284D',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 8
          }}
        >
          {nomeMes} {ano}
        </h1>

        <p
          style={{
            color: '#8A8F98',
            fontSize: 14,
            marginBottom: 32,
            lineHeight: 1.6
          }}
        >
          Para visualizar e aprovar as publicações,
          <br />
          por favor, informe seu nome.
        </p>

        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
          placeholder="Seu nome completo"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            fontSize: 15,
            border: '1.5px solid #e5e7eb',
            outline: 'none',
            marginBottom: 16,
            fontFamily: 'Inter, sans-serif',
            color: '#13284D',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="button"
          onClick={handleEnter}
          disabled={!nameInput.trim()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            background: nameInput.trim() ? '#13284D' : '#e5e7eb',
            color: nameInput.trim() ? '#fff' : '#aaa',
            border: 'none',
            cursor: nameInput.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s'
          }}
        >
          Entrar no calendário
        </button>

        <p style={{ color: '#8A8F98', fontSize: 12, marginTop: 20 }}>
          Seu nome ficará registrado junto com suas aprovações e comentários.
        </p>
      </div>
    </div>
  );
};
