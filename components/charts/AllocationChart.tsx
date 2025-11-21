
import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import type { AssetPerformance } from '../../types';
import EmptyChartState from '../ui/EmptyChartState';

interface AllocationChartProps {
  data: AssetPerformance[];
  totalPortfolioValue: number;
  onSliceClick?: (data: any) => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', '#ffbb28'];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const AllocationChart: React.FC<AllocationChartProps> = ({ data, totalPortfolioValue, onSliceClick }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = data
    .filter(d => d.currentValue > 0)
    .map(asset => ({
      name: asset.symbol,
      value: asset.currentValue,
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return <EmptyChartState message="Nenhum ativo para exibir" />;
  }

  const handleMouseEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={false}
              outerRadius={100}
              innerRadius={70}
              dataKey="value"
              nameKey="name"
              onClick={onSliceClick}
              cursor="pointer"
              activeIndex={activeIndex ?? -1}
              activeShape={renderActiveShape}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-400">Valor Total</span>
            <span className="text-xl font-bold text-white">
                R$ {totalPortfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto mt-4 pr-2">
        <ul className="space-y-2 text-sm">
          {chartData.map((entry, index) => {
            const percentage = totalPortfolioValue > 0 ? (entry.value / totalPortfolioValue) * 100 : 0;
            return (
              <li
                key={`legend-${index}`}
                onMouseEnter={() => handleMouseEnter(null, index)}
                onMouseLeave={handleMouseLeave}
                className={`p-2 rounded-md flex items-center justify-between cursor-pointer transition-colors ${activeIndex === index ? 'bg-gray-700/70' : 'bg-transparent'}`}
                role="button"
                aria-label={`Detalhes de ${entry.name}`}
                onClick={() => onSliceClick && onSliceClick(entry)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="font-semibold text-white">{entry.name}</span>
                </div>
                <div className="text-right">
                    <span className="font-mono text-gray-200">{percentage.toFixed(2)}%</span>
                    <p className="text-xs text-gray-400">R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default AllocationChart;
