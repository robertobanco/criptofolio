import type { Transaction, CryptoData, AssetPerformance, ProfitAnalysisData, PortfolioHistoryPoint, AnnualTaxReport, MonthlyTaxReport, RebalanceSuggestion } from '../types';

type HistoricalPrices = Record<string, Record<string, number>>; // { BTC: { '2023-01-01': 16000 } }

export const calculateAssetPerformance = (transactions: Transaction[], cryptoData: CryptoData): AssetPerformance[] => {
    const assetMap = new Map<string, { totalQuantity: number; totalInvested: number }>();

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(tx => {
            const asset = assetMap.get(tx.asset) || { totalQuantity: 0, totalInvested: 0 };
            if (tx.type === 'buy') {
                asset.totalQuantity += tx.quantity;
                asset.totalInvested += tx.quantity * tx.value;
            } else { // sell
                const avgCost = asset.totalQuantity > 0 ? asset.totalInvested / asset.totalQuantity : 0;
                asset.totalInvested -= tx.quantity * avgCost;
                asset.totalQuantity -= tx.quantity;
            }
            if (asset.totalQuantity < 0.00000001) { // Floating point precision
                asset.totalQuantity = 0;
                asset.totalInvested = 0;
            }
            assetMap.set(tx.asset, asset);
        });

    const performanceData: AssetPerformance[] = [];
    for (const [symbol, data] of assetMap.entries()) {
        if (data.totalQuantity <= 0) continue;
        const currentPrice = cryptoData[symbol]?.price || 0;
        const currentValue = data.totalQuantity * currentPrice;
        const profitLoss = currentValue - data.totalInvested;
        const variation = data.totalInvested > 0 ? (profitLoss / data.totalInvested) * 100 : 0;
        performanceData.push({
            symbol,
            totalQuantity: data.totalQuantity,
            totalInvested: data.totalInvested,
            currentValue,
            profitLoss,
            variation,
        });
    }

    return performanceData;
};

export const calculateProfitAnalysis = (transactions: Transaction[], cryptoData: CryptoData): ProfitAnalysisData[] => {
    const profitMap = new Map<string, Omit<ProfitAnalysisData, 'currentPrice' | 'unrealizedProfit' | 'totalProfit' | 'totalVariation'>>();

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(tx => {
            const asset = profitMap.get(tx.asset) || {
                symbol: tx.asset,
                totalBought: 0,
                totalSold: 0,
                remainingQuantity: 0,
                averageBuyPrice: 0,
                realizedProfit: 0,
            };

            if (tx.type === 'buy') {
                const newTotalBought = asset.totalBought + tx.quantity;
                const newAverageBuyPrice = ((asset.averageBuyPrice * asset.totalBought) + (tx.value * tx.quantity)) / newTotalBought;
                asset.totalBought = newTotalBought;
                asset.averageBuyPrice = newAverageBuyPrice;
            } else { // sell
                asset.totalSold += tx.quantity;
                asset.realizedProfit += tx.quantity * (tx.value - asset.averageBuyPrice);
            }
            asset.remainingQuantity = asset.totalBought - asset.totalSold;
            profitMap.set(tx.asset, asset);
        });

    const analysisData: ProfitAnalysisData[] = [];
    for (const [symbol, data] of profitMap.entries()) {
        const currentPrice = cryptoData[symbol]?.price || 0;
        const unrealizedProfit = data.remainingQuantity * (currentPrice - data.averageBuyPrice);
        const totalProfit = data.realizedProfit + unrealizedProfit;
        const totalCostBasis = data.totalBought * data.averageBuyPrice;
        const totalVariation = totalCostBasis > 0 ? (totalProfit / totalCostBasis) * 100 : 0;
        
        analysisData.push({
            ...data,
            currentPrice,
            unrealizedProfit,
            totalProfit,
            totalVariation,
        });
    }

    return analysisData;
};

