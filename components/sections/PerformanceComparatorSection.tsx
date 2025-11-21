



import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction, ProfitAnalysisData, ComparisonMode, CryptoData, Toast } from '../../types';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { calculateMultipleAssetHistoryNormalized, calculateMultipleAssetHistoryByCostBasis } from '../../services/calculationService';
import ComparisonChart from '../charts/ComparisonChart';
import useDebounce from '../../hooks/useDebounce';
import TimeRangeSelector from '../ui/TimeRangeSelector';
import StrategySimulatorSection from './StrategySimulatorSection';

type HistoricalPrices = Record<string, Record<string, number>>;

// Tipos para o estado que é gerenciado pelo App.tsx
interface ComparatorPlanState {
    selectedAssets: string[];
    timeRange: string;
    comparisonMode: ComparisonMode;
}
interface StrategyPlanState {
    prompt: string;
    generatedAllocation: Record<string, number> | null;
    simulationError: string | null;
}

interface PerformanceComparatorSectionProps {
  transactions: Transaction[];
  profitAnalysisData: ProfitAnalysisData[];
  historicalPrices: HistoricalPrices;
  onUpdateHistory: (symbols?: string[], force?: boolean) => void;
  isUpdatingHistory: boolean;
  onNavigateToTransactions: () => void;
  cryptoData: CryptoData;
  cryptoMap: Record<string, string>;
  addToast: (message: string, type: Toast['type']) => void;
  geminiApiKey: string;
  // Props para o estado persistente
  comparatorPlan: ComparatorPlanState;
  setComparatorPlan: React.Dispatch<React.SetStateAction<ComparatorPlanState>>;
  strategyPlan: StrategyPlanState;
  setStrategyPlan: React.Dispatch<React.SetStateAction<StrategyPlanState>>;
  onClear: () => void;
}

