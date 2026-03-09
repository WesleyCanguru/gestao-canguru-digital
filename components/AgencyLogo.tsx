
import React from 'react';

interface AgencyLogoProps {
  className?: string;
  useMultiply?: boolean;
}

export const AgencyLogo: React.FC<AgencyLogoProps> = ({ className = 'h-16', useMultiply = true }) => {
  return (
    <div className="flex items-center justify-center">
      <img
        src="https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png"
        alt="Canguru Digital"
        className={`${className} w-auto object-contain ${useMultiply ? 'mix-blend-multiply' : ''}`}
      />
    </div>
  );
};