export const calculateProfitAnalysisMetrics = (analysisData: ProfitAnalysisData[]) => {
    if (analysisData.length === 0) {
        return {
            totalAssets: 0,
            winRate: 0,
            bestAsset: null,
            worstAsset: null,
        };
    }

    const assetsWithClosedPositions = analysisData.filter(a => a.totalSold > 0);
    const profitableClosedPositions = assetsWithClosedPositions.filter(a => a.realizedProfit > 0);
    const winRate = assetsWithClosedPositions.length > 0
        ? (profitableClosedPositions.length / assetsWithClosedPositions.length) * 100
        : 0;
    
    let bestAsset: ProfitAnalysisData | null = null;
    let worstAsset: ProfitAnalysisData | null = null;
    
    for(const asset of analysisData) {
        if (!bestAsset || asset.totalProfit > bestAsset.totalProfit) {
            bestAsset = asset;
        }
        if (!worstAsset || asset.totalProfit < worstAsset.totalProfit) {
            worstAsset = asset;
        }
    }

    return {
        totalAssets: analysisData.length,
        winRate,
        bestAsset,
        worstAsset,
    };
};


const calculateHistory = (transactions: Transaction[], historicalPrices: HistoricalPrices, cryptoData: CryptoData): PortfolioHistoryPoint[] => {
    if (transactions.length === 0) {
        return [];
    }

    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const transactionsByDate = new Map<string, Transaction[]>();
    sortedTxs.forEach(tx => {
        const date = tx.date;
        if (!transactionsByDate.has(date)) {
            transactionsByDate.set(date, []);
        }
        transactionsByDate.get(date)!.push(tx);
    });

    const assetPortfolio = new Map<string, { quantity: number; invested: number }>();
    const historyPoints: PortfolioHistoryPoint[] = [];

    const firstDate = new Date(sortedTxs[0].date + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Add a starting point of zero before the first transaction
    const dayBeforeFirst = new Date(firstDate);
    dayBeforeFirst.setUTCDate(dayBeforeFirst.getUTCDate() - 1);
    historyPoints.push({ date: dayBeforeFirst.toISOString().split('T')[0], investedValue: 0, marketValue: 0 });

    let currentInvested = 0;
    const symbolsInTxs = new Set(transactions.map(tx => tx.asset));
    const isSingleAssetMode = symbolsInTxs.size === 1;

    for (let d = firstDate; d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Process transactions for the current day
        if (transactionsByDate.has(dateStr)) {
            transactionsByDate.get(dateStr)!.forEach(tx => {
                const asset = assetPortfolio.get(tx.asset) || { quantity: 0, invested: 0 };
                if (tx.type === 'buy') {
                    asset.quantity += tx.quantity;
                    asset.invested += tx.quantity * tx.value;
                    currentInvested += tx.quantity * tx.value;
                } else { // sell
                    const avgCost = asset.quantity > 0 ? asset.invested / asset.quantity : 0;
                    const costOfSale = tx.quantity * avgCost;
                    const investedToRemove = costOfSale > asset.invested ? asset.invested : costOfSale;
                    
                    asset.invested -= investedToRemove;
                    asset.quantity -= tx.quantity;
                    currentInvested -= investedToRemove;
                }
                
                if (asset.quantity < 1e-8) {
                    asset.quantity = 0;
                    asset.invested = 0;
                }
                assetPortfolio.set(tx.asset, asset);
            });
        }

        // Calculate market value for the current day
        let currentMarketValue = 0;
        let priceForPoint: number | undefined = undefined;
        for (const [symbol, data] of assetPortfolio.entries()) {
            if (data.quantity > 0) {
                // Use today's live price for the last point, historical otherwise
                const isToday = dateStr === today.toISOString().split('T')[0];
                const price = isToday
                    ? cryptoData[symbol]?.price
                    : historicalPrices[symbol]?.[dateStr];

                if (price !== undefined && price !== null && price > 0) {
                    // Price is available and valid, use it for market value calculation.
                    currentMarketValue += data.quantity * price;
                     if (isSingleAssetMode) {
                        priceForPoint = price;
                    }
                } else {
                    // Price is NOT available for this day or is invalid (0). Use the asset's cost basis as a fallback.
                    // data.invested represents the total cost for the current quantity.
                    currentMarketValue += data.invested;
                }
            }
        }

        // Always push a point, as we now have a calculated market value (real or fallback).
        historyPoints.push({
            date: dateStr,
            investedValue: currentInvested,
            marketValue: currentMarketValue,
            price: priceForPoint,
        });
    }

    return historyPoints;
};

export const calculatePortfolioHistory = (transactions: Transaction[], historicalPrices: HistoricalPrices, cryptoData: CryptoData): PortfolioHistoryPoint[] => {
    return calculateHistory(transactions, historicalPrices, cryptoData);
};

export const calculateAssetHistory = (assetSymbol: string, transactions: Transaction[], historicalPrices: HistoricalPrices, cryptoData: CryptoData): PortfolioHistoryPoint[] => {
    const assetTransactions = transactions.filter(tx => tx.asset === assetSymbol);
    return calculateHistory(assetTransactions, historicalPrices, cryptoData);
};

export const calculateAllAssetsHistoricalValues = (
    transactions: Transaction[],
    historicalPrices: HistoricalPrices,
    cryptoData: CryptoData
): Record<string, Record<string, number>> => {
    const result: Record<string, Record<string, number>> = {};
    if (transactions.length === 0) {
        return result;
    }

    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const transactionsByDate = new Map<string, Transaction[]>();
    sortedTxs.forEach(tx => {
        const date = tx.date;
        if (!transactionsByDate.has(date)) {
            transactionsByDate.set(date, []);
        }
        transactionsByDate.get(date)!.push(tx);
    });

    const assetPortfolio = new Map<string, { quantity: number; invested: number }>();
    const allAssets = Array.from(new Set(transactions.map(tx => tx.asset)));
    allAssets.forEach(symbol => {
        result[symbol] = {};
    });

    const firstDate = new Date(sortedTxs[0].date + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let d = firstDate; d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // Process transactions for the current day
        if (transactionsByDate.has(dateStr)) {
            transactionsByDate.get(dateStr)!.forEach(tx => {
                const asset = assetPortfolio.get(tx.asset) || { quantity: 0, invested: 0 };
                if (tx.type === 'buy') {
                    asset.quantity += tx.quantity;
                    asset.invested += tx.quantity * tx.value;
                } else { // sell
                    const avgCost = asset.quantity > 0 ? asset.invested / asset.quantity : 0;
                    const costOfSale = tx.quantity * avgCost;
                    const investedToRemove = costOfSale > asset.invested ? asset.invested : costOfSale;
                    
                    asset.invested -= investedToRemove;
                    asset.quantity -= tx.quantity;
                }
                
                if (asset.quantity < 1e-8) {
                    asset.quantity = 0;
                    asset.invested = 0;
                }
                assetPortfolio.set(tx.asset, asset);
            });
        }

        // Calculate market value for each asset on the current day
        for (const [symbol, data] of assetPortfolio.entries()) {
            if (data.quantity > 0) {
                const isToday = dateStr === today.toISOString().split('T')[0];
                const price = isToday
                    ? cryptoData[symbol]?.price
                    : historicalPrices[symbol]?.[dateStr];

                if (price !== undefined && price !== null && price > 0) {
                    result[symbol][dateStr] = data.quantity * price;
                } else {
                    // Fallback to invested value if price is not available or is invalid (0)
                    result[symbol][dateStr] = data.invested;
                }
            }
        }
    }
    
    return result;
};


export const calculateMultipleAssetHistoryNormalized = (
    assetSymbols: string[],
    historicalPrices: HistoricalPrices,
    timeRangeInDays?: number
): { date: string; [key: string]: number | string }[] => {
    if (assetSymbols.length === 0) {
        return [];
    }

    // 1. Get all unique dates from the historical prices of the selected assets.
    const allDates = new Set<string>();
    assetSymbols.forEach(symbol => {
        if (historicalPrices[symbol]) {
            Object.keys(historicalPrices[symbol]!).forEach(date => allDates.add(date));
        }
    });

    let sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return [];

    // 2. Filter dates based on the selected time range.
    let chartDates: string[];
    if (timeRangeInDays) {
        const cutoffDate = new Date();
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - timeRangeInDays);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        chartDates = sortedDates.filter(d => d >= cutoffDateStr);
    } else {
        chartDates = sortedDates;
    }

    if (chartDates.length === 0) return [];

    const normalizedData: { date: string; [key: string]: number | string }[] = [];
    const baselinePrices = new Map<string, number>();

    // 3. Iterate through the chart dates to build the normalized data points.
    for (const date of chartDates) {
        const point: { date: string; [key: string]: number | string } = { date };
        let hasDataForPoint = false;

        for (const symbol of assetSymbols) {
            const price = historicalPrices[symbol]?.[date];

            if (typeof price === 'number' && price > 0) {
                // Find and set the baseline price if it doesn't exist for this asset.
                // The baseline is the first price we encounter for this asset within the chart's date range.
                if (!baselinePrices.has(symbol)) {
                    baselinePrices.set(symbol, price);
                }

                const baseline = baselinePrices.get(symbol);
                if (baseline) {
                    // Calculate performance relative to the baseline price.
                    point[symbol] = ((price / baseline) - 1) * 100;
                    point[`${symbol}_price`] = price;
                    hasDataForPoint = true;
                }
            }
        }

        if (hasDataForPoint) {
            normalizedData.push(point);
        }
    }
    
    return normalizedData;
};


