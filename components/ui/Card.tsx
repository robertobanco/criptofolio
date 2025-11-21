
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 shadow-lg ${className}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      <div className="text-2xl font-semibold text-white">
        {children}
      </div>
    </div>
  );
};

export default Card;
