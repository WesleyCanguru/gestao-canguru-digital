import React from 'react';
import { PainelConteudo } from './PainelConteudo';

interface MasterEditorialMapProps {
  onBackToHome?: () => void;
  initialFilterStatus?: string;
  initialFilterDate?: string;
}

export const MasterEditorialMap: React.FC<MasterEditorialMapProps> = ({ 
  onBackToHome, 
  initialFilterStatus,
  initialFilterDate 
}) => {
  return (
    <PainelConteudo 
      onBackToHome={onBackToHome}
      initialFilterStatus={initialFilterStatus}
      initialFilterDate={initialFilterDate}
    />
  );
};

export default MasterEditorialMap;
