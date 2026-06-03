// src/components/MessageFilter.tsx
'use client';

interface FilterOption {
  key: string;
  label: string;
  count: number;
}

interface MessageFilterProps {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}

export default function MessageFilter({ options, selected, onSelect }: MessageFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onSelect(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected === opt.key
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label} ({opt.count})
        </button>
      ))}
    </div>
  );
}
