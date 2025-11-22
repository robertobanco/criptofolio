import React, { useState, useMemo, useEffect } from 'react';
import Card from '../ui/Card';
import AllocationChart from '../charts/AllocationChart';
import PortfolioHistoryChart from '../charts/PortfolioHistoryChart';
import type { AssetPerformance, CryptoData, Transaction, ProfitAnalysisData, SentimentAnalysisResult } from '../../types';
import { calculatePortfolioHistory, calculateAssetHistory } from '../../services/calculationService';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import TimeRangeSelector from '../ui/TimeRangeSelector';
import SentimentAnalysisCard from '../ui/SentimentAnalysisCard';
import useLocalStorage from '../../hooks/useLocalStorage';

type HistoricalPrices = Record<string, Record<string, number>>;

interface DashboardSectionProps {
    performanceData: AssetPerformance[];
    profitAnalysisData: ProfitAnalysisData[];
    cryptoData: CryptoData;
    transactions: Transaction[];
    historicalPrices: HistoricalPrices;
    onUpdateHistory: (symbols?: string[], force?: boolean) => void;
    isUpdatingHistory: boolean;
    onViewDetails: (symbol: string) => void;
    onNavigateToTransactions: () => void;
    watchlist: string[];
    onGenerateSentiment: (assetSymbol: string) => void;
    isAnalyzingSentiment: boolean;
    sentimentResult: SentimentAnalysisResult | null;
    sentimentError: { asset: string; message: string; } | null;
    onShare: (text: string, title?: string) => void;
    isPrivacyMode: boolean;
}

type SortConfig = {
    key: keyof FormattedTableData;
    direction: 'ascending' | 'descending';
} | null;

type FormattedTableData = AssetPerformance & { change24h: number };

const useSortableData = (items: FormattedTableData[], config: SortConfig = { key: 'currentValue', direction: 'descending' }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(config);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key: keyof FormattedTableData) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};

const SortableHeader: React.FC<{
    label: string;
    sortKey: keyof FormattedTableData;
    requestSort: (key: keyof FormattedTableData) => void;
    sortConfig: SortConfig;
    className?: string;
}> = ({ label, sortKey, requestSort, sortConfig, className = '' }) => {
    const isActive = sortConfig?.key === sortKey;
    const directionIcon = sortConfig?.direction === 'ascending' ? 'fa-sort-up' : 'fa-sort-down';

    return (
        <th className={`p-2 cursor-pointer transition-colors hover:text-white ${className}`} onClick={() => requestSort(sortKey)}>
            {label}
            {isActive && <i className={`fas ${directionIcon} ml-2`}></i>}
        </th>
    );
};

