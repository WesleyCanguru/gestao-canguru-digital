
import React from 'react';
import { useAuth } from '../lib/supabase';

interface AgencyLogoProps {
  className?: string;
  useMultiply?: boolean;
}

export const AgencyLogo: React.FC<AgencyLogoProps> = ({ className = 'h-16', useMultiply = true }) => {
  const { logoUrl, agencyName } = useAuth();
  
  const src = logoUrl || "https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png";
  const alt = agencyName || "Canguru Digital";

  return (
    <div className="flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        className={`${className} w-auto object-contain ${useMultiply ? 'mix-blend-multiply' : ''}`}
      />
    </div>
  );
};
