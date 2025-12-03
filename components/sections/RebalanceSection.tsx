


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AssetPerformance, RebalanceSuggestion, ChatMessage, Transaction, CryptoData, PortfolioHistoryPoint, ProfitAnalysisData, Toast } from '../../types';
import { calculateRebalanceSuggestions, calculatePortfolioHistory, calculateSimulatedPortfolioHistory } from '../../services/calculationService';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import AIRebalanceView from '../views/AIRebalanceView';
import HistoricalComparisonView from '../views/HistoricalComparisonView';
import AutoCompleteInput from '../ui/AutoCompleteInput';
import { startRebalanceChat, continueRebalanceChat } from '../../services/geminiService';
import { Chat } from '@google/genai';

// Declaration for the xlsx library loaded from CDN
declare const XLSX: any;

// Tipos para o estado que é gerenciado pelo App.tsx
interface RebalancePlanState {
  targetAllocations: Record<string, number>;
  lockedAllocations: Record<string, boolean>;
  anchoredAssets: Record<string, boolean>;
  capitalChange: string;
  aiAnalysisText: string | null;
}

type HistoricalPrices = Record<string, Record<string, number> | null>;
interface RebalanceSectionProps {
  performanceData: AssetPerformance[];
  profitAnalysisData: ProfitAnalysisData[];
  onNavigateToTransactions: () => void;
  cryptoMap: Record<string, string>;
  transactions: Transaction[];
  historicalPrices: HistoricalPrices;
  cryptoData: CryptoData;
  onUpdateHistory: (symbols?: string[], force?: boolean) => void;
  isUpdatingHistory: boolean;
  onSymbolsChange: (symbols: string[]) => void;
  addToast: (message: string, type: Toast['type']) => void;
  onOpenSettings: () => void;
  geminiApiKey: string;
  // Props para o estado persistente
  plan: RebalancePlanState;
  setPlan: React.Dispatch<React.SetStateAction<RebalancePlanState>>;
  onReset: () => void;
  onShare: (text: string, title?: string) => void;
}

