
import React, { useState, useEffect } from 'react';
import type { SentimentAnalysisResult } from '../../types';
import Button from './Button';

interface SentimentAnalysisCardProps {
  assets: string[];
  onAnalyze: (assetSymbol: string) => void;
  isLoading: boolean;
  result: SentimentAnalysisResult | null;
  error: { asset: string; message: string; } | null;
  onShare: (text: string, title?: string) => void;
}

const SentimentAnalysisCard: React.FC<SentimentAnalysisCardProps> = ({
  assets,
  onAnalyze,
  isLoading,
  result,
  error,
  onShare,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<string>('');

  useEffect(() => {
    // Pre-select the first asset in the list if none is selected
    if (!selectedAsset && assets.length > 0) {
      setSelectedAsset(assets[0]);
    }
  }, [assets, selectedAsset]);

  const handleAnalyzeClick = () => {
    if (selectedAsset) {
      onAnalyze(selectedAsset);
    }
  };

  const handleShareClick = () => {
    if (!result) return;
    const shareText = `Análise de Sentimento para ${result.asset}: ${result.sentiment}

Resumo:
${result.summary}

Pontos Positivos:
${result.positive_points.map(p => `• ${p}`).join('\n')}

Pontos Negativos:
${result.negative_points.map(p => `• ${p}`).join('\n')}
`;
    onShare(shareText, `Análise de Sentimento para ${result.asset}`);
  };

  const sentimentStyles = {
    Positivo: {
      icon: 'fa-arrow-trend-up',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
    },
    Neutro: {
      icon: 'fa-minus',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/50',
    },
    Negativo: {
      icon: 'fa-arrow-trend-down',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
    },
  };

  const normalizeSentiment = (sentiment?: string): keyof typeof sentimentStyles => {
      const s = (sentiment || '').toLowerCase();
      if (s.includes('positivo') || s.includes('positive') || s.includes('bullish')) return 'Positivo';
      if (s.includes('negativo') || s.includes('negative') || s.includes('bearish')) return 'Negativo';
      return 'Neutro';
  };

  const normalizedSentiment = result ? normalizeSentiment(result.sentiment) : 'Neutro';
  const styles = sentimentStyles[normalizedSentiment];

  const positivePoints = Array.isArray(result?.positive_points) ? result.positive_points : [];
  const negativePoints = Array.isArray(result?.negative_points) ? result.negative_points : [];

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl flex flex-col h-full">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold mb-1">Sentimento de Mercado (IA)</h3>
          <p className="text-xs text-gray-400 mb-4">Análise de notícias e redes sociais recentes.</p>
        </div>
        {result && result.asset === selectedAsset && !error && !isLoading && (
            <button
                onClick={handleShareClick}
                className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                aria-label="Compartilhar análise"
                title="Compartilhar ou Copiar"
            >
                <i className="fas fa-share-alt"></i>
            </button>
        )}
      </div>
      
      <div className="flex gap-2 mb-4">
        <select
          value={selectedAsset}
          onChange={(e) => setSelectedAsset(e.target.value)}
          disabled={isLoading || assets.length === 0}
          className="flex-grow bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
        >
          {assets.length === 0 ? (
            <option>Nenhum ativo</option>
          ) : (
            assets.map(asset => <option key={asset} value={asset}>{asset}</option>)
          )}
        </select>
        <Button onClick={handleAnalyzeClick} disabled={isLoading || !selectedAsset}>
          {isLoading ? (
            <><i className="fas fa-spinner fa-spin"></i> Analisando...</>
          ) : (
            'Analisar'
          )}
        </Button>
      </div>
      
      <div className={`flex-grow p-3 rounded-md transition-colors duration-300 ${result && result.asset === selectedAsset ? styles.bgColor : 'bg-gray-900/50'}`}>
        {isLoading && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <i className="fas fa-spinner fa-spin mr-2"></i> Buscando análise para {selectedAsset}...
          </div>
        )}

        {!isLoading && error && error.asset === selectedAsset && (
            <div className="flex flex-col items-center justify-center h-full text-center text-red-400">
                <i className="fas fa-exclamation-triangle fa-lg mb-2"></i>
                <p className="font-semibold text-sm">{error.message}</p>
            </div>
        )}
        
        {result && result.asset === selectedAsset && !error && (
            <div className="space-y-3 animate-fadeIn">
                <div className={`flex items-center gap-3 p-2 rounded-md border ${styles.borderColor}`}>
                    <i className={`fas ${styles.icon} fa-xl ${styles.color}`}></i>
                    <div>
                        <p className={`font-bold text-lg ${styles.color}`}>{normalizedSentiment}</p>
                        <p className="text-xs text-gray-300">{result.summary}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                        <h4 className="font-semibold text-green-400 mb-1"><i className="fas fa-plus-circle mr-1"></i> Pontos Positivos</h4>
                        <ul className="list-disc list-inside text-gray-300 space-y-1">
                            {positivePoints.map((pt, i) => <li key={`pos-${i}`}>{pt}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-400 mb-1"><i className="fas fa-minus-circle mr-1"></i> Pontos Negativos</h4>
                        <ul className="list-disc list-inside text-gray-300 space-y-1">
                           {negativePoints.map((pt, i) => <li key={`neg-${i}`}>{pt}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
        )}
        
        {!isLoading && !result && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <i className="fas fa-search-dollar fa-lg mb-2"></i>
            <p className="font-semibold text-sm">Selecione um ativo e clique em "Analisar".</p>
          </div>
        )}

        {result && result.asset !== selectedAsset && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <i className="fas fa-info-circle fa-lg mb-2"></i>
                <p className="font-semibold text-sm">Pronto para analisar {selectedAsset}.</p>
                <p className="text-xs">(Exibindo resultado anterior para {result.asset})</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SentimentAnalysisCard;
