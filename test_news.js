async function testUrl(name, url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
            console.log(`✅ ${name}: SUCCESS (${response.status})`);
            const data = await response.json();
            if (name === 'CryptoCompare') {
                console.log('Keys:', Object.keys(data));
                if (data.Data) {
                    console.log('Data type:', Array.isArray(data.Data) ? 'Array' : typeof data.Data);
                    console.log('First item:', data.Data[0]);
                }
            }
        } else {
            console.log(`❌ ${name}: FAILED (${response.status})`);
        }
    } catch (error) {
        console.log(`❌ ${name}: ERROR (${error.message})`);
    }
}

async function run() {
    console.log("Testing APIs...");
    await testUrl('CryptoCompare', 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    await testUrl('CoinGecko', 'https://api.coingecko.com/api/v3/news');
    await testUrl('Messari', 'https://data.messari.io/api/v1/news');
    await testUrl('CoinMarketCap', 'https://api.coinmarketcap.com/data-api/v3/headlines/latest');
    await testUrl('CryptoPanic', 'https://cryptopanic.com/api/free/v1/posts/?public=true&kind=news');
}

run();