export const calculateMultipleAssetHistoryByCostBasis = (
    assetSymbols: string[],
    profitAnalysisData: ProfitAnalysisData[],
    historicalPrices: HistoricalPrices,
    timeRangeInDays?: number
): { date: string; [key: string]: number | string }[] => {
    if (assetSymbols.length === 0) return [];
    
    const analysisMap = new Map(profitAnalysisData.map(d => [d.symbol, d]));

    let allDates = Array.from(new Set(Object.values(historicalPrices).flatMap(h => h ? Object.keys(h) : [])));
    allDates.sort();

    if (timeRangeInDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timeRangeInDays);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        allDates = allDates.filter(d => d >= cutoffDateStr);
    }
    if (allDates.length === 0) return [];

    const resultData: { date: string; [key: string]: number | string }[] = [];

    for (const date of allDates) {
        const point: { date: string; [key: string]: number | string } = { date };
        let hasData = false;

        for (const symbol of assetSymbols) {
            const analysis = analysisMap.get(symbol);
            const priceOnDate = historicalPrices[symbol]?.[date];
            
            if (analysis && analysis.averageBuyPrice > 0 && typeof priceOnDate === 'number') {
                const performance = (priceOnDate / analysis.averageBuyPrice - 1) * 100;
                point[symbol] = performance;
                point[`${symbol}_price`] = priceOnDate;
                hasData = true;
            }
        }
        if (hasData) {
            resultData.push(point);
        }
    }
    
    return resultData;
};

