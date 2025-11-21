









import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, CryptoData, Toast } from '../../types';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Card from '../ui/Card';
import { calculatePortfolioHistory, calculateSimulatedPortfolioHistory } from '../../services/calculationService';
import { generateStrategyAllocation } from '../../services/geminiService';
import HistoricalComparisonView from '../views/HistoricalComparisonView';

type HistoricalPrices = Record<string, Record<string, number> | null>;

// Tipos para o estado que é gerenciado pelo componente pai
interface StrategyPlanState {
    prompt: string;
    generatedAllocation: Record<string, number> | null;
    simulationError: string | null;
}

interface StrategySimulatorSectionProps {
  transactions: Transaction[];
  historicalPrices: HistoricalPrices;
  cryptoData: CryptoData;
  cryptoMap: Record<string, string>;
  onUpdateHistory: (symbols?: string[], force?: boolean) => void;
  isUpdatingHistory: boolean;
  onNavigateToTransactions: () => void;
  onSymbolsChange: (symbols: string[]) => void;
  addToast: (message: string, type: Toast['type']) => void;
  geminiApiKey: string;
  // Props para o estado persistente
  plan: StrategyPlanState;
  setPlan: React.Dispatch<React.SetStateAction<StrategyPlanState>>;
}

const StrategySimulatorSection: React.FC<StrategySimulatorSectionProps> = ({
  transactions,
  historicalPrices,
  cryptoData,
  cryptoMap,
  onUpdateHistory,
  isUpdatingHistory,
  onNavigateToTransactions,
  onSymbolsChange,
  addToast,
  geminiApiKey,
  plan,
  setPlan
}) => {
  const { prompt, generatedAllocation, simulationError } = plan;
  const setPrompt = (value: string) => setPlan(p => ({ ...p, prompt: value }));
  const setGeneratedAllocation = (value: Record<string, number> | null) => setPlan(p => ({ ...p, generatedAllocation: value }));
  const setSimulationError = (value: string | null) => setPlan(p => ({ ...p, simulationError: value }));
  
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (generatedAllocation) {
        const symbols = Object.keys(generatedAllocation);
        onSymbolsChange(symbols);
    }
  }, [generatedAllocation, onSymbolsChange]);

  const handleGenerateStrategy = async () => {
    if (!geminiApiKey) {
        addToast("Chave de API do Gemini é necessária. Por favor, adicione-a nas Configurações.", 'error');
        return;
    }
    if (!prompt.trim()) {
      addToast('Por favor, descreva a estratégia que você deseja simular.', 'info');
      return;
    }
    setIsGenerating(true);
    setSimulationError(null);
    setGeneratedAllocation(null);

    const currentAssets = Array.from(new Set(transactions.map(t => t.asset))) as string[];
    const allPossibleAssets = Object.keys(cryptoMap);

    try {
      const responseText = await generateStrategyAllocation(geminiApiKey, prompt, currentAssets, allPossibleAssets);
      const allocation = JSON.parse(responseText.trim());

      const allocationRecord = allocation as Record<string, unknown>;
      // Fix: explicit generic for reduce to ensure 'sum' is treated as number.
      const total = Object.values(allocationRecord).reduce<number>((sum, val) => {
        const numericVal = Number(val);
        return sum + (Number.isNaN(numericVal) ? 0 : numericVal);
      }, 0);

      if (Math.abs(total - 100) > 1.5) {
        throw new Error('A IA gerou uma alocação cuja soma não é 100%.');
      }
      
      const numericAllocation: Record<string, number> = {};
      for (const key in allocation) {
        if (Object.prototype.hasOwnProperty.call(allocation, key)) {
          const numValue = Number(allocation[key]);
          if (!isNaN(numValue)) {
            numericAllocation[key] = numValue;
          }
        }
      }
      setGeneratedAllocation(numericAllocation);
      addToast('Estratégia gerada com sucesso! Simulação pronta.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      let friendlyMessage = `Falha ao gerar estratégia: ${message}`;
      if (message.includes("JSON")) {
          friendlyMessage = `A IA retornou uma resposta inválida. Tente refinar seu pedido.`;
      }
      setSimulationError(friendlyMessage);
      addToast(friendlyMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const { actualHistory, simulatedHistory, metrics } = useMemo(() => {
    if (!generatedAllocation || transactions.length === 0) {
      return { actualHistory: [], simulatedHistory: [], metrics: null };
    }
    const actual = calculatePortfolioHistory(transactions, historicalPrices as Record<string, Record<string, number>>, cryptoData);
    const simulated = calculateSimulatedPortfolioHistory(actual, generatedAllocation, historicalPrices as Record<string, Record<string, number>>);

    const getMetrics = (history: { date: string; marketValue: number }[], investedHistory: {investedValue: number}[]) => {
        if(history.length === 0) return { finalValue: 0, totalProfit: 0 };
        const finalValue = history[history.length - 1].marketValue;
        const finalInvested = investedHistory[investedHistory.length - 1].investedValue;
        const totalProfit = finalValue - finalInvested;
        return { finalValue, totalProfit };
    };
    
    const actualMetrics = getMetrics(actual.map(p => ({date: p.date, marketValue: p.marketValue})), actual);
    const simulatedMetrics = getMetrics(simulated, actual);

    return {
        actualHistory: actual,
        simulatedHistory: simulated,
        metrics: { actual: actualMetrics, simulated: simulatedMetrics }
    };
  }, [generatedAllocation, transactions, historicalPrices, cryptoData]);

  if (transactions.length === 0) {
    return (
        <EmptyState
            icon="fa-brain"
            title="Simulador de Estratégias (IA)"
            message="Adicione transações ao seu portfólio para começar a simular e comparar estratégias de investimento."
            actionText="Adicionar Transações"
            onAction={onNavigateToTransactions}
        />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
        <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-white">Simulador de Estratégias (IA)</h1>
            <p className="text-gray-400">Teste estratégias de investimento contra seu histórico real sem nenhum risco.</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <h3 className="text-lg font-bold mb-2">1. Descreva sua Estratégia</h3>
        <p className="text-sm text-gray-400 mb-4">
            Peça à IA para criar uma carteira. Ex: "Focada em DeFi", "Conservadora com 60% BTC", "Agressiva com moedas de IA".
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
            <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Uma carteira balanceada com BTC, ETH e SOL"
                className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                disabled={isGenerating}
            />
            <Button onClick={handleGenerateStrategy} disabled={isGenerating || !prompt.trim()} icon="fa-wand-magic-sparkles">
                {isGenerating ? 'Gerando...' : 'Gerar e Simular Estratégia'}
            </Button>
        </div>
        {simulationError && (
             <p className="text-sm text-red-400 mt-2">{simulationError}</p>
        )}
      </div>

      {generatedAllocation && (
        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl animate-fadeIn">
            <h3 className="text-lg font-bold mb-2">2. Estratégia Gerada pela IA</h3>
            <div className="flex flex-wrap gap-2 mb-4">
                {/* FIX: Safely cast values to numbers for sorting and formatting to prevent runtime errors. */}
                {Object.entries(generatedAllocation).sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0)).map(([asset, percent]) => (
                    <div key={asset} className="bg-gray-700 rounded-full px-3 py-1 text-sm">
                        <span className="font-bold">{asset}</span>: <span className="text-indigo-300">{Number(percent).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
            <p className="text-sm text-gray-400 mb-4">Abaixo está a comparação do desempenho histórico da sua carteira atual versus como ela teria se saído com a estratégia sugerida pela IA.</p>
            
            {isUpdatingHistory ? (
                 <div className="flex items-center justify-center h-[400px] text-gray-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Carregando dados históricos para a simulação...
                </div>
            ) : (
                <HistoricalComparisonView
                    actualHistory={actualHistory}
                    simulatedHistory={simulatedHistory}
                />
            )}
            
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <Card title="Valor Final (Atual)">
                        <span className="text-indigo-400">R$ {metrics.actual.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </Card>
                     <Card title="Valor Final (Simulado)">
                        <span className="text-green-400">R$ {metrics.simulated.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </Card>
                     <Card title="Lucro/Prejuízo (Atual)">
                        <span className={metrics.actual.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            R$ {metrics.actual.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </Card>
                    <Card title="Lucro/Prejuízo (Simulado)">
                        <span className={metrics.simulated.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            R$ {metrics.simulated.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </Card>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default StrategySimulatorSection;
