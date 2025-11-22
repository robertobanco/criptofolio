
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Transaction, Account, CryptoData, AssetPerformance, ProfitAnalysisData, Section, PriceAlert, Toast, ChatMessage, SentimentAnalysisResult, PortfolioHistoryPoint, RebalanceSuggestion, ComparisonMode, CriticalAlert } from './types';
import { Section as SectionEnum } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import useDebounce from './hooks/useDebounce';
import Header from './components/Header';
import TransactionsSection from './components/sections/TransactionsSection';
import DashboardSection from './components/sections/DashboardSection';
import ProfitAnalysisSection from './components/sections/ProfitAnalysisSection';
import PerformanceComparatorSection from './components/sections/PerformanceComparatorSection';
import AlertsSection from './components/sections/AlertsSection';
import WatchlistSection from './components/sections/WatchlistSection';
import TaxSection from './components/sections/TaxSection';
import RebalanceSection from './components/sections/RebalanceSection';
import Modal from './components/ui/Modal';
import Button from './components/ui/Button';
import ConfirmationModal from './components/ui/ConfirmationModal';
import SettingsModal from './components/SettingsModal';
import AccountModal from './components/AccountModal';
import ToastNotification from './components/ui/ToastNotification';
import AssetDetailView from './components/views/AssetDetailView';
import AIChatView from './components/views/AIChatView';
import OnboardingGuide from './components/OnboardingGuide';
import CriticalAlertsBanner from './components/ui/CriticalAlertsBanner';
import { generateChatResponse, generateDailyBriefing, generateMarketSentiment, generateCriticalAlerts } from './services/geminiService';
import { calculateAssetPerformance, calculateProfitAnalysis, calculatePortfolioHistory, calculateAllAssetsHistoricalValues } from './services/calculationService';
import { getProxiedUrl } from './services/proxyService';
import { fetchHistoricalPrices } from './services/historicalPriceService';

type CryptoMap = Record<string, string>;
type HistoricalPrices = Record<string, Record<string, number> | null>;

// --- Tipos para o estado persistente ---
interface RebalancePlanState {
    targetAllocations: Record<string, number>;
    lockedAllocations: Record<string, boolean>;
    anchoredAssets: Record<string, boolean>;
    capitalChange: string;
    aiAnalysisText: string | null;
}

interface ComparatorPlanState {
    selectedAssets: string[];
    timeRange: string;
    comparisonMode: ComparisonMode;
}

interface StrategyPlanState {
    prompt: string;
    generatedAllocation: Record<string, number> | null;
    simulationError: string | null;
}


const DEMO_TRANSACTIONS: Transaction[] = [
    { id: 1, type: 'buy', date: '2023-01-15', asset: 'BTC', quantity: 0.5, value: 16800.50 },
    { id: 2, type: 'buy', date: '2023-02-20', asset: 'ETH', quantity: 10, value: 1650.75 },
    { id: 3, type: 'buy', date: '2023-03-10', asset: 'ADA', quantity: 5000, value: 0.35 },
    { id: 4, type: 'buy', date: '2023-04-05', asset: 'BTC', quantity: 0.2, value: 28000.00 },
    { id: 5, type: 'sell', date: '2023-05-12', asset: 'ETH', quantity: 2, value: 2050.00 },
    { id: 6, type: 'buy', date: '2023-06-01', asset: 'SOL', quantity: 100, value: 22.50 },
];

const DEMO_ACCOUNTS: Account[] = [
    { id: 1, name: 'Carteira Principal', transactions: DEMO_TRANSACTIONS },
    { id: 2, name: 'Corretora B', transactions: [] }
];


type ConfirmationDetails = {
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isTransactionDelete?: boolean;
    transactionId?: number;
    isWatchlistItemDelete?: boolean;
    watchlistItemSymbol?: string;
};

// Helper function to filter date-keyed objects like historicalAssetValues
const filterHistoryForAI = <T extends Record<string, Record<string, number> | null>>(history: T, days: number): T => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const filteredHistory: Record<string, any> = {};

    for (const symbol in history) {
        if (Object.prototype.hasOwnProperty.call(history, symbol)) {
            const assetHistory = history[symbol];
            if (typeof assetHistory === 'object' && assetHistory !== null) {
                const filteredAssetHistory: Record<string, any> = {};
                const dates = Object.keys(assetHistory).sort();

                for (const date of dates) {
                    if (date >= cutoffDateStr) {
                        filteredAssetHistory[date] = assetHistory[date];
                    }
                }

                // Find and add the last data point just before the cutoff date to provide context.
                const lastDateBeforeCutoff = dates.reverse().find(d => d < cutoffDateStr);
                if (lastDateBeforeCutoff && !filteredAssetHistory[lastDateBeforeCutoff]) {
                    filteredAssetHistory[lastDateBeforeCutoff] = assetHistory[lastDateBeforeCutoff];
                }

                filteredHistory[symbol] = filteredAssetHistory;
            } else {
                // For cases where an asset might have a `null` history entry
                filteredHistory[symbol] = assetHistory;
            }
        }
    }
    return filteredHistory as T;
};

// Helper function to filter array-based history like portfolioHistory
const filterPortfolioHistoryForAI = (history: PortfolioHistoryPoint[], days: number): PortfolioHistoryPoint[] => {
    if (history.length === 0) return [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentPoints = history.filter(point => new Date(point.date) >= cutoffDate);

    // Find and add the last data point just before the cutoff date to provide context.
    const lastPointBeforeCutoff = history
        .slice()
        .reverse()
        .find(point => new Date(point.date) < cutoffDate);

    if (recentPoints.length > 0) {
        return lastPointBeforeCutoff ? [lastPointBeforeCutoff, ...recentPoints] : recentPoints;
    } else if (lastPointBeforeCutoff) {
        return [lastPointBeforeCutoff];
    }
    return [];
};

// Helper to render markdown-like strings from AI into HTML
const renderFormattedMessage = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g;
    return {
        __html: text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(\n\s*[*|-|•]\s+.*)+/g, (match) => {
                const items = match.trim().split('\n').map(item => `<li>${item.replace(/[*|-|•]\s*/, '').trim()}</li>`).join('');
                return `<ul class="list-disc pl-5 my-2">${items}</ul>`;
            })
            .replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline">$1</a>')
            .replace(/\n/g, '<br />')
            .replace(/<\/li><br \/>/g, '</li>')
    };
};


