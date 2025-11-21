

export interface Transaction {
  id: number;
  type: 'buy' | 'sell';
  date: string; // YYY-MM-DD
  asset: string;
  quantity: number;
  value: number; // Price per unit in BRL
}

export interface CryptoData {
  [key: string]: {
    price: number;
    percent_change_24h: number;
  };
}

export interface Account {
  id: number;
  name: string;
  transactions: Transaction[];
}

export interface AssetPerformance {
  symbol: string;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  variation: number;
  totalQuantity: number;
}

export interface ProfitAnalysisData {
  symbol: string;
  totalBought: number;
  totalSold: number;
  remainingQuantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  totalVariation: number;
}

export interface PriceAlert {
  id: string;
  asset: string;
  type: 'price' | 'change24h';
  condition: 'above' | 'below';
  targetValue: number;
  recurring: boolean;
  proximity?: number; 
  triggered?: boolean;
  triggeredAt?: string;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export enum Section {
  Transactions = 'transactions',
  Dashboard = 'dashboard',
  ProfitAnalysis = 'profit',
  Alerts = 'alerts',
  PerformanceComparator = 'comparator',
  Watchlist = 'watchlist',
  Taxes = 'taxes',
  Rebalance = 'rebalance',
}

export interface PortfolioHistoryPoint {
  date: string;
  investedValue: number;
  marketValue: number;
  price?: number;
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export type ComparisonMode = 'time' | 'cost';

export type ProfitFilter = 'all' | 'profit' | 'loss';
export type ChartProfitType = 'totalProfit' | 'realizedProfit' | 'unrealizedProfit';

// --- Tipos para a Seção de Impostos ---

export interface MonthlyTaxReport {
  month: number; // 1-12
  year: number;
  totalSales: number;
  realizedProfit: number;
  isExempt: boolean;
  taxDue: number;
}

export interface AnnualTaxReport {
  year: number;
  totalTaxDue: number;
  totalTaxableSales: number;
  taxableMonthsCount: number;
  monthlyReports: MonthlyTaxReport[];
}

// --- Tipos para a Seção de Rebalanceamento ---
export interface RebalanceSuggestion {
  symbol: string;
  action: 'buy' | 'sell';
  amountBRL: number;
  quantity: number;
  currentValue: number;
  targetValue: number;
  currentAllocation: number;
  targetAllocation: number;
}

// --- Tipos para Análise de Sentimento ---
export interface SentimentAnalysisResult {
  asset: string;
  sentiment: 'Positivo' | 'Neutro' | 'Negativo';
  summary: string;
  positive_points: string[];
  negative_points: string[];
}

// --- Tipos para Alertas Críticos da IA ---
export interface CriticalAlert {
  asset: string;
  summary: string;
  severity: 'Alta' | 'Crítica';
  source: string;
}