import React, { useState, useMemo } from 'react';
import type { AssetPerformance, ProfitAnalysisData, Transaction, CryptoData } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import PortfolioHistoryChart from '../charts/PortfolioHistoryChart';
import { calculateAssetHistory } from '../../services/calculationService';
import TimeRangeSelector from '../ui/TimeRangeSelector';

type HistoricalPrices = Record<string, Record<string, number> | null>;

interface AssetDetailViewProps {
  assetPerformance: AssetPerformance;
  profitAnalysis: ProfitAnalysisData;
  transactions: Transaction[];
  cryptoData: CryptoData;
  historicalPrices: HistoricalPrices;
  onBack: () => void;
}

const AssetDetailView: React.FC<AssetDetailViewProps> = ({
  assetPerformance,
  profitAnalysis,
  transactions,
  cryptoData,
  historicalPrices,
  onBack,
}) => {
  const [timeRange, setTimeRange] = useState('all');
  const { symbol, currentValue, totalQuantity, variation } = assetPerformance;
  const { averageBuyPrice, totalProfit } = profitAnalysis;
  
  const isOwned = totalQuantity > 0;

  const chartData = useMemo(() => {
    if (isOwned) {
        return calculateAssetHistory(symbol, transactions, historicalPrices as Record<string, Record<string, number>>, cryptoData);
    }
    
    const priceHistory = historicalPrices[symbol];
    if (!priceHistory) return [];

    return Object.entries(priceHistory)
        .map(([date, price]) => ({
            date,
            marketValue: price,
            investedValue: 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  }, [isOwned, symbol, transactions, historicalPrices, cryptoData]);

  const filteredHistoryData = useMemo(() => {
    if (timeRange === 'all' || chartData.length < 2) return chartData;
    
    const daysMap: { [key: string]: number } = {
      '1d': 1, '5d': 5, '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365, '1095d': 1095
    };
    const days = daysMap[timeRange];
    if (!days) return chartData;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const lastPointBeforeCutoff = chartData
        .slice()
        .reverse()
        .find(point => new Date(point.date) < cutoffDate);

    const recentPoints = chartData.filter(point => new Date(point.date) >= cutoffDate);
    
    return lastPointBeforeCutoff ? [lastPointBeforeCutoff, ...recentPoints] : recentPoints;
  }, [chartData, timeRange]);
  
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentPrice = cryptoData[symbol]?.price;
  
  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-baseline gap-3">
            <span>Detalhes de <span className="text-indigo-400">{symbol}</span></span>
            {currentPrice !== undefined && (
                <span className="text-lg font-medium text-gray-400">
                    (R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })})
                </span>
            )}
        </h2>
        <Button onClick={onBack} icon="fa-arrow-left" variant="secondary">
          Voltar
        </Button>
      </header>

      {isOwned && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card title="Valor Atual">
            R$ {currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Card>
            <Card title="Preço Médio Compra">
            R$ {averageBuyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Card>
            <Card title="Quantidade Total">
            {totalQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </Card>
            <Card title="Lucro/Prejuízo Total">
            <span className={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            </Card>
            <Card title="Variação Total">
                <span className={variation >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {variation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </span>
            </Card>
        </div>
      )}

      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <h3 className="text-lg font-bold">
                {isOwned ? `Evolução do Patrimônio em ${symbol}` : `Histórico de Preços de ${symbol}`}
            </h3>
            <TimeRangeSelector selectedRange={timeRange} onSelectRange={setTimeRange} />
        </div>
        <PortfolioHistoryChart data={filteredHistoryData} />
      </div>

      {isOwned && (
        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4">Histórico de Transações de {symbol}</h3>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase">
                <tr>
                    <th className="p-2 text-left w-24">Tipo</th>
                    <th className="p-2 text-left w-32">Data</th>
                    <th className="p-2 text-right w-32">Quantidade</th>
                    <th className="p-2 text-right w-32">Valor (BRL)</th>
                    <th className="p-2 text-right w-40">Total da Operação</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                {sortedTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-800/50">
                    <td className={`p-2 font-medium ${tx.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.type === 'buy' ? 'COMPRA' : 'VENDA'}
                    </td>
                    <td className="p-2 text-gray-400">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-2 text-right">{tx.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                    <td className="p-2 text-right">R$ {tx.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">R$ {(tx.quantity * tx.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default AssetDetailView;
