import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomDropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badgeLogoUrl?: string | null;
  badgeColor?: string;
  badgeInitials?: string;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  triggerIcon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuWidthClass?: string;
  align?: 'left' | 'right';
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  triggerIcon,
  placeholder = 'Selecionar...',
  className = '',
  buttonClassName = '',
  menuWidthClass = 'min-w-[220px]',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-white hover:bg-stone-50/90 border border-stone-200/90 shadow-2xs rounded-2xl text-xs font-bold text-stone-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/5 active:scale-[0.99] select-none ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {triggerIcon && <span className="text-stone-400 shrink-0">{triggerIcon}</span>}
          
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.badgeLogoUrl ? (
                <img
                  src={selectedOption.badgeLogoUrl}
                  alt={selectedOption.label}
                  className="w-4 h-4 rounded-md object-cover border border-stone-200/80 shrink-0"
                />
              ) : selectedOption.badgeColor ? (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedOption.badgeColor }}
                />
              ) : selectedOption.icon ? (
                <span className="shrink-0">{selectedOption.icon}</span>
              ) : null}
              <span className="truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-stone-400 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`text-stone-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-dark' : ''
          }`}
        />
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 ${menuWidthClass} max-w-xs bg-white/95 backdrop-blur-md rounded-2xl border border-stone-200/90 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-200 space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer select-none ${
                    isSelected
                      ? 'bg-stone-100 text-brand-dark font-bold'
                      : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    {option.badgeLogoUrl ? (
                      <img
                        src={option.badgeLogoUrl}
                        alt={option.label}
                        className="w-5 h-5 rounded-md object-cover border border-stone-200/80 shrink-0"
                      />
                    ) : option.badgeColor ? (
                      <span
                        className="w-3 h-3 rounded-full flex items-center justify-center font-bold text-[9px] text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: option.badgeColor }}
                      >
                        {option.badgeInitials ? option.badgeInitials.slice(0, 1) : ''}
                      </span>
                    ) : option.icon ? (
                      <span className="shrink-0 text-stone-500">{option.icon}</span>
                    ) : null}

                    <span className="truncate">{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-emerald-600 shrink-0 ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
