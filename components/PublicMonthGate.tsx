import React, { useState } from 'react';
import { MONTH_NAMES } from '../hooks/useEditorialData';

export interface PublicMonthGateProps {
  clientName: string;      // ex: "Next Safety"
  clientLogoUrl?: string | null;   // logo do cliente, se disponível
  mes: number;             // número do mês (1-12)
  ano: number;             // ano
  onEnter: (name: string) => void; // callback com o nome digitado
}

export const PublicMonthGate: React.FC<PublicMonthGateProps> = ({
  clientName,
  clientLogoUrl,
  mes,
  ano,
  onEnter,
}) => {
  const [name, setName] = useState('');
  const nomeMes = MONTH_NAMES[(mes >= 1 && mes <= 12 ? mes - 1 : 0)] || 'Janeiro';
  const nomeMesFormatado = `${nomeMes} de ${ano}`;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F3EF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '48px 40px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 2px 32px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        {/* Logo do cliente — se não houver, usar nome do cliente */}
        {clientLogoUrl ? (
          <img 
            src={clientLogoUrl} 
            alt={clientName}
            style={{ height: 36, objectFit: 'contain', marginBottom: 28, marginInline: 'auto' }}
          />
        ) : (
          <p style={{ color: '#13284D', fontSize: 16, fontWeight: 700, marginBottom: 28 }}>
            {clientName}
          </p>
        )}

        {/* Divisor */}
        <div style={{ 
          width: 40, 
          height: 2, 
          background: '#13284D', 
          borderRadius: 1,
          margin: '0 auto 28px' 
        }}/>

        <p style={{ 
          color: '#8A8F98', 
          fontSize: 11, 
          fontWeight: 700,
          letterSpacing: '0.12em', 
          textTransform: 'uppercase', 
          marginBottom: 10 
        }}>
          Mapa Editorial
        </p>

        <h1 style={{ 
          color: '#13284D', 
          fontSize: 28, 
          fontWeight: 700,
          lineHeight: 1.2, 
          marginBottom: 12 
        }}>
          {nomeMesFormatado}
        </h1>

        <p style={{ color: '#8A8F98', fontSize: 14, lineHeight: 1.6, marginBottom: 36 }}>
          Para visualizar e aprovar as publicações deste mês, informe seu nome.
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onEnter(name.trim())}
          placeholder="Seu nome"
          autoFocus
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: '1.5px solid #e5e7eb',
            fontSize: 15,
            color: '#13284D',
            outline: 'none',
            marginBottom: 12,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#13284D')}
          onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
        />

        <button
          onClick={() => name.trim() && onEnter(name.trim())}
          disabled={!name.trim()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 15,
            fontWeight: 700,
            background: name.trim() ? '#13284D' : '#e5e7eb',
            color: name.trim() ? '#ffffff' : '#9ca3af',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Entrar no calendário
        </button>

        <p style={{ color: '#c4c4c4', fontSize: 12, marginTop: 20, lineHeight: 1.5 }}>
          Seu nome ficará registrado com suas aprovações e comentários.
        </p>
      </div>

      {/* Rodapé discreto da Bolsa */}
      <p style={{ color: '#c4c4c4', fontSize: 11, marginTop: 24, letterSpacing: '0.05em' }}>
        Powered by <strong style={{ fontWeight: 600 }}>Bolsa</strong> · Canguru Digital
      </p>
    </div>
  );
};
