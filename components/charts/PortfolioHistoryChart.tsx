
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PortfolioHistoryPoint } from '../../types';
import EmptyChartState from '../ui/EmptyChartState';

interface PortfolioHistoryChartProps {
  data: PortfolioHistoryPoint[];
}

const CustomTooltip = ({ active, payload, label, hasInvestedData, firstPoint }: any) => {
  if (active && payload && payload.length && firstPoint) {
    const marketValuePayload = payload.find((p: any) => p.dataKey === 'marketValue');
    const investedValuePayload = hasInvestedData ? payload.find((p: any) => p.dataKey === 'investedValue') : null;

    if (!marketValuePayload) return null;

    const marketValue = marketValuePayload.value;
    const investedValue = investedValuePayload ? investedValuePayload.value : 0;
    const profitLoss = hasInvestedData ? marketValue - investedValue : null;

    const firstMarketValue = firstPoint.marketValue;
    const marketValueChange = firstMarketValue > 0 ? ((marketValue / firstMarketValue) - 1) * 100 : 0;
    
    let investedValueChange: number | null = null;
    if (investedValuePayload) {
        const firstInvestedValue = firstPoint.investedValue;
        investedValueChange = firstInvestedValue > 0 ? ((investedValue / firstInvestedValue) - 1) * 100 : 0;
    }
    
    const renderChange = (change: number | null) => {
        if (change === null || !isFinite(change)) return null;
        const color = change >= 0 ? 'text-green-400' : 'text-red-400';
        const sign = change > 0 ? '+' : '';
        return <span className={`text-xs ml-2 ${color}`}>({sign}{change.toFixed(2)}%)</span>;
    };
    
    return (
      <div className="bg-gray-800 p-3 rounded-md border border-gray-700 shadow-lg text-sm">
        <p className="font-bold text-white mb-2">{new Date(label + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
        
        <p style={{ color: marketValuePayload.stroke }}>
          {hasInvestedData ? 'Valor de Mercado' : 'Preço (BRL)'}:
          <span className="float-right ml-4">
            R$ {marketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {renderChange(marketValueChange)}
          </span>
        </p>

        {investedValuePayload && (
           <p style={{ color: investedValuePayload.stroke }}>
            Valor Investido:
            <span className="float-right ml-4">
              R$ {investedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {renderChange(investedValueChange)}
            </span>
          </p>
        )}

        {profitLoss !== null && (
            <>
                <div className="border-t border-gray-700 my-1"></div>
                <p className={`font-semibold ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    L/P:
                    <span className="float-right ml-4">
                        R$ {profitLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                 </p>
            </>
        )}
      </div>
    );
  }
  return null;
};

const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = ({ data }) => {
  const hasInvestedData = useMemo(() => data.some(p => p.investedValue > 0), [data]);
  const firstPoint = data?.[0];

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <EmptyChartState 
            message="Dados insuficientes para exibir o gráfico."
            details={hasInvestedData ? "Adicione duas ou mais transações em dias diferentes." : "Não foi possível carregar o histórico de preços."}
        />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorMarket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          domain={['dataMin', 'auto']}
          dx={-10}
          width={80}
        />
        <Tooltip content={<CustomTooltip hasInvestedData={hasInvestedData} firstPoint={firstPoint} />} />
        <Legend verticalAlign="top" height={36} />
        <Area type="monotone" dataKey="marketValue" name={hasInvestedData ? "Valor de Mercado" : "Preço (BRL)"} stroke="#4ade80" strokeWidth={2} fillOpacity={1} fill="url(#colorMarket)" />
        {hasInvestedData && <Area type="monotone" dataKey="investedValue" name="Valor Investido" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorInvested)" />}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default PortfolioHistoryChart;