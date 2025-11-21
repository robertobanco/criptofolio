
import React from 'react';

interface EmptyChartStateProps {
  message: string;
  details?: string;
}

const EmptyChartState: React.FC<EmptyChartStateProps> = ({ message, details }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-4">
      <i className="fas fa-chart-pie fa-2x mb-3 text-gray-600"></i>
      <p className="font-semibold">{message}</p>
      {details && <p className="text-sm mt-1">{details}</p>}
    </div>
  );
};

export default EmptyChartState;
