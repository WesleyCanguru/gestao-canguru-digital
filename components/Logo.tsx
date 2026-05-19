import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/supabase';

interface LogoProps {
  size?: 'small' | 'large';
  className?: string;
  showAgency?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'large', className = '', showAgency = true }) => {
  const { logoUrl, agencyName } = useAuth();
  const src = logoUrl || "https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png";
  const alt = agencyName || "Canguru Digital";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <span className={`font-serif italic tracking-tighter ${size === 'large' ? 'text-6xl' : 'text-3xl'} ${className.includes('text-') ? '' : 'text-brand-dark'}`}>
          Bolsa
        </span>
        {showAgency && (
          <div className="flex items-center gap-2 mt-1 opacity-40">
            <span className="text-[8px] uppercase tracking-[0.4em] font-bold">by</span>
            <img
              src={src}
              alt={alt}
              className="h-6 w-auto object-contain mix-blend-multiply"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};
