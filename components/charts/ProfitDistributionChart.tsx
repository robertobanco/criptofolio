import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import type { ProfitAnalysisData } from '../../types';
import EmptyChartState from '../ui/EmptyChartState';

interface ProfitDistributionChartProps {
  data: ProfitAnalysisData[];
  dataKey: keyof ProfitAnalysisData;
  onViewDetails?: (symbol: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800 p-3 rounded-md border border-gray-700 shadow-lg text-sm">
        <p className="font-bold text-white mb-2">{label}</p>
        <p className={`font-semibold ${data.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Lucro Total: 
          <span className="float-right ml-4">R$ {data.totalProfit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </p>
        <p className="text-gray-300">
          Lucro Realizado: 
          <span className="float-right ml-4">R$ {data.realizedProfit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </p>
        <p className="text-gray-300">
          Lucro Não Realizado: 
          <span className="float-right ml-4">R$ {data.unrealizedProfit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </p>
      </div>
    );
  }
  return null;
};


const ProfitDistributionChart: React.FC<ProfitDistributionChartProps> = ({ data, dataKey, onViewDetails }) => {
    const chartData = data
        .filter(asset => typeof asset[dataKey] === 'number' && (asset[dataKey] as number) !== 0)
        .sort((a,b) => (b[dataKey] as number) - (a[dataKey] as number));

  if (chartData.length === 0) {
    return <EmptyChartState message="Nenhum dado de lucro para exibir" />;
  }
  
  const handleBarClick = (data: any) => {
    if (onViewDetails && data && data.activePayload && data.activePayload.length > 0) {
        const symbol = data.activePayload[0].payload.symbol;
        onViewDetails(symbol);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart 
        data={chartData} 
        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
        onClick={handleBarClick}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
        <XAxis dataKey="symbol" stroke="#9ca3af" />
        <YAxis 
          stroke="#9ca3af"
          tickFormatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
          width={80}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
        />
        <Bar dataKey={dataKey} name="Lucro" cursor="pointer">
            {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={(entry[dataKey] as number) >= 0 ? '#4ade80' : '#f87171'} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProfitDistributionChart;