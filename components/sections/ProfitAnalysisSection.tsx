import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import ProfitDistributionChart from '../charts/ProfitDistributionChart';
import type { ProfitAnalysisData, ProfitFilter, ChartProfitType } from '../../types';
import EmptyState from '../ui/EmptyState';
import { calculateProfitAnalysisMetrics } from '../../services/calculationService';
import Button from '../ui/Button';

interface ProfitAnalysisSectionProps {
  analysisData: ProfitAnalysisData[];
  totalCostBasis: number;
  onViewDetails: (symbol: string) => void;
  onNavigateToTransactions: () => void;
}

type SortConfig = {
    key: keyof ProfitAnalysisData;
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader: React.FC<{
    label: string;
    sortKey: keyof ProfitAnalysisData;
    requestSort: (key: keyof ProfitAnalysisData) => void;
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

const ProfitAnalysisSection: React.FC<ProfitAnalysisSectionProps> = ({ analysisData, totalCostBasis, onViewDetails, onNavigateToTransactions }) => {
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');
  const [chartProfitType, setChartProfitType] = useState<ChartProfitType>('totalProfit');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalProfit', direction: 'descending' });

  const { grandTotalProfit, totalRealizedProfit, totalUnrealizedProfit } = useMemo(() => {
    return analysisData.reduce((acc, asset) => {
        acc.grandTotalProfit += asset.totalProfit;
        acc.totalRealizedProfit += asset.realizedProfit;
        acc.totalUnrealizedProfit += asset.unrealizedProfit;
        return acc;
    }, { grandTotalProfit: 0, totalRealizedProfit: 0, totalUnrealizedProfit: 0 });
  }, [analysisData]);

  const grandTotalProfitPercentage = totalCostBasis > 0 ? (grandTotalProfit / totalCostBasis) * 100 : 0;

  const metrics = useMemo(() => calculateProfitAnalysisMetrics(analysisData), [analysisData]);

  const filteredData = useMemo(() => {
    if (profitFilter === 'profit') return analysisData.filter(a => a.totalProfit >= 0);
    if (profitFilter === 'loss') return analysisData.filter(a => a.totalProfit < 0);
    return analysisData;
  }, [analysisData, profitFilter]);

  const sortedData = useMemo(() => {
      let sortableItems = [...filteredData];
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
  }, [filteredData, sortConfig]);
  
  if (analysisData.length === 0) {
    return (
        <EmptyState
            icon="fa-chart-line"
            title="Análise de Lucros e Perdas"
            message="Esta seção ganha vida quando você tem transações. Adicione algumas compras e vendas para ver uma análise detalhada."
            actionText="Adicionar Transações"
            onAction={onNavigateToTransactions}
        />
    );
  }

  const requestSort = (key: keyof ProfitAnalysisData) => {
      let direction: 'ascending' | 'descending' = 'ascending';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
      }
      setSortConfig({ key, direction });
  };
  
  const chartTypeLabels: Record<ChartProfitType, string> = {
      totalProfit: 'Distribuição de Lucro Total',
      realizedProfit: 'Distribuição de Lucro Realizado',
      unrealizedProfit: 'Distribuição de Lucro Não Realizado',
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Lucro Total (Realizado + Não Realizado)">
            <span className={grandTotalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                R$ {grandTotalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-base font-medium ml-2">({grandTotalProfitPercentage.toFixed(2)}%)</span>
            </span>
        </Card>
        <Card title="Lucro Realizado">
            <span className={totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                R$ {totalRealizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </Card>
        <Card title="Lucro Não Realizado">
             <span className={totalUnrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                R$ {totalUnrealizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Total de Ativos" className="text-center">
          <span className="text-indigo-400">{metrics.totalAssets}</span>
        </Card>
        <Card title="Taxa de Sucesso (Realizado)" className="text-center">
          <span className={metrics.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.winRate.toFixed(2)}%
          </span>
        </Card>
        <Card title="Melhor Ativo" className="text-center">
            {metrics.bestAsset ? (
                <>
                    <span className="text-green-400">{metrics.bestAsset.symbol}</span>
                    <p className="text-xs text-gray-400 mt-1">R$ {metrics.bestAsset.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </>
            ) : <span className="text-gray-500">N/A</span>}
        </Card>
        <Card title="Pior Ativo" className="text-center">
             {metrics.worstAsset && metrics.worstAsset.totalProfit < 0 ? (
                <>
                    <span className="text-red-400">{metrics.worstAsset.symbol}</span>
                    <p className="text-xs text-gray-400 mt-1">R$ {metrics.worstAsset.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </>
            ) : <span className="text-gray-500">N/A</span>}
        </Card>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-center md:text-left">{chartTypeLabels[chartProfitType]}</h3>
            <div className="flex bg-gray-900 rounded-lg p-1 mt-2 md:mt-0">
                {(['totalProfit', 'realizedProfit', 'unrealizedProfit'] as ChartProfitType[]).map(type => (
                    <button
                        key={type}
                        onClick={() => setChartProfitType(type)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                            chartProfitType === type ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'
                        }`}
                    >
                       {type === 'totalProfit' ? 'Total' : type === 'realizedProfit' ? 'Realizado' : 'Não Realizado'}
                    </button>
                ))}
            </div>
        </div>
        <ProfitDistributionChart data={analysisData} dataKey={chartProfitType} onViewDetails={onViewDetails} />
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Detalhes de Lucro por Ativo</h3>
            <div className="flex gap-2 mt-2 md:mt-0">
                {(['all', 'profit', 'loss'] as ProfitFilter[]).map(filter => (
                     <Button
                        key={filter}
                        variant={profitFilter === filter ? 'primary' : 'secondary'}
                        onClick={() => setProfitFilter(filter)}
                        className="py-1 px-3 text-xs"
                    >
                       {filter === 'all' ? 'Todos' : filter === 'profit' ? 'Lucrativos' : 'Com Prejuízo'}
                    </Button>
                ))}
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 uppercase">
              <tr>
                <SortableHeader label="Ativo" sortKey="symbol" requestSort={requestSort} sortConfig={sortConfig} className="text-left" />
                <SortableHeader label="Preço Médio Compra" sortKey="averageBuyPrice" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader label="Preço Atual" sortKey="currentPrice" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader label="L/P Realizado" sortKey="realizedProfit" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader label="L/P Não Realizado" sortKey="unrealizedProfit" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader label="L/P Total" sortKey="totalProfit" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
                <SortableHeader label="Var. Total" sortKey="totalVariation" requestSort={requestSort} sortConfig={sortConfig} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map(asset => (
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
                  <td className="p-2 text-right">R$ {asset.averageBuyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right">R$ {asset.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${asset.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {asset.realizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${asset.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {asset.unrealizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${asset.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {asset.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-2 text-right font-semibold ${asset.totalVariation >= 0 ? 'text-green-400' : 'text-red-400'}`}>{asset.totalVariation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysisSection;