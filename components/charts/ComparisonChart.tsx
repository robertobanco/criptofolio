
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import EmptyChartState from '../ui/EmptyChartState';

interface ComparisonChartProps {
  data: { date: string; [key: string]: number | string }[];
  selectedAssets: string[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', '#ffbb28'];

const CustomTooltip = ({ active, payload, label, startDate }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload]
        .filter(p => typeof p.value === 'number' && isFinite(p.value)) // Filter out invalid data
        .sort((a, b) => b.value - a.value);

    return (
      <div className="bg-gray-800 p-3 rounded-md border border-gray-700 shadow-lg text-sm">
        <p className="font-bold text-white mb-2">{new Date(label + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
        {startDate && <p className="text-xs text-gray-400 mb-2 -mt-2">Desempenho desde {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
        {sortedPayload.map((pld: any, index: number) => {
            const price = pld.payload[`${pld.name}_price`];
            return (
                <p key={index} style={{ color: pld.color }} className="whitespace-nowrap">
                    {pld.name}: 
                    <span className="float-right ml-4 font-semibold">
                        {pld.value.toFixed(2)}%
                        {typeof price === 'number' && isFinite(price) && ( // Guard price display
                            <span className="text-xs text-gray-400 ml-2 font-normal">
                                (R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                        )}
                    </span>
                </p>
            );
        })}
      </div>
    );
  }
  return null;
};


const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, selectedAssets }) => {
  const startDate = data?.[0]?.date;

  if (!data || data.length < 2 || selectedAssets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <EmptyChartState 
            message="Dados insuficientes para exibir a comparação."
            details="Selecione pelo menos um ativo com histórico de transações."
        />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
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
          tickFormatter={(value: number) => `${value}%`}
          domain={['auto', 'auto']}
          dx={-10}
          width={80}
        />
        <Tooltip content={<CustomTooltip startDate={startDate} />} />
        <Legend verticalAlign="top" height={36} />
        {selectedAssets.map((asset, index) => (
            <Line 
                key={asset} 
                type="monotone" 
                dataKey={asset} 
                stroke={COLORS[index % COLORS.length]} 
                strokeWidth={2}
                dot={false}
                connectNulls 
            />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default ComparisonChart;