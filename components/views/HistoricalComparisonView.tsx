
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PortfolioHistoryPoint } from '../../types';
import EmptyChartState from '../ui/EmptyChartState';

interface HistoricalComparisonViewProps {
  actualHistory: PortfolioHistoryPoint[];
  simulatedHistory: { date: string; marketValue: number }[];
}

const CustomTooltip = ({ active, payload, label, firstPoint }: any) => {
  if (active && payload && payload.length && firstPoint) {
    const actualPayload = payload.find((p: any) => p.dataKey === 'actual');
    const suggestedPayload = payload.find((p: any) => p.dataKey === 'suggested');
    const investedPayload = payload.find((p: any) => p.dataKey === 'invested');

    const actualProfitLoss = actualPayload?.value != null && investedPayload?.value != null ? actualPayload.value - investedPayload.value : null;
    const suggestedProfitLoss = suggestedPayload?.value != null && investedPayload?.value != null ? suggestedPayload.value - investedPayload.value : null;
    
    const sortedPayload = [...payload].sort((a,b) => (b.value ?? 0) - (a.value ?? 0));

    const getChangePercent = (currentValue: number | null | undefined, startValue: number | null | undefined) => {
        if (currentValue != null && startValue != null && startValue > 0) {
            return ((currentValue / startValue) - 1) * 100;
        }
        return null;
    };
    
    const actualChange = getChangePercent(actualPayload?.value, firstPoint.actual);
    const suggestedChange = getChangePercent(suggestedPayload?.value, firstPoint.suggested);
    const investedChange = getChangePercent(investedPayload?.value, firstPoint.invested);

    const renderChange = (change: number | null) => {
        if (change === null || !isFinite(change)) return null;
        const color = change >= 0 ? 'text-green-400' : 'text-red-400';
        const sign = change > 0 ? '+' : '';
        return <span className={`text-xs ml-2 ${color}`}>({sign}{change.toFixed(2)}%)</span>;
    };


    return (
      <div className="bg-gray-800 p-3 rounded-md border border-gray-700 shadow-lg text-sm">
        <p className="font-bold text-white mb-2">{new Date(label + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
        {sortedPayload.map((pld: any, index: number) => {
            if (pld.value == null) return null; // Don't render lines for null values
            let change = null;
            if (pld.dataKey === 'actual') change = actualChange;
            if (pld.dataKey === 'suggested') change = suggestedChange;
            if (pld.dataKey === 'invested') change = investedChange;
            return (
                <p key={index} style={{ color: pld.color }}>
                    {pld.name}: 
                    <span className="float-right ml-4 font-semibold">
                        R$ {pld.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {renderChange(change)}
                    </span>
                </p>
            );
        })}
        
        <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
            {actualProfitLoss !== null && isFinite(actualProfitLoss) && (
                <p className={`font-semibold ${actualProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    L/P (Atual):
                    <span className="float-right ml-4">
                        R$ {actualProfitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </p>
            )}
            {suggestedProfitLoss !== null && isFinite(suggestedProfitLoss) && (
                 <p className={`font-semibold ${suggestedProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    L/P (Sugerida):
                    <span className="float-right ml-4">
                         R$ {suggestedProfitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </p>
            )}
        </div>
      </div>
    );
  }
  return null;
};

const TimeRangeButton: React.FC<{ range: string, label: string, isActive: boolean, onClick: (range: string) => void }> = ({ range, label, isActive, onClick }) => (
    <button
        onClick={() => onClick(range)}
        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
            isActive ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
        {label}
    </button>
);


const HistoricalComparisonView: React.FC<HistoricalComparisonViewProps> = ({ actualHistory, simulatedHistory }) => {
    const [timeRange, setTimeRange] = useState('all');

    const mergedData = useMemo(() => {
        const simulatedMap = new Map(simulatedHistory.map(p => [p.date, p.marketValue]));
        return actualHistory.map(p => ({
            date: p.date,
            actual: p.marketValue,
            suggested: simulatedMap.get(p.date) ?? null,
            invested: p.investedValue,
        }));
    }, [actualHistory, simulatedHistory]);

    const filteredData = useMemo(() => {
        if (timeRange === 'all' || mergedData.length < 2) return mergedData;
        
        const now = new Date();
        const daysMap: { [key: string]: number } = {
            '7': 7, '30': 30, '90': 90, '180': 180, '365': 365, '1095': 1095
        };
        const days = daysMap[timeRange];
        if (!days) return mergedData;

        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        // Include the first point before the cutoff to ground the chart
        const lastPointBeforeCutoff = mergedData
            .slice()
            .reverse()
            .find(point => point.date < cutoffDateStr);

        const recentPoints = mergedData.filter(point => point.date >= cutoffDateStr);
        
        return lastPointBeforeCutoff ? [lastPointBeforeCutoff, ...recentPoints] : recentPoints;

    }, [mergedData, timeRange]);
    
    const firstPoint = filteredData?.[0];

    if (filteredData.length < 2) {
        return (
             <div className="flex items-center justify-center h-[400px]">
                <EmptyChartState 
                    message="Dados insuficientes para a simulação."
                    details="Pode ser necessário um histórico de transações e preços mais longo para esta comparação."
                />
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                <TimeRangeButton range="7" label="7D" isActive={timeRange === '7'} onClick={setTimeRange} />
                <TimeRangeButton range="30" label="30D" isActive={timeRange === '30'} onClick={setTimeRange} />
                <TimeRangeButton range="90" label="90D" isActive={timeRange === '90'} onClick={setTimeRange} />
                <TimeRangeButton range="180" label="6M" isActive={timeRange === '180'} onClick={setTimeRange} />
                <TimeRangeButton range="365" label="1A" isActive={timeRange === '365'} onClick={setTimeRange} />
                <TimeRangeButton range="1095" label="3A" isActive={timeRange === '1095'} onClick={setTimeRange} />
                <TimeRangeButton range="all" label="Tudo" isActive={timeRange === 'all'} onClick={setTimeRange} />
            </div>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart
                    data={filteredData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#9ca3af"
                        tickFormatter={(str) => new Date(str + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        dy={10}
                    />
                    <YAxis
                        stroke="#9ca3af"
                        tickFormatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { notation: 'compact' })}`}
                        domain={['auto', 'auto']}
                        dx={-10}
                        width={80}
                    />
                    <Tooltip content={<CustomTooltip firstPoint={firstPoint} />} />
                    <Legend verticalAlign="top" height={36} />
                    <Line 
                        name="Carteira Atual" 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#818cf8" 
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line 
                        name="Carteira Sugerida" 
                        type="monotone" 
                        dataKey="suggested" 
                        stroke="#4ade80" 
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                    />
                    <Line 
                        name="Valor Investido" 
                        type="monotone" 
                        dataKey="invested" 
                        stroke="#facc15"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default HistoricalComparisonView;