const App: React.FC = () => {
    const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts', DEMO_ACCOUNTS);
    const [activeAccountIds, setActiveAccountIds] = useLocalStorage<number[]>('activeAccountIds', [1]);

    const [cryptoData, setCryptoData] = useState<CryptoData>({});
    const [activeSection, setActiveSection] = useState<Section>(SectionEnum.Dashboard);
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);

    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false); // For Chat
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useLocalStorage<string>('geminiApiKey', '');
    const [cmcApiKey, setCmcApiKey] = useLocalStorage<string>('cmcApiKey', '');
    const [cryptoCompareApiKey, setCryptoCompareApiKey] = useLocalStorage<string>('cryptoCompareApiKey', '');
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [cryptoMap, setCryptoMap] = useLocalStorage<CryptoMap>('cryptoMap', {});
    const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>('priceAlerts', []);

    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useLocalStorage<boolean>('autoRefreshEnabled', true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [alertFormAsset, setAlertFormAsset] = useState('');
    const [selectedProxy, setSelectedProxy] = useLocalStorage<string>('selectedProxy', 'corsproxy.io');
    const [historicalPrices, setHistoricalPrices] = useLocalStorage<HistoricalPrices>('historicalPrices', {});
    const [lastHistoryUpdateTimestamp, setLastHistoryUpdateTimestamp] = useLocalStorage<string | null>('lastHistoryUpdateTimestamp', null);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [watchlist, setWatchlist] = useLocalStorage<string[]>('watchlist', ['DOGE', 'SHIB']);
    const [rebalanceAssetSymbols, setRebalanceAssetSymbols] = useState<string[]>([]);

    const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationDetails | null>(null);
    const [deleteAllTxsChecked, setDeleteAllTxsChecked] = useState(false);

    const [accountModalState, setAccountModalState] = useState<{ mode: 'add' | 'rename'; accountId?: number; accountName?: string } | null>(null);

    const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage('onboardingCompleted', false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    const [areNotificationsEnabled, setAreNotificationsEnabled] = useLocalStorage<boolean>('areNotificationsEnabled', false);
    const [isPrivacyMode, setIsPrivacyMode] = useLocalStorage<boolean>('isPrivacyMode', false);
    const notificationSound = useMemo(() => new Audio('https://cdn.freesound.org/previews/511/511486_6142149-lq.mp3'), []);

    // State for Sentiment Analysis
    const [sentimentAnalysisResult, setSentimentAnalysisResult] = useState<SentimentAnalysisResult | null>(null);
    const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
    const [sentimentAnalysisError, setSentimentAnalysisError] = useState<{ asset: string; message: string; } | null>(null);

    // State for Daily Briefing Modal
    const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
    const [dailyBriefingContent, setDailyBriefingContent] = useState<string | null>(null);
    const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
    const [briefingError, setBriefingError] = useState<string | null>(null);

    // State for Proactive Critical Alerts
    const [criticalAlerts, setCriticalAlerts] = useLocalStorage<CriticalAlert[]>('criticalAlerts', []);
    const [lastCriticalAlertCheck, setLastCriticalAlertCheck] = useLocalStorage<number | null>('lastCriticalAlertCheck', null);
    const [isCheckingCriticalAlerts, setIsCheckingCriticalAlerts] = useState(false);


    // --- State for persistent sections ---
    const initialRebalancePlan: RebalancePlanState = {
        targetAllocations: {},
        lockedAllocations: {},
        anchoredAssets: {},
        capitalChange: '',
        aiAnalysisText: null,
    };
    const [rebalancePlan, setRebalancePlan] = useState<RebalancePlanState>(initialRebalancePlan);

    const initialComparatorPlan: ComparatorPlanState = {
        selectedAssets: [],
        timeRange: 'all',
        comparisonMode: 'time',
    };
    const [comparatorPlan, setComparatorPlan] = useState<ComparatorPlanState>(initialComparatorPlan);

    const initialStrategyPlan: StrategyPlanState = {
        prompt: '',
        generatedAllocation: null,
        simulationError: null,
    };
    const [strategyPlan, setStrategyPlan] = useState<StrategyPlanState>(initialStrategyPlan);

    const handleClearComparatorAndStrategy = () => {
        setComparatorPlan(initialComparatorPlan);
        setStrategyPlan(initialStrategyPlan);
        addToast("Análise do comparador foi limpa.", "info");
    };


    useEffect(() => {
        // Show onboarding guide if it has not been completed yet.
        // Use a small timeout to ensure the rest of the app has rendered.
        if (!onboardingCompleted) {
            setTimeout(() => {
                setIsOnboardingOpen(true);
            }, 500);
        }
    }, [onboardingCompleted]);

    const handleCompleteOnboarding = () => {
        setOnboardingCompleted(true);
        setIsOnboardingOpen(false);
        // Open settings immediately after tour finishes so user can enter API keys
        setSettingsModalOpen(true);
    };

    const handleOnboardingNavigate = (section: Section) => {
        setActiveSection(section);
    };


    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = `${Date.now()}-${Math.random()}`; // More unique key
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const handleShareText = useCallback(async (textToShare: string, title: string = 'Análise do CriptoFólio AI') => {
        const cleanText = (text: string) => {
            return text
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
                .replace(/<ul.*?>|<\/ul>/gi, '')
                .replace(/<a href="(.*?)".*?>(.*?)<\/a>/gi, '$2 ($1)')
                .replace(/<[^>]+>/g, '')
                .trim();
        };

        const plainText = cleanText(textToShare);

        if (navigator.share) {
            try {
                await navigator.share({ title: title, text: plainText });
            } catch (error) {
                console.error('Erro ao compartilhar:', error);
                addToast('Compartilhamento cancelado ou falhou.', 'error');
            }
        } else {
            try {
                await navigator.clipboard.writeText(plainText);
                addToast('Texto copiado para a área de transferência!', 'success');
            } catch (error) {
                console.error('Erro ao copiar:', error);
                addToast('Falha ao copiar texto.', 'error');
            }
        }
    }, [addToast]);

    useEffect(() => {
        // One-time migration for old alert structure
        const needsMigration = alerts.length > 0 && ('targetPrice' in alerts[0] || !('type' in alerts[0]));
        if (needsMigration) {
            console.log("Migrating alerts structure...");
            setAlerts(prevAlerts => prevAlerts.map(a => {
                const legacyAlert = a as any;
                const migrated: PriceAlert = {
                    id: legacyAlert.id,
                    asset: legacyAlert.asset,
                    type: legacyAlert.type || 'price',
                    condition: legacyAlert.condition,
                    targetValue: legacyAlert.targetPrice || legacyAlert.targetValue || 0,
                    recurring: legacyAlert.recurring || false,
                    proximity: legacyAlert.proximity,
                    triggered: legacyAlert.triggered,
                    triggeredAt: legacyAlert.triggeredAt,
                };
                return migrated;
            }));
            addToast("Estrutura de alertas atualizada.", "info");
        }
    }, []); // Run only once on mount, relies on the initial value from localStorage

    useEffect(() => {
        if (accounts.length === 0) {
            const defaultAccount = { id: 1, name: 'Carteira Principal', transactions: [] };
            setAccounts([defaultAccount]);
            setActiveAccountIds([1]);
        } else {
            // Ensure at least one valid account is selected
            const validActiveIds = activeAccountIds.filter(id => accounts.some(acc => acc.id === id));
            if (validActiveIds.length === 0) {
                setActiveAccountIds([accounts[0].id]);
            } else if (validActiveIds.length !== activeAccountIds.length) {
                setActiveAccountIds(validActiveIds);
            }
        }
    }, [accounts, activeAccountIds, setAccounts, setActiveAccountIds]);

    const activeTransactions = useMemo(() => {
        return accounts
            .filter(acc => activeAccountIds.includes(acc.id))
            .flatMap(acc => acc.transactions);
    }, [accounts, activeAccountIds]);

    const activeAccountNames = useMemo(() => {
        return accounts
            .filter(acc => activeAccountIds.includes(acc.id))
            .map(acc => acc.name)
            .join('_');
    }, [accounts, activeAccountIds]);

    const isMultiAccountView = useMemo(() => activeAccountIds.length > 1, [activeAccountIds]);

    useEffect(() => {
        const loadCryptoMap = async () => {
            const mapTimestamp = localStorage.getItem('cryptoMapTimestamp');
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            if (cmcApiKey && (!mapTimestamp || (now - parseInt(mapTimestamp)) > oneDay)) {
                console.log("Buscando novo mapa de criptomoedas...");
                try {
                    const apiUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';
                    const response = await fetch(getProxiedUrl(apiUrl, selectedProxy), {
                        headers: {
                            'X-CMC_PRO_API_KEY': cmcApiKey,
                            'Accept': 'application/json',
                        }
                    });

                    const json = await response.json();
                    if (!response.ok) {
                        const errorMessage = json?.status?.error_message || `Erro de HTTP: ${response.status}`;
                        throw new Error(errorMessage);
                    }

                    const newMap: CryptoMap = {};
                    json.data.forEach((item: { symbol: string }) => {
                        newMap[item.symbol.toUpperCase()] = item.symbol;
                    });

                    setCryptoMap(newMap);
                    localStorage.setItem('cryptoMapTimestamp', now.toString());
                } catch (error) {
                    console.error("Falha ao buscar mapa de criptomoedas:", error);
                }
            }
        };
        loadCryptoMap();
    }, [cmcApiKey, setCryptoMap, selectedProxy]);

    // FIX: Use a ref to store historicalPrices to break the dependency cycle in the useCallback.
    const historicalPricesRef = useRef(historicalPrices);
    useEffect(() => {
        historicalPricesRef.current = historicalPrices;
    }, [historicalPrices]);

    const handleUpdateHistoricalData = useCallback(async (symbols?: string[], force: boolean = false) => {
        const allSymbolsInPortfolio = Array.from(new Set(activeTransactions.map(tx => tx.asset))) as string[];

        let assetsToCheck: string[] = [];
        if (symbols) {
            assetsToCheck = symbols;
        } else if (activeTransactions.length > 0) {
            assetsToCheck = allSymbolsInPortfolio;
        }

        if (assetsToCheck.length === 0) {
            if (symbols) {
                addToast("Nenhuma transação para buscar histórico.", "info");
            }
            return;
        }

        if (!cryptoCompareApiKey) {
            addToast("Adicione a chave de API da CryptoCompare nas Configurações para buscar o histórico do gráfico.", "error");
            // Prevent modal opening if user is still in onboarding
            if (onboardingCompleted) {
                setSettingsModalOpen(true);
            }
            return;
        }

        const assetsThatNeedFetching = force
            ? assetsToCheck
            : assetsToCheck.filter(asset => !historicalPricesRef.current[asset]);

        if (assetsThatNeedFetching.length === 0 && !force) {
            if (symbols === undefined) {
                addToast("Todos os dados históricos do gráfico já estão atualizados.", "info");
            }
            return;
        }

        const transactionsForFetching = activeTransactions.filter(tx => assetsThatNeedFetching.includes(tx.asset));
        const earliestTxDates = new Map<string, string>();
        transactionsForFetching.forEach(tx => {
            const currentMinDate = earliestTxDates.get(tx.asset);
            if (!currentMinDate || tx.date < currentMinDate) {
                earliestTxDates.set(tx.asset, tx.date);
            }
        });

        // Add dummy transactions for assets that might not have them but need history (e.g. from AI suggestion or watchlist)
        const dummyTransactions: Transaction[] = [];
        assetsThatNeedFetching.forEach(symbol => {
            if (!earliestTxDates.has(symbol)) {
                const threeYearsAgo = new Date();
                threeYearsAgo.setDate(threeYearsAgo.getDate() - 1095); // 3 years is a good max range
                dummyTransactions.push({
                    id: -1, asset: symbol, type: 'buy', date: threeYearsAgo.toISOString().split('T')[0], quantity: 0, value: 0
                });
            }
        });

        setIsFetchingHistory(true);
        addToast(`Buscando dados históricos para ${assetsThatNeedFetching.join(', ')}...`, "info");
        try {
            const { prices: newPrices, errors } = await fetchHistoricalPrices([...transactionsForFetching, ...dummyTransactions], force ? {} : historicalPricesRef.current, selectedProxy, cryptoCompareApiKey);

            if (Object.keys(newPrices).length > 0) {
                setHistoricalPrices(prev => ({ ...prev, ...newPrices }));
                addToast("Dados históricos do gráfico foram atualizados!", "success");
                setLastHistoryUpdateTimestamp(new Date().getTime().toString());
            }

            if (errors.length > 0) {
                errors.forEach(err => addToast(err, "error"));
            }

        } catch (error) {
            console.error("Falha inesperada ao buscar dados históricos:", error);
            addToast(`Erro inesperado ao atualizar dados do gráfico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, "error");
        } finally {
            setIsFetchingHistory(false);
        }
    }, [activeTransactions, selectedProxy, cryptoCompareApiKey, addToast, setHistoricalPrices, setSettingsModalOpen, setLastHistoryUpdateTimestamp, onboardingCompleted]);

    useEffect(() => {
        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (!lastHistoryUpdateTimestamp || (now - parseInt(lastHistoryUpdateTimestamp)) > oneDay) {
            console.log("Automatic daily check: Historical data is older than 24 hours. Updating...");
            const allSymbols = Array.from(new Set(activeTransactions.map(tx => tx.asset))) as string[];
            if (allSymbols.length > 0) {
                handleUpdateHistoricalData(allSymbols, true);
            }
        }
    }, [activeTransactions, handleUpdateHistoricalData, lastHistoryUpdateTimestamp]);

    const alertSymbolsList = useMemo(() => {
        return Array.from(new Set(alerts.map(a => a.asset))).sort();
    }, [alerts]);

    const uniqueSymbols = useMemo(() => {
        const symbolsToFetch = new Set<string>();

        // Add transaction symbols
        activeTransactions.forEach(tx => symbolsToFetch.add(tx.asset));

        // Add alert symbols, filtering out special ones
        alertSymbolsList.forEach(s => {
            if (!s.startsWith('__')) {
                symbolsToFetch.add(s);
            }
        });

        // Add watchlist symbols
        watchlist.forEach(s => symbolsToFetch.add(s));

        // Add rebalance symbols
        rebalanceAssetSymbols.forEach(s => symbolsToFetch.add(s));

        // Add symbol from alert form, if it's a valid crypto symbol
        const formAsset = alertFormAsset.trim().toUpperCase();
        if (formAsset) {
            const specialAssetValues = ['VALOR TOTAL DA CARTEIRA', 'LUCRO NÃO REALIZADO TOTAL'];
            if (!specialAssetValues.includes(formAsset) && !formAsset.startsWith('__')) {
                symbolsToFetch.add(formAsset);
            }
        }

        return Array.from(symbolsToFetch);
    }, [activeTransactions, alertSymbolsList, alertFormAsset, watchlist, rebalanceAssetSymbols]);

    const debouncedUniqueSymbols = useDebounce(uniqueSymbols, 500);

    const fetchPrices = useCallback(async () => {
        if (!cmcApiKey || debouncedUniqueSymbols.length === 0) {
            setCryptoData({});
            return;
        }
        setIsLoadingPrices(true);
        try {
            const correctedSymbols = debouncedUniqueSymbols.map(s => cryptoMap[s.toUpperCase()] || s);
            const apiUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${correctedSymbols.join(',')}&convert=BRL`;
            const response = await fetch(getProxiedUrl(apiUrl, selectedProxy), {
                headers: {
                    'X-CMC_PRO_API_KEY': cmcApiKey,
                    'Accept': 'application/json',
                }
            });

            const json = await response.json();

            if (!response.ok) {
                const errorMessage = json?.status?.error_message || `Erro de HTTP: ${response.status}`;
                throw new Error(errorMessage);
            }

            const newCryptoData: CryptoData = {};
            for (const symbol in json.data) {
                if (Object.prototype.hasOwnProperty.call(json.data, symbol)) {
                    const crypto = json.data[symbol];
                    const originalSymbol = debouncedUniqueSymbols.find(s => (cryptoMap[s.toUpperCase()] || s) === symbol) || symbol;
                    newCryptoData[originalSymbol] = {
                        price: crypto.quote.BRL.price,
                        percent_change_24h: crypto.quote.BRL.percent_change_24h,
                    };
                }
            }
            setCryptoData(newCryptoData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Falha ao buscar preços das criptomoedas:", error);
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.toLowerCase().includes("failed to fetch")) {
                errorMessage = "Não foi possível conectar ao servidor para buscar preços.";
            }
            addToast(`Falha ao buscar preços: ${errorMessage}`, 'error');
        } finally {
            setIsLoadingPrices(false);
        }
    }, [cmcApiKey, debouncedUniqueSymbols, cryptoMap, addToast, selectedProxy]);

    const handleManualRefresh = () => {
        if (!cmcApiKey) {
            addToast("Por favor, adicione sua chave de API nas Configurações.", 'error');
            setSettingsModalOpen(true);
            return;
        }
        fetchPrices();
    };

    useEffect(() => {
        if (isAutoRefreshEnabled) {
            fetchPrices();
            const interval = setInterval(fetchPrices, 5 * 60 * 1000); // Refresh every 5 minutes
            return () => clearInterval(interval);
        }
    }, [fetchPrices, isAutoRefreshEnabled]);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const performanceData: AssetPerformance[] = useMemo(() => calculateAssetPerformance(activeTransactions, cryptoData), [activeTransactions, cryptoData]);
    const profitAnalysisData: ProfitAnalysisData[] = useMemo(() => calculateProfitAnalysis(activeTransactions, cryptoData), [activeTransactions, cryptoData]);
    const totalCostBasis = useMemo(() => performanceData.reduce((sum, asset) => sum + asset.totalInvested, 0), [performanceData]);
    const totalPortfolioValue = useMemo(() => performanceData.reduce((sum, asset) => sum + asset.currentValue, 0), [performanceData]);
    const totalUnrealizedProfit = useMemo(() => profitAnalysisData.reduce((sum, asset) => sum + asset.unrealizedProfit, 0), [profitAnalysisData]);
    const portfolioHistoryForAI = useMemo(() => calculatePortfolioHistory(activeTransactions, historicalPrices, cryptoData), [activeTransactions, historicalPrices, cryptoData]);
    const allAssetsHistoricalValues = useMemo(() => calculateAllAssetsHistoricalValues(activeTransactions, historicalPrices, cryptoData), [activeTransactions, historicalPrices, cryptoData]);

    const hasSpecialAlerts = useMemo(() => alerts.some(a => a.asset.startsWith('__')), [alerts]);

    useEffect(() => {
        const canCheckAlerts = lastUpdated !== null || (debouncedUniqueSymbols.length === 0 && hasSpecialAlerts);

        if (!canCheckAlerts || alerts.length === 0) {
            return;
        }

        let hasChanged = false;
        const updatedAlerts = alerts.map(alert => {
            if (alert.triggered && !alert.recurring) return alert;

            let conditionMet = false;
            let message = '';
            let alertName = alert.asset;
            let currentValue: number | undefined;
            const isSpecialAsset = alert.asset.startsWith('__');

            if (alert.asset === '__PORTFOLIO_TOTAL__') {
                alertName = 'Valor Total da Carteira';
                currentValue = totalPortfolioValue;
            } else if (alert.asset === '__UNREALIZED_PROFIT__') {
                alertName = 'Lucro Não Realizado';
                currentValue = totalUnrealizedProfit;
            } else {
                const assetData = cryptoData[alert.asset];
                if (!assetData) return alert; // No data for this asset, skip

                if (alert.type === 'price') {
                    currentValue = assetData.price;
                } else if (alert.type === 'change24h') {
                    currentValue = assetData.percent_change_24h;
                }
            }

            if (currentValue === undefined || currentValue === null || (!isSpecialAsset && alert.type === 'price' && currentValue <= 0)) {
                return alert;
            }

            if (alert.type === 'price') {
                if ((alert.condition === 'above' && currentValue >= alert.targetValue) || (alert.condition === 'below' && currentValue <= alert.targetValue)) {
                    conditionMet = true;
                    message = `🔔 ALERTA: ${alertName} ${alert.condition === 'above' ? 'atingiu' : 'caiu para'} R$ ${alert.targetValue.toLocaleString()}. Valor atual: R$ ${currentValue.toLocaleString()}`;
                }
            } else if (alert.type === 'change24h') {
                const targetPercent = alert.condition === 'above' ? alert.targetValue : -alert.targetValue;
                if ((alert.condition === 'above' && currentValue >= targetPercent) || (alert.condition === 'below' && currentValue <= targetPercent)) {
                    conditionMet = true;
                    message = `🔔 ALERTA 24H: ${alert.asset} variou ${currentValue.toFixed(2)}%. Alvo: ${alert.condition === 'above' ? '>' : '<'} ${targetPercent.toFixed(2)}%`;
                }
            }

            if (conditionMet && !alert.triggered) {
                addToast(message, 'info');
                if (areNotificationsEnabled) {
                    notificationSound.play().catch(e => console.error("Erro ao tocar som de notificação:", e));
                    if (Notification.permission === 'granted') {
                        new Notification('Alerta de Preço Disparado!', {
                            body: message,
                            icon: '/vite.svg',
                        });
                    }
                }
                hasChanged = true;
                return { ...alert, triggered: true, triggeredAt: new Date().toISOString() };
            } else if (!conditionMet && alert.triggered && alert.recurring) {
                // Auto re-arm recurring alerts if condition is no longer met
                hasChanged = true;
                return { ...alert, triggered: false, triggeredAt: undefined };
            }

            return alert;
        });

        if (hasChanged) {
            setAlerts(updatedAlerts);
        }

    }, [cryptoData, alerts, setAlerts, addToast, totalPortfolioValue, totalUnrealizedProfit, areNotificationsEnabled, notificationSound, lastUpdated, debouncedUniqueSymbols, hasSpecialAlerts]);

    // Daily check for critical AI-driven alerts
    useEffect(() => {
        const runCriticalAlertCheck = async () => {
            const ownedAssets = performanceData.map(p => p.symbol);
            if (ownedAssets.length === 0 || !geminiApiKey) {
                setLastCriticalAlertCheck(Date.now());
                return;
            }
            setIsCheckingCriticalAlerts(true);
            addToast("IA está verificando notícias críticas sobre seus ativos...", "info");
            try {
                const responseText = await generateCriticalAlerts(geminiApiKey, ownedAssets);

                let newAlerts: CriticalAlert[] = [];
                const jsonMatch = responseText.match(/(\[[\s\S]*?\])/);
                const jsonString = jsonMatch ? jsonMatch[0] : responseText.trim();

                if (jsonString.startsWith('[')) {
                    try {
                        newAlerts = JSON.parse(jsonString) as CriticalAlert[];
                    } catch (parseError) {
                        console.warn("Falha ao analisar JSON de alertas críticos, tratando como nenhum alerta encontrado.", { jsonString, parseError });
                        newAlerts = [];
                    }
                } else {
                    console.warn("Resposta de alertas críticos não era um array JSON, tratando como nenhum alerta encontrado.", { responseText });
                    newAlerts = [];
                }

                if (newAlerts.length > 0) {
                    setCriticalAlerts(newAlerts);
                    addToast(`IA encontrou ${newAlerts.length} alerta(s) crítico(s) para sua carteira!`, 'error');
                } else {
                    setCriticalAlerts([]);
                    addToast("Verificação concluída. Nenhum alerta crítico novo encontrado.", "success");
                }
                setLastCriticalAlertCheck(Date.now());
            } catch (error) {
                console.error("Falha na verificação de alertas críticos:", error);
                addToast("Não foi possível verificar os alertas críticos da IA.", "error");
            } finally {
                setIsCheckingCriticalAlerts(false);
            }
        };

        const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        if (!lastCriticalAlertCheck || (now - lastCriticalAlertCheck) > TWENTY_FOUR_HOURS_IN_MS) {
            runCriticalAlertCheck();
        }
    }, [performanceData, geminiApiKey, lastCriticalAlertCheck, setLastCriticalAlertCheck, setCriticalAlerts, addToast]);


    const handleAddTransaction = (tx: Omit<Transaction, 'id'>) => {
        if (isMultiAccountView) {
            addToast("Selecione uma única conta para adicionar uma transação.", 'error');
            return;
        }
        if (!cmcApiKey) {
            addToast("É necessária uma chave de API para validar o ativo. Por favor, adicione-a em Configurações.", 'error');
            setSettingsModalOpen(true);
            return;
        }
        setAccounts(prev => prev.map(acc => {
            if (acc.id === activeAccountIds[0]) {
                const newId = acc.transactions.length > 0 ? Math.max(...acc.transactions.map(t => t.id)) + 1 : 1;
                return { ...acc, transactions: [...acc.transactions, { ...tx, id: newId }] };
            }
            return acc;
        }));
        addToast(`Transação de ${tx.asset} adicionada com sucesso.`, 'success');
    };

    const handleUpdateTransaction = (updatedTx: Transaction) => {
        if (isMultiAccountView) return;
        setAccounts(prev => prev.map(acc => {
            if (acc.id === activeAccountIds[0]) {
                return { ...acc, transactions: acc.transactions.map(tx => tx.id === updatedTx.id ? updatedTx : tx) };
            }
            return acc;
        }));
        addToast(`Transação de ${updatedTx.asset} atualizada.`, 'success');
    };

    const handleDeleteTransaction = (id: number) => {
        if (isMultiAccountView) return;
        setAccounts(prev => prev.map(acc => {
            if (acc.id === activeAccountIds[0]) {
                return { ...acc, transactions: acc.transactions.filter(tx => tx.id !== id) };
            }
            return acc;
        }));
    };

    const handleDeleteAllTransactions = () => {
        if (isMultiAccountView) return;
        setAccounts(prev => prev.map(acc => {
            if (acc.id === activeAccountIds[0]) {
                return { ...acc, transactions: [] };
            }
            return acc;
        }));
    };

    const handleDeleteTransactionRequest = (id: number) => {
        if (isMultiAccountView) {
            addToast("Selecione uma única conta para gerenciar transações.", "error");
            return;
        }
        setConfirmationRequest({
            isTransactionDelete: true,
            transactionId: id,
            title: '', // Will be dynamically replaced
            message: '', // Will be dynamically replaced
            onConfirm: () => { }, // Handled by global handleConfirm
        });
    };

    const handleAddAccount = (name: string) => {
        const newId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;
        const newAccount: Account = { id: newId, name, transactions: [] };
        setAccounts(prev => [...prev, newAccount]);
        setActiveAccountIds([newId]);
        addToast(`Conta "${name}" criada.`, 'success');
    };

    const handleUpdateAccount = (id: number, newName: string) => {
        setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, name: newName } : acc));
        addToast('Nome da conta atualizado.', 'success');
    };

    const handleDeleteAccount = (id: number) => {
        const remainingAccounts = accounts.filter(acc => acc.id !== id);
        setAccounts(remainingAccounts);

        // Adjust active accounts if the deleted one was selected
        const newActiveAccountIds = activeAccountIds.filter(activeId => activeId !== id);
        if (newActiveAccountIds.length === 0 && remainingAccounts.length > 0) {
            setActiveAccountIds([remainingAccounts[0].id]);
        } else {
            setActiveAccountIds(newActiveAccountIds);
        }
    };

    const handleSaveAccount = (name: string, id?: number) => {
        if (id !== undefined) {
            handleUpdateAccount(id, name);
        } else {
            handleAddAccount(name);
        }
    };

    const handleOpenAccountModal = (mode: 'add' | 'rename', accountId?: number, accountName?: string) => {
        setAccountModalState({ mode, accountId, accountName });
    };

    const handleDeleteAccountRequest = (id: number) => {
        if (accounts.length <= 1) {
            addToast("Você não pode excluir a última conta.", 'error');
            return;
        }
        setConfirmationRequest({
            title: 'Confirmar Exclusão de Conta',
            message: `Tem certeza de que deseja excluir esta conta e TODAS as suas transações? Esta ação não pode ser desfeita.`,
            onConfirm: () => {
                handleDeleteAccount(id);
                addToast('Conta excluída com sucesso.', 'info');
            },
            confirmText: 'Excluir Conta',
            confirmVariant: 'danger',
        });
    };

    const handleImportTransactions = (importedTxs: Omit<Transaction, 'id'>[]) => {
        if (isMultiAccountView) {
            addToast("Por favor, selecione uma única conta para importar transações.", "error");
            return;
        }
        setAccounts(prev => prev.map(acc => {
            if (acc.id === activeAccountIds[0]) {
                const maxId = acc.transactions.length > 0 ? Math.max(...acc.transactions.map(t => t.id)) : 0;
                const newTxsWithIds = importedTxs.map((tx, index) => ({
                    ...tx,
                    id: maxId + index + 1,
                }));
                addToast(`${newTxsWithIds.length} transações importadas com sucesso!`, 'success');
                return { ...acc, transactions: [...acc.transactions, ...newTxsWithIds] };
            }
            return acc;
        }));
    };

    const handleAddAlert = (alert: Omit<PriceAlert, 'id' | 'triggered' | 'triggeredAt'>) => {
        const newAlert = { ...alert, id: Date.now().toString(), triggered: false };
        setAlerts(prev => [...prev, newAlert]);
        setAlertFormAsset('');
        addToast(`Alerta para ${alert.asset} adicionado com sucesso.`, 'success');
    };

    const handleUpdateAlert = (updatedAlert: PriceAlert) => {
        setAlerts(prev => prev.map(alert =>
            alert.id === updatedAlert.id ? updatedAlert : alert
        ));
        addToast(`Alerta para ${updatedAlert.asset} foi atualizado.`, 'success');
    };

    const handleReArmAlert = (alertToReArm: PriceAlert) => {
        setAlerts(prev => prev.map(alert =>
            alert.id === alertToReArm.id ? { ...alert, triggered: false, triggeredAt: undefined } : alert
        ));
        addToast(`Alerta para ${alertToReArm.asset} foi reativado.`, 'success');
    };

    const handleDeleteAlert = (id: string) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    };

    const handleDeleteAlertRequest = (id: string) => {
        setConfirmationRequest({
            title: 'Confirmar Exclusão de Alerta',
            message: 'Tem certeza de que deseja excluir este alerta?',
            onConfirm: () => {
                handleDeleteAlert(id);
                addToast('Alerta removido.', 'info');
            },
            confirmText: 'Excluir',
            confirmVariant: 'danger',
        });
    };

    const handleAddWatchlistItem = (symbol: string) => {
        const upperSymbol = symbol.toUpperCase();
        if (watchlist.includes(upperSymbol)) {
            addToast(`${upperSymbol} já está na sua watchlist.`, 'info');
            return;
        }
        setWatchlist(prev => [...prev, upperSymbol]);
        addToast(`${upperSymbol} adicionado à watchlist.`, 'success');
    };

    const handleRemoveWatchlistItem = (symbol: string) => {
        setWatchlist(prev => prev.filter(s => s !== symbol));
    };

    const handleRemoveWatchlistItemRequest = (symbol: string) => {
        setConfirmationRequest({
            title: 'Remover da Watchlist',
            message: `Tem certeza que deseja remover ${symbol} da sua watchlist?`,
            onConfirm: () => {
                handleRemoveWatchlistItem(symbol);
                addToast(`${symbol} removido da watchlist.`, 'info');
            },
            confirmText: 'Remover',
            confirmVariant: 'danger',
            isWatchlistItemDelete: true,
            watchlistItemSymbol: symbol,
        });
    };

    const getPortfolioSummary = useCallback((): string => {
        const totalPortfolioValue = performanceData.reduce((sum, asset) => sum + asset.currentValue, 0);
        const totalProfit = profitAnalysisData.reduce((sum, asset) => sum + asset.totalProfit, 0);

        const accountNames = accounts
            .filter(acc => activeAccountIds.includes(acc.id))
            .map(acc => acc.name)
            .join(', ');

        // Trim transactions to the last 180 days
        const txCutoffDate = new Date();
        txCutoffDate.setDate(txCutoffDate.getDate() - 180);
        const txCutoffDateStr = txCutoffDate.toISOString().split('T')[0];
        const trimmedTransactions = activeTransactions.filter(tx => tx.date >= txCutoffDateStr);

        // Trim historical data to the last 30 days to reduce payload size
        const trimmedPortfolioHistory = filterPortfolioHistoryForAI(portfolioHistoryForAI, 30);
        const trimmedHistoricalAssetValues = filterHistoryForAI(allAssetsHistoricalValues, 30);

        const portfolioDataForAI = {
            currentDate: new Date().toISOString().split('T')[0],
            generalSummary: {
                totalPortfolioValue,
                totalInvested: totalCostBasis,
                totalProfit,
                analyzedAccounts: accountNames,
            },
            assetPerformance: performanceData,
            profitAnalysis: profitAnalysisData,
            transactions: trimmedTransactions,
            portfolioHistory: trimmedPortfolioHistory,
            watchlist: watchlist,
            historicalAssetValues: trimmedHistoricalAssetValues,
        };

        return JSON.stringify(portfolioDataForAI, null, 2);
    }, [performanceData, profitAnalysisData, accounts, activeAccountIds, totalCostBasis, activeTransactions, portfolioHistoryForAI, allAssetsHistoricalValues, watchlist]);

    const handleAnalyzePortfolio = async () => {
        setChatHistory([
            { role: 'model', parts: [{ text: "Olá! Eu sou o Cripto Control AI. Estou pronto para analisar sua carteira, incluindo os ativos na sua watchlist. Sobre o que você gostaria de saber?" }] }
        ]);
        setAnalysisModalOpen(true);
    };

    const handleOpenBriefingModal = useCallback(async () => {
        setIsBriefingModalOpen(true);
        if (dailyBriefingContent || isGeneratingBriefing) {
            return; // Don't re-fetch if we have content or are already fetching
        }

        if (!geminiApiKey) {
            addToast('Chave de API do Gemini é necessária. Adicione nas Configurações.', 'error');
            setIsBriefingModalOpen(false);
            setSettingsModalOpen(true);
            return;
        }

        setIsGeneratingBriefing(true);
        setBriefingError(null);
        try {
            const summary = getPortfolioSummary();
            const briefing = await generateDailyBriefing(geminiApiKey, summary);
            setDailyBriefingContent(briefing);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao gerar o briefing.";
            console.error("Erro ao gerar briefing diário:", error);
            setBriefingError(errorMessage);
        } finally {
            setIsGeneratingBriefing(false);
        }
    }, [geminiApiKey, getPortfolioSummary, addToast, dailyBriefingContent, isGeneratingBriefing]);

    const handleSendChatMessage = async (message: string, webSearchEnabled: boolean) => {
        if (isAnalyzing) return;
        if (!geminiApiKey) {
            addToast('Chave de API do Gemini é necessária. Adicione nas Configurações.', 'error');
            setAnalysisModalOpen(false);
            setSettingsModalOpen(true);
            return;
        }

        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        let currentHistory = [...chatHistory, newUserMessage];
        setChatHistory(currentHistory);
        setIsAnalyzing(true);

        // Avisar o usuário se a busca web está ativada (pode demorar mais)
        if (webSearchEnabled) {
            addToast('Buscando informações online... Você pode navegar pelo app, avisaremos quando a resposta estiver pronta.', 'info');
        }

        try {
            for (let i = 0; i < 3; i++) { // Max 3 retries for data fetching
                const response = await generateChatResponse(geminiApiKey, currentHistory, getPortfolioSummary(), webSearchEnabled);

                let responseText = response.text;

                const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
                const codeBlockMatch = responseText.match(jsonBlockRegex);

                let jsonString: string | null = null;
                if (codeBlockMatch && codeBlockMatch[1]) {
                    jsonString = codeBlockMatch[1].trim();
                } else {
                    const rawJsonMatch = responseText.match(/\{"request_historical_data_for":\s*\[[\s\S]*?\]\}/s);
                    if (rawJsonMatch) {
                        jsonString = rawJsonMatch[0];
                    }
                }

                if (jsonString) {
                    try {
                        // FIX: Type-guard the symbols received from the AI. The result of JSON.parse is `any`,
                        // so we must ensure the array contains only strings before passing it to other functions.
                        const parsedData = JSON.parse(jsonString);
                        if (
                            parsedData &&
                            typeof parsedData === 'object' &&
                            'request_historical_data_for' in parsedData &&
                            Array.isArray(parsedData.request_historical_data_for)
                        ) {
                            const symbols = parsedData.request_historical_data_for as any[];
                            // Corrected strict filtering for string array to satisfy TS compiler
                            const stringSymbols = symbols.filter((item: any) => typeof item === 'string' && item.length > 0) as string[];

                            if (stringSymbols.length > 0) {
                                addToast(`A IA precisa de dados para: ${stringSymbols.join(', ')}. Buscando...`, 'info');

                                await handleUpdateHistoricalData(stringSymbols, true);

                                const systemMessage: ChatMessage = { role: 'user', parts: [{ text: `[SYSTEM] Os dados históricos para ${stringSymbols.join(', ')} foram buscados. Por favor, responda à pergunta anterior agora.` }] };
                                currentHistory.push(systemMessage);
                                setChatHistory(currentHistory);

                                continue;
                            }
                        }
                    } catch (e) {
                        console.error("Falha ao analisar JSON extraído para solicitação de dados:", e);
                    }
                }

                const newAiMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
                setChatHistory(prev => [...prev, newAiMessage]);
                setIsAnalyzing(false);

                // Notificar usuário que a resposta está pronta (especialmente útil se ele navegou para outra tela)
                if (webSearchEnabled) {
                    addToast('✅ Análise com busca online concluída!', 'success');
                }
                return;
            }

            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "Ocorreu um erro ao buscar os dados necessários repetidamente. Por favor, reformule sua pergunta ou tente novamente mais tarde." }] };
            setChatHistory(prev => [...prev, errorMessage]);
            setIsAnalyzing(false);
        } catch (error: any) {
            console.error("Erro no chat:", error);
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{
                    text: `Erro ao processar sua mensagem: ${error.message || 'Erro desconhecido'}. ${webSearchEnabled ? 'A busca na web pode ter falhado ou excedido o tempo limite.' : ''} Por favor, tente novamente.`
                }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            setIsAnalyzing(false);
            addToast('Erro ao processar mensagem. Verifique sua conexão e tente novamente.', 'error');
        }
    };

    const handleGenerateSentiment = async (assetSymbol: string) => {
        if (!geminiApiKey) {
            addToast('Chave de API do Gemini é necessária. Adicione nas Configurações.', 'error');
            return;
        }
        setIsAnalyzingSentiment(true);
        setSentimentAnalysisResult(null);
        setSentimentAnalysisError(null);

        try {
            let assetHistory = historicalPrices[assetSymbol];

            if (!assetHistory && cryptoCompareApiKey) {
                addToast(`Dados históricos para ${assetSymbol} não encontrados. Buscando...`, 'info');

                let assetTransactions = activeTransactions.filter(tx => tx.asset === assetSymbol);
                if (assetTransactions.length === 0) {
                    const threeYearsAgo = new Date();
                    threeYearsAgo.setDate(threeYearsAgo.getDate() - 1095);
                    assetTransactions.push({
                        id: -1, asset: assetSymbol, type: 'buy', date: threeYearsAgo.toISOString().split('T')[0], quantity: 0, value: 0
                    });
                }

                const { prices: newPrices, errors: fetchErrors } = await fetchHistoricalPrices(
                    assetTransactions, historicalPrices, selectedProxy, cryptoCompareApiKey
                );

                if (fetchErrors.length > 0) {
                    throw new Error(fetchErrors[0]);
                }

                if (newPrices[assetSymbol]) {
                    setHistoricalPrices(prev => ({ ...prev, ...newPrices }));
                    assetHistory = newPrices[assetSymbol];
                } else {
                    throw new Error(`Não foi possível obter dados históricos para ${assetSymbol}.`);
                }
            } else if (!assetHistory && !cryptoCompareApiKey) {
                addToast(`Adicione uma chave da CryptoCompare para buscar o histórico de ${assetSymbol}.`, 'info');
            }

            let historicalPriceContext: string | null = null;
            if (assetHistory) {
                const recentHistory: Record<string, number> = {};
                const sortedDates = Object.keys(assetHistory).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

                for (let i = 0; i < 14 && i < sortedDates.length; i++) {
                    const date = sortedDates[i];
                    const price = assetHistory[date];
                    if (price !== null) {
                        recentHistory[date] = price;
                    }
                }
                if (Object.keys(recentHistory).length > 0) {
                    historicalPriceContext = JSON.stringify(recentHistory, null, 2);
                }
            }

            const responseText = await generateMarketSentiment(geminiApiKey, assetSymbol, historicalPriceContext);
            const parsedResult = JSON.parse(responseText.trim());

            if (
                !parsedResult.sentiment ||
                !parsedResult.summary ||
                !Array.isArray(parsedResult.positive_points) ||
                !Array.isArray(parsedResult.negative_points)
            ) {
                throw new Error("A resposta da IA está em um formato inválido ou incompleto.");
            }

            setSentimentAnalysisResult({ ...parsedResult, asset: assetSymbol });
        } catch (error) {
            console.error("Erro na análise de sentimento:", error);
            const message = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            setSentimentAnalysisError({ asset: assetSymbol, message: `Falha ao analisar ${assetSymbol}: ${message}` });
        } finally {
            setIsAnalyzingSentiment(false);
        }
    };


    const handleCloseConfirmation = () => {
        setConfirmationRequest(null);
        setDeleteAllTxsChecked(false);
    };

    const handleConfirm = () => {
        if (!confirmationRequest) return;

        if (confirmationRequest.isTransactionDelete) {
            if (deleteAllTxsChecked) {
                handleDeleteAllTransactions();
                addToast('Todas as transações foram excluídas.', 'info');
            } else if (confirmationRequest.transactionId) {
                handleDeleteTransaction(confirmationRequest.transactionId);
                addToast('Transação excluída.', 'info');
            }
        } else {
            confirmationRequest.onConfirm();
        }
        handleCloseConfirmation();
    };

    const handleViewAssetDetails = (symbol: string) => {
        if (!historicalPrices[symbol]) {
            handleUpdateHistoricalData([symbol]);
        }
        setSelectedAssetSymbol(symbol);
    };

    const handleBackToDashboard = () => {
        setSelectedAssetSymbol(null);
        setActiveSection(SectionEnum.Dashboard);
    };

    const navigateToTransactions = () => {
        setActiveSection(SectionEnum.Transactions);
    };

    const handleSetActiveSection = (section: Section) => {
        setSelectedAssetSymbol(null);
        setActiveSection(section);
    };

    const ownedAssetSymbols = useMemo(() => performanceData.map(p => p.symbol), [performanceData]);

    const initialAllocations = useMemo(() => {
        const totalValue = performanceData.reduce((sum, asset) => sum + asset.currentValue, 0);
        const initial: Record<string, number> = {};
        if (totalValue > 0) {
            performanceData.forEach(asset => {
                initial[asset.symbol] = (asset.currentValue / totalValue) * 100;
            });
        }
        return initial;
    }, [performanceData]);

    const handleResetRebalancePlan = () => {
        setRebalancePlan({
            targetAllocations: initialAllocations,
            lockedAllocations: {},
            anchoredAssets: {},
            capitalChange: '',
            aiAnalysisText: null,
        });
    };

    const handleDismissCriticalAlert = (assetToDismiss: string) => {
        setCriticalAlerts(prev => prev.filter(alert => alert.asset !== assetToDismiss));
    };

    const renderContent = () => {
        if (selectedAssetSymbol) {
            let assetPerformance = performanceData.find(p => p.symbol === selectedAssetSymbol);
            let assetProfitAnalysis = profitAnalysisData.find(p => p.symbol === selectedAssetSymbol);
            const assetTransactions = activeTransactions.filter(tx => tx.asset === selectedAssetSymbol);

            const isOwned = !!assetPerformance;

            if (!isOwned) {
                const currentPrice = cryptoData[selectedAssetSymbol]?.price ?? 0;
                assetPerformance = {
                    symbol: selectedAssetSymbol,
                    totalInvested: 0,
                    currentValue: 0,
                    profitLoss: 0,
                    variation: 0,
                    totalQuantity: 0,
                };
                assetProfitAnalysis = {
                    symbol: selectedAssetSymbol,
                    totalBought: 0,
                    totalSold: 0,
                    remainingQuantity: 0,
                    averageBuyPrice: 0,
                    currentPrice: currentPrice,
                    realizedProfit: 0,
                    unrealizedProfit: 0,
                    totalProfit: 0,
                    totalVariation: 0,
                };
            }

            if (!assetPerformance || !assetProfitAnalysis) {
                return <div>Erro: Dados do ativo não encontrados.</div>;
            }

            return (
                <AssetDetailView
                    assetPerformance={assetPerformance}
                    profitAnalysis={assetProfitAnalysis}
                    transactions={assetTransactions}
                    cryptoData={cryptoData}
                    historicalPrices={historicalPrices}
                    onBack={handleBackToDashboard}
                />
            );
        }

        switch (activeSection) {
            case SectionEnum.Transactions:
                return <TransactionsSection
                    transactions={activeTransactions}
                    onAddTransaction={handleAddTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onDeleteTransaction={handleDeleteTransactionRequest}
                    cryptoMap={cryptoMap}
                    addToast={addToast}
                    onImport={handleImportTransactions}
                    accountNames={activeAccountNames}
                    isMultiAccountView={isMultiAccountView}
                />;
            case SectionEnum.ProfitAnalysis:
                return <ProfitAnalysisSection
                    analysisData={profitAnalysisData}
                    totalCostBasis={totalCostBasis}
                    onViewDetails={handleViewAssetDetails}
                    onNavigateToTransactions={navigateToTransactions}
                />;
            case SectionEnum.PerformanceComparator:
                return <PerformanceComparatorSection
                    transactions={activeTransactions}
                    profitAnalysisData={profitAnalysisData}
                    historicalPrices={historicalPrices}
                    onUpdateHistory={handleUpdateHistoricalData}
                    isUpdatingHistory={isFetchingHistory}
                    onNavigateToTransactions={navigateToTransactions}
                    cryptoData={cryptoData}
                    cryptoMap={cryptoMap}
                    addToast={addToast}
                    geminiApiKey={geminiApiKey}
                    comparatorPlan={comparatorPlan}
                    setComparatorPlan={setComparatorPlan}
                    strategyPlan={strategyPlan}
                    setStrategyPlan={setStrategyPlan}
                    onClear={handleClearComparatorAndStrategy}
                />;
            case SectionEnum.Alerts:
                return <AlertsSection
                    alerts={alerts}
                    onAddAlert={handleAddAlert}
                    onUpdateAlert={handleUpdateAlert}
                    onReArmAlert={handleReArmAlert}
                    onDeleteAlert={handleDeleteAlertRequest}
                    cryptoMap={cryptoMap}
                    cryptoData={cryptoData}
                    onAlertAssetChange={setAlertFormAsset}
                    addToast={addToast}
                    totalPortfolioValue={totalPortfolioValue}
                    totalUnrealizedProfit={totalUnrealizedProfit}
                />;
            case SectionEnum.Watchlist:
                return <WatchlistSection
                    watchlist={watchlist}
                    onAdd={handleAddWatchlistItem}
                    onRemove={handleRemoveWatchlistItemRequest}
                    cryptoData={cryptoData}
                    cryptoMap={cryptoMap}
                    addToast={addToast}
                    ownedAssets={ownedAssetSymbols}
                    onViewDetails={handleViewAssetDetails}
                />;
            case SectionEnum.Taxes:
                return <TaxSection
                    transactions={activeTransactions}
                    onNavigateToTransactions={navigateToTransactions}
                />;
            case SectionEnum.Rebalance:
                return <RebalanceSection
                    performanceData={performanceData}
                    profitAnalysisData={profitAnalysisData}
                    onNavigateToTransactions={navigateToTransactions}
                    cryptoMap={cryptoMap}
                    transactions={activeTransactions}
                    historicalPrices={historicalPrices}
                    cryptoData={cryptoData}
                    onUpdateHistory={handleUpdateHistoricalData}
                    isUpdatingHistory={isFetchingHistory}
                    onSymbolsChange={setRebalanceAssetSymbols}
                    addToast={addToast}
                    onOpenSettings={() => setSettingsModalOpen(true)}
                    geminiApiKey={geminiApiKey}
                    plan={rebalancePlan}
                    setPlan={setRebalancePlan}
                    onReset={handleResetRebalancePlan}
                    onShare={handleShareText}
                />;
            case SectionEnum.Dashboard:
            default:
                return <DashboardSection
                    performanceData={performanceData}
                    profitAnalysisData={profitAnalysisData}
                    cryptoData={cryptoData}
                    transactions={activeTransactions}
                    historicalPrices={historicalPrices}
                    onUpdateHistory={handleUpdateHistoricalData}
                    isUpdatingHistory={isFetchingHistory}
                    onViewDetails={handleViewAssetDetails}
                    onNavigateToTransactions={navigateToTransactions}
                    watchlist={watchlist}
                    onGenerateSentiment={handleGenerateSentiment}
                    isAnalyzingSentiment={isAnalyzingSentiment}
                    sentimentResult={sentimentAnalysisResult}
                    sentimentError={sentimentAnalysisError}
                    onShare={handleShareText}
                    isPrivacyMode={isPrivacyMode}
                />;
        }
    };

    const hasTriggeredAlerts = useMemo(() => alerts.some(a => a.triggered), [alerts]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
            {isOnboardingOpen && (
                <OnboardingGuide
                    onComplete={handleCompleteOnboarding}
                    onNavigate={handleOnboardingNavigate}
                />
            )}
            <Header
                activeSection={activeSection}
                setActiveSection={handleSetActiveSection}
                onAnalyze={handleAnalyzePortfolio}
                isAnalyzing={isAnalyzing}
                onOpenSettings={() => setSettingsModalOpen(true)}
                accounts={accounts}
                activeAccountIds={activeAccountIds}
                onSelectAccountIds={setActiveAccountIds}
                onRefreshPrices={handleManualRefresh}
                isLoadingPrices={isLoadingPrices}
                isAutoRefreshEnabled={isAutoRefreshEnabled}
                onToggleAutoRefresh={setIsAutoRefreshEnabled}
                lastUpdated={lastUpdated}
                hasTriggeredAlerts={hasTriggeredAlerts}
                onManageAccount={handleOpenAccountModal}
                onDeleteAccount={handleDeleteAccountRequest}
                addToast={addToast}
                onOpenBriefingModal={handleOpenBriefingModal}
                isPrivacyMode={isPrivacyMode}
                onTogglePrivacyMode={setIsPrivacyMode}
            />
            <main className="max-w-7xl mx-auto p-4 md:p-6">
                <CriticalAlertsBanner
                    alerts={criticalAlerts}
                    onDismiss={handleDismissCriticalAlert}
                    isLoading={isCheckingCriticalAlerts}
                />
                {renderContent()}
            </main>

            <div className="fixed bottom-4 right-4 z-[200] space-y-2 w-full max-w-sm overflow-x-hidden">
                {toasts.map(toast => (
                    <ToastNotification key={toast.id} toast={toast} onDismiss={removeToast} />
                ))}
            </div>

            <AccountModal
                isOpen={!!accountModalState}
                onClose={() => setAccountModalState(null)}
                onSave={handleSaveAccount}
                mode={accountModalState?.mode || 'add'}
                accountId={accountModalState?.accountId}
                initialName={accountModalState?.accountName || ''}
            />

            {confirmationRequest && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={handleCloseConfirmation}
                    onConfirm={handleConfirm}
                    title={
                        confirmationRequest.isTransactionDelete
                            ? deleteAllTxsChecked ? '⚠️ Excluir TODAS as Transações?' : 'Confirmar Exclusão de Transação'
                            : confirmationRequest.title
                    }
                    confirmText={
                        confirmationRequest.isTransactionDelete
                            ? deleteAllTxsChecked ? 'Sim, Excluir Tudo' : 'Excluir'
                            : confirmationRequest.confirmText
                    }
                    confirmVariant={
                        confirmationRequest.isTransactionDelete ? 'danger' : confirmationRequest.confirmVariant
                    }
                >
                    {confirmationRequest.isTransactionDelete ? (
                        <div>
                            <p className="mb-4">
                                {deleteAllTxsChecked
                                    ? 'Esta ação é irreversível e excluirá TODAS as transações da conta atual.\n\nÉ altamente recomendável que você exporte seus dados para o Excel como backup antes de prosseguir.'
                                    : 'Tem certeza de que deseja excluir esta transação? Esta ação não pode ser desfeita.'}
                            </p>
                            <div className="flex items-center bg-gray-900/50 p-3 rounded-md border border-gray-700">
                                <input
                                    id="delete-all-checkbox"
                                    type="checkbox"
                                    checked={deleteAllTxsChecked}
                                    onChange={() => setDeleteAllTxsChecked(prev => !prev)}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="delete-all-checkbox" className="ml-3 block text-sm font-medium text-gray-300">
                                    Excluir todas as transações nesta conta
                                </label>
                            </div>
                        </div>
                    ) : (
                        confirmationRequest.message
                    )}
                </ConfirmationModal>
            )}

            <Modal
                isOpen={isAnalysisModalOpen}
                onClose={() => setAnalysisModalOpen(false)}
                title="Chat de Análise com IA"
            >
                <AIChatView
                    history={chatHistory}
                    isThinking={isAnalyzing}
                    onSendMessage={handleSendChatMessage}
                    isWebSearchEnabled={isWebSearchEnabled}
                    onWebSearchToggle={setIsWebSearchEnabled}
                    onShare={handleShareText}
                />
            </Modal>

            <Modal
                isOpen={isBriefingModalOpen}
                onClose={() => setIsBriefingModalOpen(false)}
                title="Briefing Diário da IA"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsBriefingModalOpen(false)}>Fechar</Button>
                        {dailyBriefingContent && !isGeneratingBriefing && (
                            <Button
                                variant="primary"
                                icon="fa-share-alt"
                                onClick={() => handleShareText(dailyBriefingContent, "Briefing Diário CriptoFólio AI")}
                            >
                                Compartilhar
                            </Button>
                        )}
                    </>
                }
            >
                <div className="min-h-[300px] text-gray-200">
                    {isGeneratingBriefing && (
                        <div className="flex items-center justify-center h-full">
                            <i className="fas fa-spinner fa-spin mr-3"></i> Gerando seu briefing diário...
                        </div>
                    )}
                    {briefingError && (
                        <div className="text-red-300">
                            <h3 className="font-bold mb-2">Erro ao Gerar Briefing</h3>
                            <p className="text-sm">{briefingError}</p>
                        </div>
                    )}
                    {dailyBriefingContent && !isGeneratingBriefing && (
                        <div
                            className="prose prose-invert prose-sm max-w-none text-indigo-100"
                            dangerouslySetInnerHTML={renderFormattedMessage(dailyBriefingContent)}
                        />
                    )}
                </div>
            </Modal>

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                geminiApiKey={geminiApiKey}
                onGeminiApiKeySave={setGeminiApiKey}
                apiKey={cmcApiKey}
                onApiKeySave={setCmcApiKey}
                cryptoCompareApiKey={cryptoCompareApiKey}
                onCryptoCompareApiKeySave={setCryptoCompareApiKey}
                selectedProxy={selectedProxy}
                onProxyChange={setSelectedProxy}
                addToast={addToast}
                notificationsEnabled={areNotificationsEnabled}
                onNotificationsEnabledChange={setAreNotificationsEnabled}
            />
        </div>
    );
};

export default App;
