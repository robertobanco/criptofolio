// Serviço para buscar notícias de criptomoedas
// Agregador robusto usando API CryptoCompare e RSS Feeds via Proxy

export interface NewsItem {
    title: string;
    published_at: string;
    source: string;
    url: string;
    currencies: string[];
}

// --- Fontes RSS ---
const RSS_FEEDS = [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'Bitcoin.com', url: 'https://news.bitcoin.com/feed/' },
    { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' }
];

/**
 * Busca notícias de um feed RSS via rss2json
 */
const fetchRSS = async (feedName: string, rssUrl: string): Promise<NewsItem[]> => {
    try {
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) return [];

        const data = await response.json();

        if (data.status === 'ok' && data.items) {
            return data.items.map((item: any) => ({
                title: item.title,
                published_at: item.pubDate,
                source: feedName,
                url: item.link,
                currencies: [] // RSS genérico não tem tags de moeda fáceis
            }));
        }
        return [];
    } catch (error) {
        console.warn(`Erro ao buscar RSS ${feedName}:`, error);
        return [];
    }
};

/**
 * Tenta buscar notícias do CryptoCompare (Fonte Primária)
 */
const fetchFromCryptoCompare = async (useProxy: boolean = false): Promise<NewsItem[]> => {
    try {
        let url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN';
        if (useProxy) {
            url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) return [];

        const data = await response.json();

        if (!data || !data.Data || !Array.isArray(data.Data)) return [];

        return data.Data.map((item: any) => ({
            title: item.title,
            published_at: new Date(item.published_on * 1000).toISOString(),
            source: item.source,
            url: item.url,
            currencies: item.categories ? item.categories.split('|') : []
        }));
    } catch (error) {
        console.warn(`CryptoCompare ${useProxy ? '(Proxy)' : '(Direto)'} erro:`, error);
        return [];
    }
};

/**
 * Busca notícias recentes sobre criptomoedas (Agregador)
 */
export const fetchCryptoNews = async (symbols: string[], limit: number = 10): Promise<string> => {
    console.log('🔍 Iniciando busca de notícias (Multi-source)...');

    let allNews: NewsItem[] = [];

    // 1. Tentar CryptoCompare (Direto e Proxy)
    const ccNews = await fetchFromCryptoCompare(false);
    if (ccNews.length > 0) {
        allNews = [...allNews, ...ccNews];
    } else {
        const ccProxyNews = await fetchFromCryptoCompare(true);
        allNews = [...allNews, ...ccProxyNews];
    }

    // 2. Buscar de RSS Feeds aleatórios para complementar (escolher 2 aleatórios para não demorar)
    const randomFeeds = RSS_FEEDS.sort(() => 0.5 - Math.random()).slice(0, 2);

    const rssPromises = randomFeeds.map(feed => fetchRSS(feed.name, feed.url));
    const rssResults = await Promise.all(rssPromises);

    rssResults.forEach(items => {
        allNews = [...allNews, ...items];
    });

    // 3. Filtrar, Ordenar e Limitar
    if (allNews.length === 0) {
        throw new Error('Não foi possível buscar notícias de nenhuma fonte.');
    }

    // Remover duplicatas (por título)
    const uniqueNews = Array.from(new Map(allNews.map(item => [item.title, item])).values());

    // Ordenar por data (mais recente primeiro)
    uniqueNews.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    // Filtrar por símbolos se fornecidos (opcional, mas bom para relevância)
    // Se não encontrar notícias específicas, retorna as gerais
    let relevantNews = uniqueNews;
    if (symbols.length > 0) {
        const symbolNews = uniqueNews.filter(item =>
            item.currencies.some(c => symbols.includes(c)) ||
            symbols.some(s => item.title.includes(s))
        );
        if (symbolNews.length > 0) {
            relevantNews = symbolNews;
        }
    }

    // Formatar para texto
    const newsText = relevantNews.slice(0, limit).map((item, index) => {
        const date = new Date(item.published_at).toLocaleString('pt-BR');
        return `${index + 1}. ${item.title}\n   Fonte: ${item.source} | Data: ${date}`;
    }).join('\n\n');

    console.log(`✅ ${relevantNews.length} notícias agregadas com sucesso!`);
    return `NOTÍCIAS AGREGADAS (${relevantNews.length} fontes):\n\n${newsText}`;
};

/**
 * Busca notícias importantes/críticas para alertas
 */
export const fetchCriticalNews = async (symbols: string[]): Promise<NewsItem[]> => {
    // Reutiliza a lógica de agregação mas foca em CryptoCompare que tem categorização melhor
    const news = await fetchFromCryptoCompare(false);
    return news.slice(0, 5);
};

export const fetchTrendingCryptoNews = async (limit: number = 5): Promise<string> => {
    return fetchCryptoNews([], limit);
};