export const calculateTaxReport = (transactions: Transaction[], year: number): AnnualTaxReport => {
    const TAX_EXEMPTION_LIMIT = 35000;
    const TAX_RATE = 0.15;

    const sortedTxs = [...transactions]
        .filter(tx => new Date(tx.date).getFullYear() <= year)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const assetCostBasis = new Map<string, { totalQuantity: number; totalCost: number }>();
    const monthlyReports: MonthlyTaxReport[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        year,
        totalSales: 0,
        realizedProfit: 0,
        isExempt: true,
        taxDue: 0,
    }));

    for (const tx of sortedTxs) {
        const basis = assetCostBasis.get(tx.asset) || { totalQuantity: 0, totalCost: 0 };
        const txYear = new Date(tx.date).getFullYear();
        const txMonth = new Date(tx.date).getMonth(); // 0-11

        if (tx.type === 'buy') {
            basis.totalCost += tx.quantity * tx.value;
            basis.totalQuantity += tx.quantity;
        } else { // sell
            const avgCost = basis.totalQuantity > 0 ? basis.totalCost / basis.totalQuantity : 0;
            const costOfSale = tx.quantity * avgCost;

            if (txYear === year) {
                const saleValue = tx.quantity * tx.value;
                const profit = saleValue - costOfSale;

                monthlyReports[txMonth].totalSales += saleValue;
                monthlyReports[txMonth].realizedProfit += profit;
            }

            basis.totalCost -= costOfSale;
            basis.totalQuantity -= tx.quantity;

            if (basis.totalQuantity < 1e-8) {
                basis.totalQuantity = 0;
                basis.totalCost = 0;
            }
        }
        assetCostBasis.set(tx.asset, basis);
    }
    
    let totalTaxDue = 0;
    let totalTaxableSales = 0;
    let taxableMonthsCount = 0;

    for (const report of monthlyReports) {
        if (report.totalSales > TAX_EXEMPTION_LIMIT) {
            report.isExempt = false;
            if (report.realizedProfit > 0) {
                report.taxDue = report.realizedProfit * TAX_RATE;
                totalTaxDue += report.taxDue;
            }
            totalTaxableSales += report.totalSales;
            taxableMonthsCount++;
        }
    }

    return {
        year,
        totalTaxDue,
        totalTaxableSales,
        taxableMonthsCount,
        monthlyReports,
    };
};

