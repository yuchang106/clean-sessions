// src/components/SessionFilter.tsx
'use client';

interface SessionFilterProps {
  projects: string[];
  selectedProject: string;
  onSelect: (project: string) => void;
}

export default function SessionFilter({ projects, selectedProject, onSelect }: SessionFilterProps) {
  if (projects.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onSelect('')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          selectedProject === ''
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        全部
      </button>
      {projects.map((project) => (
        <button
          key={project}
          onClick={() => onSelect(project)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedProject === project
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {project}
        </button>
      ))}
    </div>
  );
}
