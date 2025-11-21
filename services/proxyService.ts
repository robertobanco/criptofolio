/**
 * Define a estrutura de um serviço de proxy.
 */
interface Proxy {
  name: string;
  buildUrl: (url: string) => string;
}

/**
 * Lista de serviços de proxy disponíveis, cada um com sua forma específica de construir a URL.
 */
export const PROXIES: Record<string, Proxy> = {
  'api.allorigins.win': {
    name: 'api.allorigins.win',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  'thingproxy.freeboard.io': {
    name: 'thingproxy.freeboard.io',
    buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
  },
  'corsproxy.io': {
    name: 'corsproxy.io',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
};

/**
 * Obtém uma URL com proxy usando o serviço selecionado.
 * @param {string} url A URL original a ser passada pelo proxy.
 * @param {string} selectedProxyKey A chave do proxy a ser usado (ex: 'api.allorigins.win').
 * @returns {string} A URL completa com proxy.
 */
export const getProxiedUrl = (url: string, selectedProxyKey: string): string => {
  const proxy = PROXIES[selectedProxyKey];
  if (proxy) {
    return proxy.buildUrl(url);
  }
  // Fallback para um proxy padrão se a chave fornecida for inválida.
  console.warn(`Proxy com a chave '${selectedProxyKey}' não encontrado. Usando 'api.allorigins.win' como padrão.`);
  return PROXIES['api.allorigins.win'].buildUrl(url);
};