export const calculateRebalanceSuggestions = (
  performanceData: AssetPerformance[],
  targetAllocations: Record<string, number>,
  cryptoData: CryptoData,
  capitalChange: number = 0,
  anchoredAssets: Record<string, boolean> = {}
): RebalanceSuggestion[] => {
  
  const currentTotalPortfolioValue = performanceData.reduce((sum, asset) => sum + asset.currentValue, 0);

  // 1. Separate anchored assets and calculate their total value
  const totalAnchoredValue = performanceData
    .filter(p => anchoredAssets[p.symbol])
    .reduce((sum, asset) => sum + asset.currentValue, 0);

  // 2. Define the portion of the portfolio that is available for rebalancing
  const rebalanceableCurrentValue = currentTotalPortfolioValue - totalAnchoredValue;
  const rebalanceableTargetValue = currentTotalPortfolioValue + capitalChange - totalAnchoredValue;

  if (rebalanceableTargetValue <= 0) {
    // If only anchored assets remain or the withdrawal makes the rest negative, only suggest selling non-anchored assets if necessary.
     return performanceData
      .filter(p => !anchoredAssets[p.symbol] && p.currentValue > 0)
      .map(p => ({
        symbol: p.symbol,
        action: 'sell',
        amountBRL: p.currentValue,
        quantity: p.totalQuantity,
        currentValue: p.currentValue,
        targetValue: 0,
        currentAllocation: (p.currentValue / currentTotalPortfolioValue) * 100,
        targetAllocation: 0,
      }));
  }

  // 3. Normalize the target percentages for only the rebalanceable assets
  const rebalanceableSymbols = Object.keys(targetAllocations).filter(symbol => !anchoredAssets[symbol]);
  const totalTargetPercentForRebalance = rebalanceableSymbols.reduce((sum, symbol) => sum + (targetAllocations[symbol] || 0), 0);

  const suggestions: RebalanceSuggestion[] = [];
  const allSymbols = Array.from(new Set([...performanceData.map(p => p.symbol), ...Object.keys(targetAllocations)]));

  for (const symbol of allSymbols) {
    // ANCHORED assets are skipped entirely. No buy/sell actions for them.
    if (anchoredAssets[symbol]) {
        continue;
    }

    const asset = performanceData.find(p => p.symbol === symbol);
    const currentValue = asset?.currentValue ?? 0;
    const currentAllocation = currentTotalPortfolioValue > 0 ? (currentValue / currentTotalPortfolioValue) * 100 : 0;
    
    let targetValue = 0;
    let targetAllocation = targetAllocations[symbol] ?? 0;

    // 4. Calculate target value based on the rebalanceable part of the portfolio
    if (totalTargetPercentForRebalance > 0) {
        const effectiveTargetPercent = (targetAllocations[symbol] || 0) / totalTargetPercentForRebalance;
        targetValue = rebalanceableTargetValue * effectiveTargetPercent;
    }

    const differenceBRL = targetValue - currentValue;
    const currentPrice = asset?.totalQuantity > 0 ? asset.currentValue / asset.totalQuantity : cryptoData[symbol]?.price;

    if (!currentPrice && differenceBRL > 0) {
        console.warn(`Cannot suggest buying ${symbol} without price data.`);
        continue;
    }

    const quantity = currentPrice && currentPrice > 0 ? differenceBRL / currentPrice : 0;

    if (Math.abs(differenceBRL) > 0.01) {
        suggestions.push({
            symbol,
            action: differenceBRL > 0 ? 'buy' : 'sell',
            amountBRL: Math.abs(differenceBRL),
            quantity: Math.abs(quantity),
            currentValue,
            targetValue,
            currentAllocation,
            targetAllocation,
        });
    }
  }

  return suggestions.sort((a, b) => {
    if (a.action === 'sell' && b.action === 'buy') return -1;
    if (a.action === 'buy' && b.action === 'sell') return 1;
    return b.amountBRL - a.amountBRL;
  });
};

