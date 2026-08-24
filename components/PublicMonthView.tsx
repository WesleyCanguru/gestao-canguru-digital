import React from 'react';
import { MonthDetail } from './MonthDetail';
import { MONTH_NAMES } from '../hooks/useEditorialData';
import { Client } from '../types';

export interface PublicMonthViewProps {
  clientId: string;
  clientName: string;
  clientLogoUrl?: string | null;
  mes: number;      // 1-12
  ano: number;
  visitorName: string;
  agencyId?: number | string;
  overrideClient?: Client | null;
}

export const PublicMonthView: React.FC<PublicMonthViewProps> = ({
  clientId,
  clientName,
  clientLogoUrl,
  mes,
  ano,
  visitorName,
  agencyId,
  overrideClient,
}) => {
  const selectedMonthName = MONTH_NAMES[(mes >= 1 && mes <= 12 ? mes - 1 : 0)] || 'Janeiro';

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3EF', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header minimalista — SEM nome de usuário logado */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #f0f0f0',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {clientLogoUrl ? (
            <img src={clientLogoUrl} alt={clientName} style={{ height: 28, objectFit: 'contain' }}/>
          ) : (
            <span style={{ color: '#13284D', fontSize: 15, fontWeight: 700 }}>{clientName}</span>
          )}
        </div>
        <p style={{ color: '#8A8F98', fontSize: 12, margin: 0 }}>
          Olá, <strong style={{ color: '#13284D' }}>{visitorName}</strong>
        </p>
      </div>

      {/* Calendário do mês — usando o MonthDetail isolado */}
      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
        <MonthDetail
          monthName={selectedMonthName}
          initialMonth={mes - 1}
          initialYear={ano}
          visitorName={visitorName}
          isPublicView={true}
          showShareButton={false}
          agencyId={agencyId}
          overrideClient={overrideClient}
        />
      </div>
    </div>
  );
};