const PerformanceComparatorSection: React.FC<PerformanceComparatorSectionProps> = ({ 
    transactions,
    profitAnalysisData,
    historicalPrices, 
    onUpdateHistory, 
    isUpdatingHistory,
    onNavigateToTransactions,
    cryptoData,
    cryptoMap,
    addToast,
    geminiApiKey,
    comparatorPlan,
    setComparatorPlan,
    strategyPlan,
    setStrategyPlan,
    onClear,
}) => {
    const [activeTab, setActiveTab] = useState<'assets' | 'strategy'>('assets');
    const [strategyAssetSymbols, setStrategyAssetSymbols] = useState<string[]>([]);
    
    // Extrai o estado das props
    const { selectedAssets, timeRange, comparisonMode } = comparatorPlan;

    // FIX: Memoize the combined array of assets to provide a stable reference to useDebounce, preventing an infinite loop.
    const combinedAssets = useMemo(() => {
        return Array.from(new Set([...selectedAssets, ...strategyAssetSymbols]));
    }, [selectedAssets, strategyAssetSymbols]);

    const debouncedSelectedAssets = useDebounce(combinedAssets, 500);

    useEffect(() => {
        // Pré-carrega os dados históricos de todos os ativos ao entrar na seção pela primeira vez.
        // Isso melhora a experiência do usuário, pois os dados já estarão disponíveis quando ele selecionar os ativos.
        onUpdateHistory();
    }, [onUpdateHistory]);

    useEffect(() => {
        if (debouncedSelectedAssets.length > 0) {
            onUpdateHistory(debouncedSelectedAssets);
        }
    }, [debouncedSelectedAssets, onUpdateHistory]);

    const uniqueAssets = useMemo(() => Array.from(new Set(transactions.map(tx => tx.asset))).sort(), [transactions]);
    const allAssetsSelected = useMemo(() => uniqueAssets.length > 0 && selectedAssets.length === uniqueAssets.length, [selectedAssets, uniqueAssets]);

    const handleAssetToggle = (asset: string) => {
        const isSelected = selectedAssets.includes(asset);
        const newSelected = isSelected
            ? selectedAssets.filter(a => a !== asset)
            : [...selectedAssets, asset];
        setComparatorPlan(prev => ({...prev, selectedAssets: newSelected}));
    };

    const handleSelectAllToggle = () => {
        if (allAssetsSelected) {
            setComparatorPlan(prev => ({...prev, selectedAssets: []}));
        } else {
            setComparatorPlan(prev => ({...prev, selectedAssets: uniqueAssets}));
        }
    };
    
    const timeRangeInDays = useMemo(() => {
        const daysMap: { [key: string]: number } = {
            '1d': 1, '5d': 5, '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365, '1095d': 1095
        };
        return daysMap[timeRange]; // Returns undefined for 'all'
    }, [timeRange]);

    const chartData = useMemo(() => {
        if (comparisonMode === 'cost') {
             return calculateMultipleAssetHistoryByCostBasis(selectedAssets, profitAnalysisData, historicalPrices, timeRangeInDays);
        }
        // default to 'time'
        return calculateMultipleAssetHistoryNormalized(selectedAssets, historicalPrices, timeRangeInDays);
    }, [selectedAssets, profitAnalysisData, historicalPrices, timeRangeInDays, comparisonMode]);

    if (transactions.length === 0) {
        return (
            <EmptyState
                icon="fa-poll"
                title="Comparador de Desempenho"
                message="Adicione transações ao seu portfólio para poder comparar o desempenho dos seus ativos ou simular estratégias."
                actionText="Adicionar Transações"
                onAction={onNavigateToTransactions}
            />
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
                 <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Comparador de Desempenho</h2>
                        <p className="text-gray-400">Compare ativos ou simule o desempenho de estratégias de investimento.</p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button onClick={onClear} variant="secondary" icon="fa-eraser" className="py-1.5 px-3 text-sm">Limpar Análise</Button>
                        <Button
                            onClick={() => onUpdateHistory(debouncedSelectedAssets, true)}
                            disabled={isUpdatingHistory}
                            variant="secondary"
                            className="py-1.5 px-3 text-sm"
                        >
                            {isUpdatingHistory ? (
                                <><i className="fas fa-spinner fa-spin"></i> Atualizando...</>
                            ) : (
                                <><i className="fas fa-sync"></i> Atualizar Dados do Gráfico</>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="flex border-b border-gray-700 mb-6">
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                            activeTab === 'assets'
                                ? 'border-indigo-500 text-white'
                                : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                    >
                       <i className="fas fa-chart-line mr-2"></i> Comparar Ativos
                    </button>
                    <button
                        onClick={() => setActiveTab('strategy')}
                        className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                            activeTab === 'strategy'
                                ? 'border-indigo-500 text-white'
                                : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                    >
                        <i className="fas fa-brain mr-2"></i> Simulador de Estratégias IA
                    </button>
                </div>
                
                {activeTab === 'assets' && (
                    <div className="animate-fadeIn">
                        <p className="text-sm text-gray-400 mb-4">Selecione dois ou mais ativos abaixo para comparar suas performances. Escolha o tipo de análise para visualizar o desempenho de mercado ou o retorno do seu investimento pessoal.</p>
                        
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-md font-semibold">1. Selecione os Ativos</h3>
                                {uniqueAssets.length > 0 && (
                                    <Button onClick={handleSelectAllToggle} variant="ghost" className="py-1 px-2 text-xs">
                                        {allAssetsSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {uniqueAssets.map(asset => (
                                    <button
                                        key={asset}
                                        onClick={() => handleAssetToggle(asset)}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-all border-2 ${
                                            selectedAssets.includes(asset) 
                                                ? 'bg-indigo-600 text-white border-indigo-500' 
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600'
                                        }`}
                                    >
                                        {asset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-md font-semibold mb-2">2. Escolha o Tipo de Análise</h3>
                            <div className="flex bg-gray-900 rounded-lg p-1 max-w-md">
                                <button
                                    onClick={() => setComparatorPlan(p => ({...p, comparisonMode: 'time'}))}
                                    className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${comparisonMode === 'time' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}
                                >
                                    <i className="fas fa-chart-line mr-2"></i>Desempenho de Mercado
                                </button>
                                <button
                                    onClick={() => setComparatorPlan(p => ({...p, comparisonMode: 'cost'}))}
                                    className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${comparisonMode === 'cost' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}
                                >
                                    <i className="fas fa-wallet mr-2"></i>Meu Desempenho (vs. Custo)
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-md font-semibold mb-2 text-center">3. Selecione o Período</h3>
                            <TimeRangeSelector selectedRange={timeRange} onSelectRange={(r) => setComparatorPlan(p => ({...p, timeRange: r}))} />
                        </div>

                        <ComparisonChart data={chartData} selectedAssets={selectedAssets} />
                    </div>
                )}
                
                {activeTab === 'strategy' && (
                    <div className="animate-fadeIn">
                        <StrategySimulatorSection
                            transactions={transactions}
                            historicalPrices={historicalPrices}
                            cryptoData={cryptoData}
                            cryptoMap={cryptoMap}
                            onUpdateHistory={onUpdateHistory}
                            isUpdatingHistory={isUpdatingHistory}
                            onNavigateToTransactions={onNavigateToTransactions}
                            onSymbolsChange={setStrategyAssetSymbols}
                            addToast={addToast}
                            geminiApiKey={geminiApiKey}
                            plan={strategyPlan}
                            setPlan={setStrategyPlan}
                        />
                    </div>
                )}

            </div>
        </div>
    );
};

export default PerformanceComparatorSection;
