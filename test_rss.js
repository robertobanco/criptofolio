async function testRSS(name, rssUrl) {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                console.log(`✅ ${name}: SUCCESS (${data.items.length} items)`);
                console.log(`   Exemplo: ${data.items[0].title}`);
            } else {
                console.log(`❌ ${name}: FAILED (Status: ${data.status})`);
            }
        } else {
            console.log(`❌ ${name}: FAILED (HTTP ${response.status})`);
        }
    } catch (error) {
        console.log(`❌ ${name}: ERROR (${error.message})`);
    }
}

async function run() {
    console.log("Testing RSS Feeds...");
    await testRSS('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/');
    await testRSS('Cointelegraph', 'https://cointelegraph.com/rss');
    await testRSS('Decrypt', 'https://decrypt.co/feed');
    await testRSS('Bitcoin.com', 'https://news.bitcoin.com/feed/');
    await testRSS('CryptoPotato', 'https://cryptopotato.com/feed/');
}

run();
