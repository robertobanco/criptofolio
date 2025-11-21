import type { Transaction } from '../types';
import { getProxiedUrl } from './proxyService';

type HistoricalPricesUpdate = Record<string, Record<string, number>>;
type CachedPrices = Record<string, Record<string, number> | null>;

export interface FetchResult {
    prices: HistoricalPricesUpdate;
    errors: string[];
}

// Função para converter um timestamp Unix (em segundos) para uma string de data 'YYYY-MM-DD'
const timestampToDateString = (ts: number): string => {
    const date = new Date(ts * 1000);
    const year = date.getUTCFullYear();
    const month = `0${date.getUTCMonth() + 1}`.slice(-2);
    const day = `0${date.getUTCDate()}`.slice(-2);
    return `${year}-${month}-${day}`;
};

export const fetchHistoricalPrices = async (
    transactions: Transaction[], 
    cachedPrices: CachedPrices,
    selectedProxy: string,
    cryptoCompareApiKey: string
): Promise<FetchResult> => {
    
    if (!cryptoCompareApiKey) {
        return { 
            prices: {}, 
            errors: ["A chave de API da CryptoCompare é necessária para buscar dados históricos. Por favor, adicione-a nas Configurações."] 
        };
    }

    const earliestTxDates = new Map<string, string>();
    transactions.forEach(tx => {
        const currentMinDate = earliestTxDates.get(tx.asset);
        if (!currentMinDate || tx.date < currentMinDate) {
            earliestTxDates.set(tx.asset, tx.date);
        }
    });

    const assetsToFetch = new Map<string, string>(); // Map<assetSymbol, minDateString>
    for (const [assetSymbol, earliestTxDate] of earliestTxDates.entries()) {
        const cachedAssetHistory = cachedPrices[assetSymbol];

        if (!cachedAssetHistory) {
            // Caso 1: Nenhum dado em cache. Precisa buscar.
            assetsToFetch.set(assetSymbol, earliestTxDate);
        } else {
            // Caso 2: Dados existem. Verificar se estão completos.
            const cachedDates = Object.keys(cachedAssetHistory);
            if (cachedDates.length > 0) {
                const earliestCachedDate = cachedDates.sort()[0];
                if (new Date(earliestTxDate) < new Date(earliestCachedDate)) {
                    // O cache está faltando dados mais antigos. Precisa de uma nova busca completa.
                    assetsToFetch.set(assetSymbol, earliestTxDate);
                }
            } else {
                // Caso 3: Existe uma entrada, mas está vazia (caso de borda). Precisa buscar.
                 assetsToFetch.set(assetSymbol, earliestTxDate);
            }
        }
    }

    if (assetsToFetch.size === 0) {
        console.log("Nenhum novo histórico de ativo para buscar.");
        return { prices: {}, errors: [] };
    }

    console.log(`Buscando/Atualizando histórico para ${assetsToFetch.size} ativo(s): ${Array.from(assetsToFetch.keys()).join(', ')}.`);

    const newPrices: HistoricalPricesUpdate = {};
    const errors: string[] = [];

    for (const [assetSymbol, minDateStr] of assetsToFetch.entries()) {
        const today = new Date();
        const firstDate = new Date(minDateStr);
        const diffTime = Math.abs(today.getTime() - firstDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const limit = Math.min(diffDays, 2000); // A API gratuita permite até 2000 pontos de dados

        const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${assetSymbol.toUpperCase()}&tsym=BRL&limit=${limit}&api_key=${cryptoCompareApiKey}`;
        
        try {
            const proxiedUrl = getProxiedUrl(url, selectedProxy);
            console.log(`Buscando histórico para ${assetSymbol} desde ${minDateStr}`);
            const response = await fetch(proxiedUrl);
            const data = await response.json();

            if (data.Response === 'Error') {
                throw new Error(data.Message || `Erro da API da CryptoCompare para ${assetSymbol}.`);
            }

            if (data.Data && data.Data.Data) {
                const assetPrices: Record<string, number> = {};
                data.Data.Data.forEach((dayData: { time: number, close: number }) => {
                    const dateStr = timestampToDateString(dayData.time);
                    assetPrices[dateStr] = dayData.close;
                });
                newPrices[assetSymbol] = assetPrices;
            } else {
                throw new Error(`Resposta inesperada da API para ${assetSymbol}.`);
            }

        } catch (error) {
            let errorMessage = `Falha ao buscar dados para ${assetSymbol}. Verifique a chave da API e o ticker do ativo.`;
            if (error instanceof Error && error.message.includes('market does not exist for this coin pair')) {
                errorMessage = `Não foram encontrados dados históricos para o par ${assetSymbol}-BRL. O ativo pode não ser negociado em BRL na CryptoCompare.`;
            }
            console.error(errorMessage, error);
            errors.push(errorMessage);
        }
    }

    return { prices: newPrices, errors };
};
