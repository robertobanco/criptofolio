import React from 'react';

interface TimeRangeSelectorProps {
  selectedRange: string;
  onSelectRange: (range: string) => void;
  className?: string;
}

const ranges = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '5D' },
  { key: '30d', label: '1M' },
  { key: '90d', label: '3M' },
  { key: '180d', label: '6M' },
  { key: '365d', label: '1A' },
  { key: '1095d', label: '3A' },
  { key: 'all', label: 'Máx' },
];

const TimeRangeButton: React.FC<{ range: { key: string, label: string }, isActive: boolean, onClick: (key: string) => void }> = ({ range, isActive, onClick }) => (
    <button
        onClick={() => onClick(range.key)}
        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
            isActive ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
        {range.label}
    </button>
);

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ selectedRange, onSelectRange, className = '' }) => {
  return (
    <div className={`flex items-center gap-1 sm:gap-2 flex-wrap justify-center ${className}`}>
      {ranges.map(range => (
        <TimeRangeButton 
            key={range.key}
            range={range}
            isActive={selectedRange === range.key}
            onClick={onSelectRange}
        />
      ))}
    </div>
  );
};

export default TimeRangeSelector;