// Helper to get a price for a specific date, returning null if not found
const getPrice = (prices: HistoricalPrices, symbol: string, date: string): number | null => {
    return prices[symbol]?.[date] ?? null;
};

export const calculateSimulatedPortfolioHistory = (
    actualHistory: PortfolioHistoryPoint[],
    suggestion: Record<string, number>,
    historicalPrices: HistoricalPrices
): { date: string; marketValue: number }[] => {
    if (actualHistory.length < 2 || Object.keys(suggestion).length === 0) {
        return [];
    }

    const simulatedHistory: { date: string; marketValue: number }[] = [];
    let simulatedQuantities: Record<string, number> = {};
    let lastKnownPrices: Record<string, number> = {};

    const firstInvestmentIndex = actualHistory.findIndex(p => p.investedValue > 0);
    if (firstInvestmentIndex === -1) return [];

    const firstPoint = actualHistory[firstInvestmentIndex];
    const initialInvestment = firstPoint.investedValue;

    // Initialize portfolio based on first investment day
    for (const symbol in suggestion) {
        const price = getPrice(historicalPrices, symbol, firstPoint.date);
        if (price && price > 0) {
            const targetValue = initialInvestment * (suggestion[symbol] / 100);
            simulatedQuantities[symbol] = targetValue / price;
            lastKnownPrices[symbol] = price;
        } else {
            simulatedQuantities[symbol] = 0;
        }
    }

    simulatedHistory.push({ date: firstPoint.date, marketValue: initialInvestment });

    // Iterate through the rest of the historical points
    for (let i = firstInvestmentIndex + 1; i < actualHistory.length; i++) {
        const point = actualHistory[i];
        const prevPoint = actualHistory[i - 1];

        // 1. Calculate appreciated value from previous day's quantities
        let appreciatedValue = 0;
        for (const symbol in simulatedQuantities) {
            const price = getPrice(historicalPrices, symbol, point.date);
            if (price !== null && price > 0) {
                appreciatedValue += simulatedQuantities[symbol] * price;
                lastKnownPrices[symbol] = price; // Update last known price
            } else if (lastKnownPrices[symbol]) {
                appreciatedValue += simulatedQuantities[symbol] * lastKnownPrices[symbol];
            }
        }
        
        let currentMarketValue = appreciatedValue;
        const capitalChange = point.investedValue - prevPoint.investedValue;

        // 2. If capital changed, rebalance the portfolio
        if (Math.abs(capitalChange) > 0.01) { // Use a small threshold for float precision
            const valueToRebalance = appreciatedValue + capitalChange;
            currentMarketValue = valueToRebalance;
            
            const newSimulatedQuantities: Record<string, number> = {};
            for (const symbol in suggestion) {
                const rebalancePrice = getPrice(historicalPrices, symbol, point.date) ?? lastKnownPrices[symbol];
                
                if (rebalancePrice && rebalancePrice > 0) {
                    const targetValue = valueToRebalance * (suggestion[symbol] / 100);
                    newSimulatedQuantities[symbol] = targetValue / rebalancePrice;
                } else {
                    newSimulatedQuantities[symbol] = simulatedQuantities[symbol] ?? 0;
                }
            }
            simulatedQuantities = newSimulatedQuantities;
        }
        
        simulatedHistory.push({ date: point.date, marketValue: currentMarketValue });
    }
    return simulatedHistory;
};