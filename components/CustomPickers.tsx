import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs(value || new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateSelect = (day: number) => {
    const newDate = currentMonth.date(day).format('YYYY-MM-DD');
    onChange(newDate);
    setIsOpen(false);
  };

  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = currentMonth.startOf('month').day();
  
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = currentMonth.date(i).format('YYYY-MM-DD');
    const isSelected = value === dateStr;
    const isToday = dayjs().format('YYYY-MM-DD') === dateStr;
    
    calendarCells.push(
      <button
        key={i}
        onClick={() => handleDateSelect(i)}
        className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-medium transition-all
          ${isSelected ? 'bg-brand-dark text-white shadow-md' : 
            isToday ? 'bg-gray-100 text-brand-dark font-bold' : 
            'text-gray-600 hover:bg-gray-100'}`}
      >
        {i}
      </button>
    );
  }

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold p-3 border border-black/[0.08] rounded-xl outline-none hover:border-brand-dark/30 focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all bg-white text-gray-700"
      >
        <span className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-gray-400" />
          {value ? dayjs(value).format('DD/MM/YYYY') : 'Selecionar data'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-black/[0.05] z-50 w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">
              {currentMonth.format('MMM YYYY').replace('.', '')}
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-[10px] text-center font-bold text-gray-400">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {calendarCells}
          </div>
        </div>
      )}
    </div>
  );
};

interface CustomTimePickerProps {
  value: string; // HH:mm
  onChange: (time: string) => void;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate time slots (every 30 mins)
  const timeSlots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hourStr = h.toString().padStart(2, '0');
      const minStr = m.toString().padStart(2, '0');
      timeSlots.push(`${hourStr}:${minStr}`);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold p-3 border border-black/[0.08] rounded-xl outline-none hover:border-brand-dark/30 focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all bg-white text-gray-700"
      >
        <span className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          {value || 'Selecionar horário'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-black/[0.05] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-2 grid grid-cols-2 gap-1">
            {timeSlots.map(time => {
              const isSelected = value === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => { onChange(time); setIsOpen(false); }}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all text-center
                    ${isSelected ? 'bg-brand-dark text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
