import React from 'react';
import { useAuth } from '../lib/supabase';
import { timeInViewerTz, tzShort, viewerTimezone } from '../lib/locales';

/**
 * Mostra, só para a equipe, o horário do post no fuso de quem está vendo quando ele é diferente do fuso do cliente.
 * Ex.: post da Everblock às 18:00 (Brasília) aparece "· 22:00 Paris" para quem está em Paris.
 */
export const ViewerTime: React.FC<{ dateKey?: string | null; time?: string | null; clientTz?: string | null; className?: string }> = ({ dateKey, time, clientTz, className }) => {
  const { userType } = useAuth();
  if (userType === 'client') return null;
  const viewer = viewerTimezone();
  const r = timeInViewerTz(dateKey, time, clientTz || 'America/Sao_Paulo', viewer);
  if (!r) return null;
  const shift = r.dayShift > 0 ? ' (+1d)' : r.dayShift < 0 ? ' (-1d)' : '';
  return (
    <span className={className ?? 'text-gray-400 font-medium'} title={`${time} em ${tzShort(clientTz || 'America/Sao_Paulo')} · ${r.time}${shift} em ${tzShort(viewer)} (seu horário)`}>
      · {r.time}{shift} {tzShort(viewer)}
    </span>
  );
};
