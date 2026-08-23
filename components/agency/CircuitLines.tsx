import React from 'react';

interface CircuitLinesProps {
  className?: string;
  style?: React.CSSProperties;
}

export const CircuitLines: React.FC<CircuitLinesProps> = ({ className = '', style }) => (
  <svg
    className={`opacity-20 pointer-events-none ${className}`}
    style={style}
    width="180"
    height="100"
    viewBox="0 0 180 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="4" cy="80" r="3" stroke="white" strokeWidth="1.5" />
    <line x1="4" y1="80" x2="40" y2="80" stroke="white" strokeWidth="1" />
    <line x1="40" y1="80" x2="70" y2="55" stroke="white" strokeWidth="1" />
    <line x1="70" y1="55" x2="120" y2="55" stroke="white" strokeWidth="1" />
    <line x1="120" y1="55" x2="150" y2="30" stroke="white" strokeWidth="1" />
    <line x1="150" y1="30" x2="180" y2="30" stroke="white" strokeWidth="1" />
    <circle cx="180" cy="30" r="3" stroke="white" strokeWidth="1.5" />

    <circle cx="4" cy="95" r="3" stroke="white" strokeWidth="1.5" />
    <line x1="4" y1="95" x2="55" y2="95" stroke="white" strokeWidth="1" />
    <line x1="55" y1="95" x2="85" y2="70" stroke="white" strokeWidth="1" />
    <line x1="85" y1="70" x2="140" y2="70" stroke="white" strokeWidth="1" />
    <line x1="140" y1="70" x2="165" y2="48" stroke="white" strokeWidth="1" />
    <line x1="165" y1="48" x2="180" y2="48" stroke="white" strokeWidth="1" />
    <circle cx="180" cy="48" r="3" stroke="white" strokeWidth="1.5" />
  </svg>
);