const DashboardSection: React.FC<DashboardSectionProps> = ({
    performanceData,
    profitAnalysisData,
    cryptoData,
    transactions,
    historicalPrices,
    onUpdateHistory,
    isUpdatingHistory,
    onViewDetails,
    onNavigateToTransactions,
    watchlist,
    onGenerateSentiment,
    isAnalyzingSentiment,
    sentimentResult,
    sentimentError,
    onShare,
    isPrivacyMode,
}) => {
    const [filteredSymbol, setFilteredSymbol] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState('all');
    const [historyAsset, setHistoryAsset] = useState('TOTAL');

    const formatCurrency = (value: number) => {
        if (isPrivacyMode) return 'R$ ****';
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPercent = (value: number) => {
        if (isPrivacyMode) return '****%';
        return `${value.toFixed(2)}%`;
    };

    useEffect(() => {
        onUpdateHistory();
    }, [onUpdateHistory]);

    useEffect(() => {
        if (historyAsset && historyAsset !== 'TOTAL') {
            onUpdateHistory([historyAsset]);
        }
    }, [historyAsset, onUpdateHistory]);

    const totalPortfolioValue = useMemo(() => performanceData.reduce((sum, asset) => sum + asset.currentValue, 0), [performanceData]);

    const { total24hChangeValue, total24hChangePercent } = useMemo(() => {
        const changeValue = performanceData.reduce((acc, asset) => {
            const changePercent = cryptoData[asset.symbol]?.percent_change_24h;
            if (typeof changePercent === 'number') {
                const previousValue = asset.currentValue / (1 + changePercent / 100);
                const valueChange = asset.currentValue - previousValue;
                return acc + valueChange;
            }
            return acc;
        }, 0);

        const previousTotalValue = totalPortfolioValue - changeValue;
        const changePercent = previousTotalValue > 0 ? (changeValue / previousTotalValue) * 100 : 0;

        return { total24hChangeValue: changeValue, total24hChangePercent: changePercent };
    }, [performanceData, cryptoData, totalPortfolioValue]);

    const performers24h = useMemo(() => {
        const assetsWithChange = performanceData
            .map(asset => ({
                symbol: asset.symbol,
                change: cryptoData[asset.symbol]?.percent_change_24h,
            }))
            .filter(asset => typeof asset.change === 'number' && asset.change !== 0);

        if (assetsWithChange.length === 0) return { best: null, worst: null };
        assetsWithChange.sort((a, b) => b.change! - a.change!);

        return {
            best: assetsWithChange[0],
            worst: assetsWithChange.length > 1 ? assetsWithChange[assetsWithChange.length - 1] : null,
        };
    }, [performanceData, cryptoData]);

    const totalCostBasis = useMemo(() => performanceData.reduce((sum, asset) => sum + asset.totalInvested, 0), [performanceData]);

    const { realizedProfit, unrealizedProfit, totalProfit } = useMemo(() => {
        const totals = profitAnalysisData.reduce(
            (acc, asset) => {
                acc.realized += asset.realizedProfit;
                acc.unrealized += asset.unrealizedProfit;
                return acc;
            },
            { realized: 0, unrealized: 0 }
        );
        return {
            realizedProfit: totals.realized,
            unrealizedProfit: totals.unrealized,
            totalProfit: totals.realized + totals.unrealized
        };
    }, [profitAnalysisData]);

    const totalCostOfRemainingAssets = useMemo(() => profitAnalysisData.reduce((sum, asset) => {
        return sum + (asset.remainingQuantity * asset.averageBuyPrice);
    }, 0), [profitAnalysisData]);

    const unrealizedProfitPercentage = totalCostOfRemainingAssets > 0 ? (unrealizedProfit / totalCostOfRemainingAssets) * 100 : 0;

    const tableData = useMemo(() => {
        const allData = performanceData.map(asset => ({
            ...asset,
            change24h: cryptoData[asset.symbol]?.percent_change_24h ?? 0,
        }));
        if (filteredSymbol) {
            return allData.filter(asset => asset.symbol === filteredSymbol);
        }
        return allData;
    }, [performanceData, cryptoData, filteredSymbol]);

    const { items: sortedTableData, requestSort, sortConfig } = useSortableData(tableData);

    const portfolioHistory = useMemo(() => {
        if (historyAsset === 'TOTAL') {
            return calculatePortfolioHistory(transactions, historicalPrices, cryptoData);
        }
        return calculateAssetHistory(historyAsset, transactions, historicalPrices, cryptoData);
    }, [transactions, historicalPrices, historyAsset, cryptoData]);

    const filteredHistoryData = useMemo(() => {
        if (timeRange === 'all' || portfolioHistory.length < 2) return portfolioHistory;

        const daysMap: { [key: string]: number } = {
            '1d': 1, '5d': 5, '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365, '1095d': 1095
        };
        const days = daysMap[timeRange];
        if (!days) return portfolioHistory;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const lastPointBeforeCutoff = portfolioHistory
            .slice()
            .reverse()
            .find(point => new Date(point.date) < cutoffDate);

        const recentPoints = portfolioHistory.filter(point => new Date(point.date) >= cutoffDate);

        return lastPointBeforeCutoff ? [lastPointBeforeCutoff, ...recentPoints] : recentPoints;

    }, [portfolioHistory, timeRange]);

    const uniqueAssets = useMemo(() => Array.from(new Set(transactions.map(tx => tx.asset))).sort(), [transactions]);

    const assetsForSentimentAnalysis = useMemo(() => {
        const allSymbols = new Set([...performanceData.map(p => p.symbol), ...watchlist]);
        return Array.from(allSymbols).sort();
    }, [performanceData, watchlist]);

    if (transactions.length === 0) {
        return (
            <EmptyState
                icon="fa-rocket"
                title="Bem-vindo ao Cripto Control!"
                message="Parece que você ainda não adicionou nenhuma transação. Comece agora para ver a mágica acontecer."
                actionText="Adicionar Primeira Transação"
                onAction={onNavigateToTransactions}
            />
        );
    }

    const handlePieSliceClick = (data: any) => {
        if (data && data.name) {
            setFilteredSymbol(data.name);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card title="Valor Total do Portfólio">
                    <div className="flex justify-between items-baseline">
                        <span className="text-indigo-400">{formatCurrency(totalPortfolioValue)}</span>
                        <span className="text-sm font-normal text-gray-400">
                            {performanceData.length} {performanceData.length === 1 ? 'ativo' : 'ativos'}
                        </span>
                    </div>
                </Card>
                <Card title="Custo Base Total (Investido)">
                    <span className="text-indigo-400">{formatCurrency(totalCostBasis)}</span>
                </Card>
                <Card title="Lucro/Prejuízo Não Realizado">
                    <div className={unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        <span>{formatCurrency(unrealizedProfit)}</span>
                        <span className="text-base font-medium ml-2">({formatPercent(unrealizedProfitPercentage)})</span>
                    </div>
                    <div className="text-xs text-gray-400 font-normal mt-1 flex justify-between">
                        <span>
                            Total: <span className={totalProfit >= 0 ? 'text-green-400/80' : 'text-red-400/80'}>
                                {formatCurrency(totalProfit)}
                            </span>
                        </span>
                        <span>
                            Realizado: <span className={realizedProfit >= 0 ? 'text-green-400/80' : 'text-red-400/80'}>
                                {formatCurrency(realizedProfit)}
                            </span>
                        </span>
                    </div>
                </Card>
                <Card title="Variação em 24h">
                    <span className={total24hChangeValue >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {total24hChangeValue >= 0 ? '+' : ''}{formatCurrency(Math.abs(total24hChangeValue))}
                        <span className="text-sm ml-2">({formatPercent(total24hChangePercent)})</span>
                    </span>
                </Card>
                <Card title="Melhor Performance (24h)">
                    <div className="text-lg">
                        {performers24h.best ? (
                            <span className={performers24h.best.change! >= 0 ? 'text-green-400' : 'text-red-400'}>{performers24h.best.symbol} ({performers24h.best.change?.toFixed(2)}%)</span>
                        ) : <span className="text-gray-500">N/A</span>}
                    </div>
                </Card>
                <Card title="Pior Performance (24h)">
                    <div className="text-lg">
                        {performers24h.worst ? (
                            <span className={performers24h.worst.change! >= 0 ? 'text-green-400' : 'text-red-400'}>{performers24h.worst.symbol} ({performers24h.worst.change?.toFixed(2)}%)</span>
                        ) : <span className="text-gray-500">N/A</span>}
                    </div>
                </Card>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold">Evolução do Patrimônio</h3>
                        <select
                            value={historyAsset}
                            onChange={(e) => setHistoryAsset(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded p-1 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="TOTAL">Carteira Total</option>
                            {uniqueAssets.map(asset => (
                                <option key={asset} value={asset}>{asset}</option>
                            ))}
                        </select>
                        <Button
                            onClick={() => onUpdateHistory(historyAsset === 'TOTAL' ? undefined : [historyAsset], true)}
                            disabled={isUpdatingHistory}
                            variant="secondary"
                            className="py-1 px-2 text-xs"
                        >
                            {isUpdatingHistory ? (
                                <><i className="fas fa-spinner fa-spin"></i> Atualizando...</>
                            ) : (
                                <><i className="fas fa-sync"></i> Atualizar Dados do Gráfico</>
                            )}
                        </Button>
                    </div>
                    <TimeRangeSelector selectedRange={timeRange} onSelectRange={setTimeRange} />
                </div>
                <PortfolioHistoryChart data={filteredHistoryData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gray-800/50 rounded-lg p-4 shadow-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-lg font-bold">Desempenho dos Ativos</h3>
                        {filteredSymbol && (
                            <Button onClick={() => setFilteredSymbol(null)} variant="ghost" className="py-1 px-2 text-xs">
                                Mostrar Todos <i className="fas fa-times ml-1"></i>
                            </Button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-400 uppercase">
                                <tr>
                                    <SortableHeader label="Ativo" sortKey="symbol" requestSort={requestSort} sortConfig={sortConfig} className="text-left" />
                                    <SortableHeader label="Valor Atual" sortKey="currentValue" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                                    <SortableHeader label="Lucro/Prejuízo" sortKey="profitLoss" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                                    <SortableHeader label="Variação" sortKey="variation" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                                    <SortableHeader label="Variação 24h" sortKey="change24h" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTableData.map(asset => (
                                    <tr
                                        key={asset.symbol}
                                        className="border-b border-gray-700/50 hover:bg-gray-700/50 cursor-pointer transition-colors"
                                        onClick={() => onViewDetails(asset.symbol)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewDetails(asset.symbol)}
                                        aria-label={`Ver detalhes de ${asset.symbol}`}
                                    >
                                        <td className="p-2 font-bold">{asset.symbol}</td>
                                        <td className="p-2 text-right">{formatCurrency(asset.currentValue)}</td>
                                        <td className={`p-2 text-right font-semibold ${asset.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(asset.profitLoss)}</td>
                                        <td className={`p-2 text-right font-semibold ${asset.variation >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(asset.variation)}</td>
                                        <td className={`p-2 text-right font-semibold ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(asset.change24h)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <SentimentAnalysisCard
                        assets={assetsForSentimentAnalysis}
                        onAnalyze={onGenerateSentiment}
                        isLoading={isAnalyzingSentiment}
                        result={sentimentResult}
                        error={sentimentError}
                        onShare={onShare}
                    />
                    <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl flex flex-col flex-grow">
                        <h3 className="text-lg font-bold mb-4">Alocação do Portfólio</h3>
                        <AllocationChart
                            data={performanceData}
                            onSliceClick={handlePieSliceClick}
                            totalPortfolioValue={totalPortfolioValue}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSection;
