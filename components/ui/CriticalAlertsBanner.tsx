
import React from 'react';
import type { CriticalAlert } from '../../types';
import Button from './Button';

interface CriticalAlertsBannerProps {
  alerts: CriticalAlert[];
  onDismiss: (asset: string) => void;
  isLoading: boolean;
}

const CriticalAlertsBanner: React.FC<CriticalAlertsBannerProps> = ({ alerts, onDismiss, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mb-6 bg-gray-700/50 p-3 rounded-lg text-center text-sm text-gray-300 animate-pulse">
        <i className="fas fa-spinner fa-spin mr-2"></i>
        Verificando se há notícias críticas sobre seus ativos...
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {alerts.map(alert => {
        const severityStyles = alert.severity === 'Crítica'
          ? 'border-red-500 bg-red-900/40 text-red-300'
          : 'border-yellow-500 bg-yellow-900/40 text-yellow-300';
        
        return (
          <div key={alert.asset} className={`border-l-4 p-4 rounded-r-lg ${severityStyles}`}>
            <div className="flex flex-col md:flex-row justify-between items-start gap-3">
              <div className="flex-grow flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-xl mt-1"></i>
                <div>
                  <h4 className="font-bold text-lg text-white">
                    Alerta de Risco {alert.severity} para {alert.asset}
                  </h4>
                  <p className="text-sm">{alert.summary}</p>
                  <a 
                    href={alert.source} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-indigo-400 hover:underline mt-1 inline-block"
                  >
                    Ver Fonte <i className="fas fa-external-link-alt ml-1"></i>
                  </a>
                </div>
              </div>
              <Button 
                onClick={() => onDismiss(alert.asset)} 
                variant="secondary"
                className="flex-shrink-0 w-full md:w-auto"
              >
                Marcar como Lido
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CriticalAlertsBanner;