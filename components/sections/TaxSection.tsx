
import React, { useState, useMemo } from 'react';
import type { Transaction, AnnualTaxReport } from '../../types';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { calculateTaxReport } from '../../services/calculationService';

interface TaxSectionProps {
  transactions: Transaction[];
  onNavigateToTransactions: () => void;
}

const TaxSection: React.FC<TaxSectionProps> = ({ transactions, onNavigateToTransactions }) => {
  const transactionYears = useMemo(() => {
    const years = new Set(transactions.map(tx => new Date(tx.date).getFullYear()));
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(transactionYears[0] || new Date().getFullYear());

  const taxReport: AnnualTaxReport | null = useMemo(() => {
    const sellTransactions = transactions.filter(tx => tx.type === 'sell' && new Date(tx.date).getFullYear() === selectedYear);
    if (sellTransactions.length === 0) {
      return null;
    }
    return calculateTaxReport(transactions, selectedYear);
  }, [transactions, selectedYear]);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  if (transactionYears.length === 0) {
    return (
        <EmptyState
            icon="fa-file-invoice-dollar"
            title="Simulador de Imposto de Renda"
            message="Nenhuma transação encontrada. Adicione suas compras e vendas para que possamos calcular uma estimativa dos seus impostos."
            actionText="Adicionar Transações"
            onAction={onNavigateToTransactions}
        />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
        <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-white">Simulador de Imposto de Renda</h1>
            <p className="text-gray-400">Análise de imposto sobre ganhos de capital em criptomoedas (Regras do Brasil).</p>
        </div>
        <div className="flex items-center gap-2">
            <label htmlFor="year-select" className="font-semibold">Ano Fiscal:</label>
            <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
                {transactionYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                ))}
            </select>
        </div>
      </div>

      {!taxReport ? (
         <EmptyState
            icon="fa-search-dollar"
            title={`Nenhuma Venda em ${selectedYear}`}
            message="Não encontramos nenhuma transação de venda para o ano selecionado. A apuração de impostos é relevante apenas quando ocorrem vendas."
        />
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title={`Total de Imposto Devido em ${selectedYear}`}>
                    <span className="text-red-400">R$ {taxReport.totalTaxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </Card>
                <Card title="Total Vendido (Meses Tributáveis)">
                    <span className="text-indigo-400">R$ {taxReport.totalTaxableSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </Card>
                <Card title="Meses Acima da Isenção">
                    <span className="text-yellow-400">{taxReport.taxableMonthsCount}</span>
                </Card>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
                <h3 className="text-lg font-bold mb-4">Detalhamento Mensal de {selectedYear}</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="p-2 text-left">Mês</th>
                                <th className="p-2 text-right">Total Vendido (BRL)</th>
                                <th className="p-2 text-right">Lucro/Prejuízo Realizado (BRL)</th>
                                <th className="p-2 text-center">Status</th>
                                <th className="p-2 text-right">Imposto Devido (15%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxReport.monthlyReports.map(report => (
                                <tr key={report.month} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="p-2 font-bold">{monthNames[report.month - 1]}</td>
                                    <td className="p-2 text-right">R$ {report.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className={`p-2 text-right font-semibold ${report.realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        R$ {report.realizedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 text-center">
                                        {report.isExempt ? (
                                            <span className="px-2 py-1 text-xs font-semibold text-green-300 bg-green-900/50 rounded-full">Isento</span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-semibold text-yellow-300 bg-yellow-900/50 rounded-full">Tributável</span>
                                        )}
                                    </td>
                                    <td className={`p-2 text-right font-bold ${report.taxDue > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                        R$ {report.taxDue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
             <div className="text-center text-xs text-gray-500 p-2 bg-gray-900/50 rounded-md">
                <p><i className="fas fa-info-circle mr-1"></i>
                    <strong>Aviso Legal:</strong> Este é um simulador e não deve ser considerado como aconselhamento fiscal. As regras podem mudar. Consulte sempre um contador profissional para sua declaração de imposto de renda. O cálculo considera a isenção para vendas totais de criptoativos abaixo de R$ 35.000,00 por mês e uma alíquota de 15% sobre o ganho de capital para valores acima.
                </p>
            </div>
        </>
      )}
    </div>
  );
};

export default TaxSection;
