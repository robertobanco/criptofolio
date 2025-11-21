
import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, actionText, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center bg-gray-800/50 rounded-lg p-8 min-h-[400px]">
      <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mb-4">
        <i className={`fas ${icon} text-3xl text-indigo-400`}></i>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400 max-w-md mb-6">{message}</p>
      {actionText && onAction && (
        <Button onClick={onAction} variant="primary" icon="fa-plus">
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