const RebalanceSection: React.FC<RebalanceSectionProps> = ({
  performanceData,
  profitAnalysisData,
  onNavigateToTransactions,
  cryptoMap,
  transactions,
  historicalPrices,
  cryptoData,
  onUpdateHistory,
  isUpdatingHistory,
  onSymbolsChange,
  addToast,
  onOpenSettings,
  geminiApiKey,
  plan,
  setPlan,
  onReset,
  onShare
}) => {
  const { targetAllocations, lockedAllocations, anchoredAssets, capitalChange, aiAnalysisText } = plan;
  const setTargetAllocations = (updater: React.SetStateAction<Record<string, number>>) => setPlan(p => ({ ...p, targetAllocations: typeof updater === 'function' ? updater(p.targetAllocations) : updater }));
  const setLockedAllocations = (updater: React.SetStateAction<Record<string, boolean>>) => setPlan(p => ({ ...p, lockedAllocations: typeof updater === 'function' ? updater(p.lockedAllocations) : updater }));
  const setAnchoredAssets = (updater: React.SetStateAction<Record<string, boolean>>) => setPlan(p => ({ ...p, anchoredAssets: typeof updater === 'function' ? updater(p.anchoredAssets) : updater }));
  const setCapitalChange = (value: string) => setPlan(p => ({ ...p, capitalChange: value }));
  const setAiAnalysisText = (value: string | null) => setPlan(p => ({ ...p, aiAnalysisText: value }));

  const [editingInput, setEditingInput] = useState<{ symbol: string; value: string } | null>(null);
  const [orderedSymbols, setOrderedSymbols] = useState<string[]>([]);
  const [newAssetSymbol, setNewAssetSymbol] = useState('');
  const [capitalChangeError, setCapitalChangeError] = useState<string | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiChatSession, setAiChatSession] = useState<Chat | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);
  const [comparisonSuggestion, setComparisonSuggestion] = useState<Record<string, number> | null>(null);

  const { initialAllocations, totalPortfolioValue } = useMemo(() => {
    const totalValue = performanceData.reduce((sum, asset) => sum + asset.currentValue, 0);
    const initial: Record<string, number> = {};
    if (totalValue > 0) {
      performanceData.forEach(asset => {
        initial[asset.symbol] = (asset.currentValue / totalValue) * 100;
      });
    }
    return { initialAllocations: initial, totalPortfolioValue: totalValue };
  }, [performanceData]);

  useEffect(() => {
    // Apenas define as alocações iniciais se o plano estiver vazio
    if (Object.keys(targetAllocations).length === 0 && performanceData.length > 0) {
      setTargetAllocations(initialAllocations);
    }
  }, [JSON.stringify(initialAllocations), performanceData.length]);

  useEffect(() => {
    if (comparisonSuggestion) {
      onUpdateHistory(Object.keys(comparisonSuggestion));
    }
  }, [comparisonSuggestion, onUpdateHistory]);

  const targetKeysString = useMemo(() => Object.keys(targetAllocations).sort().join(','), [targetAllocations]);

  const markPlanAsManual = useCallback(() => {
    if (aiAnalysisText) {
      setAiAnalysisText(null);
    }
  }, [aiAnalysisText, setAiAnalysisText]);

  useEffect(() => {
    // This effect runs when assets are added/removed, establishing the initial visual order.
    const sorted = Object.keys(targetAllocations).sort((a, b) => (targetAllocations[b] ?? 0) - (targetAllocations[a] ?? 0));
    setOrderedSymbols(sorted);
  }, [targetKeysString]);

  useEffect(() => {
    const symbols = Object.keys(targetAllocations);
    onSymbolsChange(symbols);
  }, [targetAllocations, onSymbolsChange]);

  const combinedDataMap = useMemo(() => {
    const map = new Map<string, AssetPerformance>();

    // Add all assets that have performance data
    performanceData.forEach(p => map.set(p.symbol, p));

    // Add any assets from target allocations that are not already in the map (e.g., new assets)
    Object.keys(targetAllocations).forEach(symbol => {
      if (!map.has(symbol)) {
        map.set(symbol, {
          symbol,
          totalInvested: 0,
          currentValue: 0,
          profitLoss: 0,
          variation: 0,
          totalQuantity: 0,
        });
      }
    });

    return map;
  }, [performanceData, targetAllocations]);

  // FIX: Centralized logic to correctly calculate percentages for all asset types (anchored, locked).
  const { newTotalPortfolioValue, anchoredAssetsPercentage, lockedAssetsPercentage } = useMemo(() => {
    const parsedCapitalChange = parseFloat(capitalChange) || 0;
    const newTotal = totalPortfolioValue + parsedCapitalChange;

    const anchoredPercent = Object.keys(anchoredAssets)
      .filter(symbol => anchoredAssets[symbol])
      .reduce((sum, symbol) => {
        const assetValue = performanceData.find(p => p.symbol === symbol)?.currentValue ?? 0;
        if (newTotal > 0) {
          return sum + (assetValue / newTotal) * 100;
        }
        return sum;
      }, 0);

    const lockedPercent = Object.keys(lockedAllocations)
      .filter(symbol => lockedAllocations[symbol])
      .reduce((sum, symbol) => sum + (targetAllocations[symbol] || 0), 0);

    return {
      newTotalPortfolioValue: newTotal > 0 ? newTotal : 0,
      anchoredAssetsPercentage: anchoredPercent,
      lockedAssetsPercentage: lockedPercent,
    };
  }, [capitalChange, totalPortfolioValue, anchoredAssets, lockedAllocations, performanceData, targetAllocations]);

  // FIX: This effect now correctly auto-balances unlocked assets by considering both anchored and locked percentages.
  useEffect(() => {
    const budgetForUnlocked = 100 - anchoredAssetsPercentage - lockedAssetsPercentage;

    if (budgetForUnlocked < 0 || Object.values(targetAllocations).length === 0) return;

    const unlockedSymbols = Object.keys(targetAllocations)
      .filter(symbol => !lockedAllocations[symbol] && !anchoredAssets[symbol]);

    if (unlockedSymbols.length === 0) return;

    const currentSumOfUnlocked = unlockedSymbols.reduce((sum, symbol) => sum + (targetAllocations[symbol] || 0), 0);

    if (Math.abs(currentSumOfUnlocked - budgetForUnlocked) < 0.01) return;

    setTargetAllocations(prev => {
      const next = { ...prev };
      const scaleFactor = currentSumOfUnlocked > 0 ? budgetForUnlocked / currentSumOfUnlocked : 0;

      if (currentSumOfUnlocked === 0 && budgetForUnlocked > 0) {
        const share = budgetForUnlocked / unlockedSymbols.length;
        unlockedSymbols.forEach(symbol => { next[symbol] = share; });
      } else {
        unlockedSymbols.forEach(symbol => {
          next[symbol] = Math.max(0, (prev[symbol] || 0) * scaleFactor);
        });
      }
      return next;
    });

  }, [anchoredAssetsPercentage, lockedAssetsPercentage, lockedAllocations, anchoredAssets, targetKeysString]);


  const suggestions: RebalanceSuggestion[] = useMemo(() => {
    if (Object.keys(targetAllocations).length === 0) return [];

    const parsedCapitalChange = parseFloat(capitalChange) || 0;
    const fullPerformanceData: AssetPerformance[] = Array.from(combinedDataMap.values());
    return calculateRebalanceSuggestions(fullPerformanceData, targetAllocations, cryptoData, parsedCapitalChange, anchoredAssets);
  }, [combinedDataMap, targetAllocations, totalPortfolioValue, cryptoData, capitalChange, anchoredAssets]);


  // FIX: Updated allocation change handler to use the correct budget calculation.
  const handleAllocationChange = (changedSymbol: string, strValue: string) => {
    markPlanAsManual();
    if (lockedAllocations[changedSymbol] || anchoredAssets[changedSymbol]) return;

    const userInput = parseFloat(strValue);
    if (isNaN(userInput) && strValue !== '' && strValue !== '-') return;

    setTargetAllocations(prev => {
      const budgetForUnlocked = 100 - anchoredAssetsPercentage - lockedAssetsPercentage;
      let newPercentage = isNaN(userInput) ? (prev[changedSymbol] ?? 0) : userInput;

      newPercentage = Math.max(0, Math.min(newPercentage, budgetForUnlocked));

      const next = { ...prev };
      next[changedSymbol] = newPercentage;

      const otherUnlockedSymbols = Object.keys(next).filter(s => !lockedAllocations[s] && !anchoredAssets[s] && s !== changedSymbol);

      if (otherUnlockedSymbols.length > 0) {
        const previousSumOfOthers = otherUnlockedSymbols.reduce((sum, s) => sum + (prev[s] ?? 0), 0);
        const newBudgetForOthers = budgetForUnlocked - newPercentage;

        if (Math.abs(previousSumOfOthers) < 0.001) {
          const split = newBudgetForOthers > 0 ? newBudgetForOthers / otherUnlockedSymbols.length : 0;
          otherUnlockedSymbols.forEach(s => { next[s] = Math.max(0, split); });
        } else {
          const scaleFactor = newBudgetForOthers > 0 ? newBudgetForOthers / previousSumOfOthers : 0;
          otherUnlockedSymbols.forEach(s => { next[s] = Math.max(0, (prev[s] ?? 0) * scaleFactor); });
        }
      }

      const finalUnlockedSum = Object.keys(next)
        .filter(s => !lockedAllocations[s] && !anchoredAssets[s])
        .reduce((sum, s) => sum + (next[s] || 0), 0);

      if (Math.abs(finalUnlockedSum - budgetForUnlocked) > 0.01 && finalUnlockedSum > 0) {
        const scale = budgetForUnlocked / finalUnlockedSum;
        Object.keys(next).forEach(s => {
          if (!lockedAllocations[s] && !anchoredAssets[s]) {
            next[s] *= scale;
          }
        });
      }
      return next;
    });
  };

  const reSortAndSetOrder = useCallback(() => {
    setOrderedSymbols(prevOrder => {
      const sorted = [...prevOrder].sort((a, b) => (targetAllocations[b] ?? 0) - (targetAllocations[a] ?? 0));
      return sorted;
    });
  }, [targetAllocations]);

  const handleReset = () => {
    onReset();
    addToast("Plano de rebalanceamento foi resetado para a posição atual.", "info");
  };

  const handleToggleLock = (symbol: string) => {
    setAnchoredAssets(prev => ({ ...prev, [symbol]: false })); // Can't be anchored and locked
    setLockedAllocations(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const handleToggleAnchor = (symbol: string) => {
    setLockedAllocations(prev => ({ ...prev, [symbol]: false })); // Can't be locked and anchored
    setAnchoredAssets(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const handleAddAsset = () => {
    markPlanAsManual();
    const symbol = newAssetSymbol.toUpperCase().trim();
    if (!symbol) return;
    if (!cryptoMap[symbol]) { return; }
    if (targetAllocations[symbol] !== undefined) { return; }

    setTargetAllocations(prev => ({ ...prev, [symbol]: 0 }));
    setNewAssetSymbol('');
  };

  const handleRemoveAsset = (symbolToRemove: string) => {
    markPlanAsManual();
    if (lockedAllocations[symbolToRemove] || anchoredAssets[symbolToRemove]) return;

    setTargetAllocations(prev => {
      const removedPercent = prev[symbolToRemove] ?? 0;
      const { [symbolToRemove]: _, ...rest } = prev;

      const unlockedSymbols = Object.keys(rest).filter(s => !lockedAllocations[s] && !anchoredAssets[s]);
      const totalUnlockedPercent = unlockedSymbols.reduce((sum, s) => sum + rest[s], 0);

      if (totalUnlockedPercent > 0) {
        unlockedSymbols.forEach(s => {
          const proportion = rest[s] / totalUnlockedPercent;
          rest[s] += removedPercent * proportion;
        });
      } else if (unlockedSymbols.length > 0) {
        const share = removedPercent / unlockedSymbols.length;
        unlockedSymbols.forEach(s => { rest[s] += share; });
      }

      return rest;
    });
  };

  // FIX: This now calculates the correct total by accounting for dynamic anchored percentages.
  const correctTotalTargetPercentage = useMemo(() => {
    let total = 0;
    Object.keys(targetAllocations).forEach(symbol => {
      if (anchoredAssets[symbol]) {
        const assetValue = performanceData.find(p => p.symbol === symbol)?.currentValue ?? 0;
        if (newTotalPortfolioValue > 0) {
          total += (assetValue / newTotalPortfolioValue) * 100;
        }
      } else {
        total += targetAllocations[symbol] || 0;
      }
    });
    return total;
  }, [targetAllocations, anchoredAssets, performanceData, newTotalPortfolioValue]);

  const getRebalanceContext = (): { context: string, locked: Record<string, number> } => {
    const context = JSON.stringify({
      currentDate: new Date().toISOString().split('T')[0],
      performanceData: performanceData,
      profitAnalysisData: profitAnalysisData,
      historicalAssetValues: historicalPrices,
    }, null, 2);

    const locked = Object.entries(lockedAllocations)
      .filter(([, isLocked]) => isLocked)
      .reduce((acc, [symbol]) => {
        acc[symbol] = targetAllocations[symbol];
        return acc;
      }, {} as Record<string, number>);

    return { context, locked };
  };

  const handleOpenAiModal = async () => {
    if (!geminiApiKey) {
      addToast("Chave de API do Gemini é necessária. Por favor, adicione-a nas Configurações.", "error");
      onOpenSettings();
      return;
    }
    setIsAiModalOpen(true);
    setIsAiThinking(true);
    const { context, locked } = getRebalanceContext();
    const chat = startRebalanceChat(geminiApiKey, context, locked, Object.keys(cryptoMap));
    setAiChatSession(chat);

    if (chat) {
      const initialResponse = await continueRebalanceChat(chat, "Olá, por favor, se apresente e me faça a pergunta sobre meu objetivo de investimento.");
      setAiChatHistory([{ role: 'model', parts: [{ text: initialResponse }] }]);
    } else {
      setAiChatHistory([{ role: 'model', parts: [{ text: "Erro ao iniciar a sessão de IA. A chave de API não está configurada no ambiente do aplicativo." }] }]);
    }
    setIsAiThinking(false);
  };

  const handleSendAiMessage = async (message: string) => {
    if (!aiChatSession || isAiThinking) return;
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
    setAiChatHistory(prev => [...prev, userMessage]);
    setIsAiThinking(true);
    const response = await continueRebalanceChat(aiChatSession, message);
    const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response }] };
    setAiChatHistory(prev => [...prev, modelMessage]);
    setIsAiThinking(false);
  };

  const handleApplyAiSuggestion = (suggestion: Record<string, number>, analysisText: string) => {
    const newAllocations: Record<string, number> = {};
    const allSymbols = Array.from(new Set([...performanceData.map(p => p.symbol), ...Object.keys(suggestion)]));

    allSymbols.forEach(symbol => {
      newAllocations[symbol] = suggestion[symbol] ?? 0;
    });

    setTargetAllocations(newAllocations);
    setAiAnalysisText(analysisText);
    setIsAiModalOpen(false);
  };

  const handleExportPlan = () => {
    if (suggestions.length === 0 && Object.keys(targetAllocations).length === 0) return;

    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Plano de Ação ---
    const planData = suggestions.map(s => ({
      'Ação': s.action === 'buy' ? 'COMPRAR' : 'VENDER',
      'Ativo': s.symbol,
      'Quantidade a Negociar': s.quantity,
      'Valor Estimado (BRL)': s.amountBRL,
      'Alocação Atual (%)': s.currentAllocation / 100,
      'Alocação Alvo (%)': s.targetAllocation / 100,
      'Valor Atual (BRL)': s.currentValue,
      'Valor Alvo (BRL)': s.targetValue,
    }));

    const wsPlan = XLSX.utils.json_to_sheet(planData);
    wsPlan['!cols'] = [
      { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    planData.forEach((row, index) => {
      const r = index + 2;
      const cell = (col: string) => wsPlan[`${col}${r}`];
      cell('C').z = '0.00000000'; // Quantity
      cell('D').z = '"R$" #,##0.00'; // BRL
      cell('E').z = '0.00%'; // %
      cell('F').z = '0.00%'; // %
      cell('G').z = '"R$" #,##0.00'; // BRL
      cell('H').z = '"R$" #,##0.00'; // BRL
    });
    XLSX.utils.book_append_sheet(wb, wsPlan, 'Plano de Ação');

    // --- Sheet 2: Resumo e Carteira Atual ---
    const summaryData: (string | number | Date)[][] = [];
    summaryData.push(['Resumo do Plano de Rebalanceamento']);
    summaryData.push([]);
    summaryData.push(['Data do Plano', new Date()]);
    summaryData.push(['Valor Total da Carteira', totalPortfolioValue]);
    summaryData.push(['Origem do Plano', aiAnalysisText ? 'Cripto Control AI' : 'Manual']);
    summaryData.push([]);

    if (aiAnalysisText) {
      summaryData.push(['Análise da IA']);
      aiAnalysisText.split('\n').forEach(line => summaryData.push([line || ' '])); // Add empty line for spacing
      summaryData.push([]);
    }

    const compositionRowStart = summaryData.length;
    summaryData.push(['Composição da Carteira Atual']);
    summaryData.push(['Ativo', 'Valor Atual (BRL)', 'Alocação Atual (%)']);

    performanceData.sort((a, b) => b.currentValue - a.currentValue).forEach(asset => {
      summaryData.push([
        asset.symbol,
        asset.currentValue,
        (initialAllocations[asset.symbol] ?? 0) / 100
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData, { cellDates: true });
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }];
    wsSummary['B3'].z = 'dd/mm/yyyy hh:mm:ss';
    wsSummary['B4'].z = '"R$" #,##0.00';

    performanceData.forEach((_, index) => {
      const r = compositionRowStart + 2 + index + 1;
      wsSummary[`B${r}`].z = '"R$" #,##0.00';
      wsSummary[`C${r}`].z = '0.00%';
    });

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo e Carteira');

    // --- Generate file ---
    XLSX.writeFile(wb, 'Plano_Rebalanceamento_Crypto.xlsx');
  };

  const handleCompareSuggestion = (suggestion: Record<string, number>) => {
    setComparisonSuggestion(suggestion);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const { actualHistory, simulatedHistory } = useMemo(() => {
    if (!comparisonSuggestion || transactions.length === 0) {
      return { actualHistory: [], simulatedHistory: [] };
    }
    const actual = calculatePortfolioHistory(transactions, historicalPrices as HistoricalPrices, cryptoData);
    const simulated = calculateSimulatedPortfolioHistory(actual, comparisonSuggestion, historicalPrices as HistoricalPrices);
    return { actualHistory: actual, simulatedHistory: simulated };
  }, [comparisonSuggestion, transactions, historicalPrices, cryptoData]);

  const maxWithdrawal = useMemo(() => {
    return performanceData
      .filter(p => !anchoredAssets[p.symbol] && !lockedAllocations[p.symbol])
      .reduce((sum, asset) => sum + asset.currentValue, 0);
  }, [performanceData, anchoredAssets, lockedAllocations]);

  const handleCapitalChangeInput = (value: string) => {
    setCapitalChangeError(null);
    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
      const numericValue = parseFloat(value);

      if (numericValue < 0 && Math.abs(numericValue) > maxWithdrawal) {
        setCapitalChangeError(`Sua retirada excede o valor dos ativos destravados (R$ ${maxWithdrawal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Por favor, ancore ou bloqueie menos ativos para prosseguir.`);
        setCapitalChange(String(-maxWithdrawal)); // Cap at max withdrawal
      } else {
        setCapitalChange(value);
      }
    }
  };

  const handleCapitalChangeSign = (type: 'deposit' | 'withdrawal') => {
    setCapitalChangeError(null);
    const numericValue = Math.abs(parseFloat(capitalChange) || 0);
    if (type === 'withdrawal') {
      if (numericValue > maxWithdrawal) {
        setCapitalChange(String(-maxWithdrawal)); // Cap at max
        setCapitalChangeError(`Retirada máxima é de R$ ${maxWithdrawal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (total de ativos não ancorados/bloqueados).`);
      } else {
        setCapitalChange(numericValue > 0 ? `-${numericValue}` : '0');
      }
    } else {
      setCapitalChange(String(numericValue));
    }
  };

  const isWithdrawal = useMemo(() => parseFloat(capitalChange) < 0, [capitalChange]);


  if (performanceData.length === 0) {
    return (
      <EmptyState
        icon="fa-balance-scale"
        title="Ferramenta de Rebalanceamento"
        message="Adicione ativos ao seu portfóliopara começar a usar a ferramenta de rebalanceamento e otimizar sua alocação."
        actionText="Adicionar Transações"
        onAction={onNavigateToTransactions}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold text-white">Rebalanceamento de Carteira</h1>
          <p className="text-gray-400">Ajuste sua alocação de ativos para atingir suas metas estratégicas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleReset} variant="secondary" icon="fa-sync-alt">Recarregar Posição</Button>
          <Button onClick={handleOpenAiModal} icon="fa-wand-magic-sparkles" className="bg-purple-600 text-white hover:bg-purple-500">
            Assistente IA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl flex flex-col">
          <h3 className="text-xl font-bold mb-1">Definir Alocação Alvo</h3>
          <p className="text-sm text-gray-400 mb-4">Ajuste os sliders ou trave um percentual para definir sua carteira ideal.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-900/50 rounded-md mb-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Adicionar Ativo ao Plano</h4>
              <div className="flex gap-2">
                <div className="flex-grow">
                  <AutoCompleteInput
                    value={newAssetSymbol}
                    onChange={setNewAssetSymbol}
                    suggestions={Object.values(cryptoMap).filter(s => targetAllocations[s.toUpperCase()] === undefined)}
                    placeholder="Digite o ticker (ex: BTC)"
                  />
                </div>
                <Button onClick={handleAddAsset} icon="fa-plus" disabled={!newAssetSymbol.trim()}>Adicionar</Button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Aporte ou Retirada (Opcional)</h4>
              <div className="flex gap-1">
                <div className="flex-grow relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
                  <input
                    id="capital-change"
                    type="text"
                    value={capitalChange}
                    onChange={(e) => handleCapitalChangeInput(e.target.value)}
                    placeholder="Ex: 500"
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 pl-9 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => handleCapitalChangeSign('deposit')}
                    title="Definir como Aporte (+)"
                    className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${!isWithdrawal ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600'
                      }`}
                  >
                    Aporte
                  </button>
                  <button
                    onClick={() => handleCapitalChangeSign('withdrawal')}
                    title="Definir como Retirada (-)"
                    className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${isWithdrawal ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600'
                      }`}
                  >
                    Retirada
                  </button>
                </div>
              </div>
              {capitalChangeError && <p className="text-xs text-red-400 mt-1">{capitalChangeError}</p>}
            </div>
          </div>

          <div className="space-y-4 flex-grow overflow-y-auto pr-2">
            {orderedSymbols.map(symbol => {
              const asset = combinedDataMap.get(symbol);
              if (!asset) return null;

              const isLocked = lockedAllocations[symbol];
              const isAnchored = anchoredAssets[symbol];
              const isHeld = isLocked || isAnchored;

              const currentPercent = initialAllocations[symbol] ?? 0;
              let targetPercent = targetAllocations[symbol] ?? 0;

              if (isAnchored && newTotalPortfolioValue > 0) {
                targetPercent = (asset.currentValue / newTotalPortfolioValue) * 100;
              }

              const targetValueBRL = (targetPercent / 100) * newTotalPortfolioValue;

              const isEditingThis = editingInput?.symbol === symbol;
              const displayValue = isEditingThis ? editingInput.value : targetPercent.toFixed(2);

              return (
                <div key={symbol} className={`p-2 rounded-md transition-colors ${isAnchored ? 'bg-indigo-900/50' : isLocked ? 'bg-gray-900/50' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white text-lg">{symbol}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleToggleAnchor(symbol)} className={`text-lg transition-colors ${isAnchored ? 'text-indigo-400' : 'text-gray-500 hover:text-indigo-400'}`} title="Manter Posição (Quantidade)">
                          <i className="fas fa-anchor"></i>
                        </button>
                        <button onClick={() => handleToggleLock(symbol)} className={`text-lg transition-colors ${isLocked ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`} title="Bloquear Percentual">
                          <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRemoveAsset(symbol)}
                        disabled={isHeld}
                        className="text-gray-500 hover:text-red-400 disabled:text-gray-700 disabled:cursor-not-allowed"
                        title="Remover Ativo do Plano"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          Atual: {currentPercent.toFixed(2)}% (R$ {asset.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </p>
                        <p className="text-xs text-indigo-300 font-semibold">
                          Alvo: {targetPercent.toFixed(2)}% (R$ {targetValueBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={targetPercent}
                      onChange={(e) => handleAllocationChange(symbol, e.target.value)}
                      onMouseUp={reSortAndSetOrder}
                      onTouchEnd={reSortAndSetOrder}
                      disabled={isHeld}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="relative w-24">
                      <input
                        type="number"
                        value={displayValue}
                        onFocus={() => setEditingInput({ symbol, value: targetPercent.toFixed(2) })}
                        onChange={(e) => setEditingInput({ symbol, value: e.target.value })}
                        onBlur={() => {
                          if (editingInput) {
                            handleAllocationChange(editingInput.symbol, editingInput.value);
                            reSortAndSetOrder();
                          }
                          setEditingInput(null);
                        }}
                        onKeyDown={handleInputKeyDown}
                        disabled={isHeld}
                        className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-800 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
            <span className={`font-bold text-lg ${Math.abs(100 - correctTotalTargetPercentage) > 0.1 ? 'text-red-400' : 'text-green-400'}`}>
              Total: {correctTotalTargetPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Plano de Ação Sugerido</h3>
            <Button
              onClick={handleExportPlan}
              variant="secondary"
              icon="fa-file-excel"
              disabled={suggestions.length === 0}
              className="py-1.5 px-3 text-xs"
            >
              Exportar para Excel
            </Button>
          </div>
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <i className="fas fa-check-circle fa-2x text-green-500 mb-3"></i>
              <p className="font-semibold">Sua carteira está balanceada!</p>
              <p className="text-sm">Nenhuma ação é necessária para atingir sua alocação alvo.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {suggestions.map(s => (
                <li key={s.symbol} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-md">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${s.action === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    <i className={`fas ${s.action === 'buy' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-white">
                      <span className="uppercase">{s.action === 'buy' ? 'Comprar' : 'Vender'} </span>
                      {s.symbol}
                    </p>
                    <p className="text-sm text-gray-300">
                      {s.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {s.symbol}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">R$ {s.amountBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">
                      {s.currentAllocation.toFixed(1)}% &rarr; {s.targetAllocation.toFixed(1)}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="Assistente de Rebalanceamento IA"
      >
        <AIRebalanceView
          history={aiChatHistory}
          isThinking={isAiThinking}
          onSendMessage={handleSendAiMessage}
          onApplySuggestion={handleApplyAiSuggestion}
          onCompare={handleCompareSuggestion}
          onShare={onShare}
        />
      </Modal>

      <Modal
        isOpen={!!comparisonSuggestion}
        onClose={() => setComparisonSuggestion(null)}
        title="Comparação de Desempenho Histórico"
      >
        {comparisonSuggestion && (
          <HistoricalComparisonView
            actualHistory={actualHistory}
            simulatedHistory={simulatedHistory}
          />
        )}
      </Modal>
    </div>
  );
};

export default RebalanceSection;
