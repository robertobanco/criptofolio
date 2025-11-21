
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import type { ChatMessage, CriticalAlert, SentimentAnalysisResult } from "../types";

export const verifyGeminiApiKey = async (apiKey: string): Promise<{isValid: boolean; error?: string}> => {
    if (!apiKey) {
        return { isValid: false, error: 'A chave não pode estar vazia.' };
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'test',
        });
        return { isValid: true };
    } catch (error) {
        console.error("Gemini API Key verification failed:", error);
        if (error instanceof Error) {
            if (error.message.includes('API_KEY_INVALID') || error.message.includes('permission')) {
                 return { isValid: false, error: 'A chave de API fornecida é inválida ou não tem permissão.' };
            }
             return { isValid: false, error: `Erro: ${error.message}` };
        }
        return { isValid: false, error: 'Ocorreu um erro desconhecido durante a verificação.' };
    }
};

const createAiClient = (apiKey: string | undefined): GoogleGenAI | null => {
    if (!apiKey) {
        console.error("Chave de API do Gemini não configurada.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: unknown, context: string): Error => {
    console.error(`Erro ao interagir com a API Gemini em ${context}:`, error);
    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('resource_exhausted') || errorMessage.includes('429')) {
            return new Error("Limite de solicitações à API atingido. Por favor, tente novamente mais tarde.");
        }
        
        if (errorMessage.includes('overloaded') || errorMessage.includes('503') || errorMessage.includes('unavailable')) {
            return new Error("O modelo de IA está sobrecarregado no momento. Por favor, tente novamente em alguns instantes.");
        }
        
        // General Gemini API error
        return new Error(`Erro na API Gemini: ${error.message}`);
    }
    
    return new Error("Ocorreu um erro desconhecido na API Gemini.");
};


export const generateChatResponse = async (apiKey: string, chatHistory: ChatMessage[], portfolioContext: string, enableWebSearch: boolean): Promise<GenerateContentResponse> => {
    const ai = createAiClient(apiKey);
    if (!ai) {
        // Retornar um objeto compatível com GenerateContentResponse em caso de erro
        const errorResponse: GenerateContentResponse = {
            text: "Erro: A chave de API do Gemini não está configurada. Por favor, adicione-a nas Configurações.",
            candidates: [],
        };
        return Promise.resolve(errorResponse);
    }

    const systemInstruction = `Você é um analista financeiro especialista em criptomoedas. Seu nome é CryptoFolio AI. Sua análise será baseada no JSON de dados do portfólio fornecido abaixo.

**REGRA MESTRA INVIOLÁVEL:** SEMPRE use o JSON fornecido como a ÚNICA fonte para todos os números (preços, valores, datas, variações). A busca na web (Google Search) é APENAS para contexto (notícias, o "porquê"). NUNCA, em nenhuma circunstância, use a busca web para obter ou corrigir dados numéricos. A informação do JSON é a verdade absoluta.

**REGRA MAIS IMPORTANTE:** Para qualquer cálculo relativo a datas (ex: "últimos 7 dias", "mês passado"), você **DEVE** usar a chave \`currentDate\` fornecida no JSON abaixo como a data de "hoje".

**DADOS ATUAIS DO PORTFÓLIO PARA ANÁLISE:**
\`\`\`json
${portfolioContext}
\`\`\`

**ESTRUTURA DOS DADOS (CONTIDA NO BLOCO JSON ACIMA):**
- \`currentDate\`: A data de hoje no formato 'YYYY-MM-DD'. **USE ESTA DATA** para todos os cálculos de tempo.
- \`generalSummary\`: Resumo com valor total, custo total, lucro total. Todos os valores estão em BRL (Reais).
- \`assetPerformance\`: Array com o desempenho atual de cada ativo que o usuário POSSUI.
- \`profitAnalysis\`: Array com análise de lucro detalhada por ativo POSSUÍDO.
- \`transactions\`: Array com todas as transações de compra e venda. **NOTA:** Esta lista contém dados otimizados dos últimos 180 dias.
- \`watchlist\`: Array de símbolos que o usuário está OBSERVANDO, mas não necessariamente possui.
- \`portfolioHistory\`: Array com a evolução diária do VALOR TOTAL da carteira. **NOTA:** Este array contém dados otimizados dos últimos 30 dias.
- \`historicalAssetValues\`: **DADO CRÍTICO.** Um objeto onde cada chave é o símbolo de um ativo (ex: "BTC"), e o valor é outro objeto mapeando datas ('YYYY-MM-DD') para o **PREÇO UNITÁRIO DAQUELE ATIVO** em BRL naquele dia. Este objeto é a sua fonte da verdade para preços históricos. **NOTA:** Este objeto contém dados otimizados dos últimos 30 dias.

**SUA TAREFA:**
Sua tarefa é responder às perguntas do usuário com a máxima precisão, seguindo uma hierarquia estrita de fontes de dados.

**DIRETIVA ESPECIAL PARA "VARIAÇÕES RECENTES":**
Ao analisar "variações recentes" (ex: "Analise as maiores variações recentes..."), sua análise deve focar nos **últimos 10 dias** de dados disponíveis, com **ênfase especial e detalhada nos últimos 3 dias**. Use os dados de \`historicalAssetValues\` para calcular essas variações.

**HIERARQUIA E REGRAS DE FONTES DE DADOS:**

1.  **FONTE DA VERDADE PARA NÚMEROS:** O JSON do portfólio fornecido acima é a sua **ÚNICA E ABSOLUTA FONTE DA VERDADE** para todos os dados numéricos, incluindo:
    *   Preços históricos (use \`historicalAssetValues\`).
    *   Valores de posições atuais (use \`assetPerformance\`).
    *   **REGRA DE VARIAÇÃO:** A chave \`variation\` em \`assetPerformance\` é a variação TOTAL. Para qualquer pergunta sobre variação RECENTE, você DEVE calcular a variação usando os preços diários de \`historicalAssetValues\`, seguindo a diretiva especial acima.
    *   Quantidades, datas de transação, etc.
    *   **NUNCA** use a busca na web para obter preços, valores de carteira ou qualquer outro dado numérico que já esteja presente no JSON.
    *   Todos os valores monetários no JSON estão em Reais (BRL). Responda sempre em BRL, a menos que o usuário peça explicitamente outra moeda.

2.  **FUNÇÃO DA BUSCA NA WEB (Google Search):** A busca na web deve ser usada **APENAS** para obter **CONTEXTO** e o **"PORQUÊ"** por trás dos números que você observa nos dados. Exemplos de bom uso:
    *   Encontrar notícias que justifiquem uma queda de preço que você identificou nos dados históricos.
    *   Pesquisar sobre atualizações de um projeto.
    *   Buscar o sentimento geral do mercado.

**COMO COMBINAR DADOS E BUSCA NA WEB (QUANDO HABILITADA):**
Sua principal tarefa é **conectar** os fatos numéricos dos dados do portfólio com o contexto encontrado na web.

*   **Exemplo de Resposta CORRETA:** "Com base nos seus dados, vejo que o FET caiu 4% ontem, de R$2,88 para R$2,76. Uma busca na web sugere que isso pode estar relacionado a notícias sobre X e Y."
*   **Exemplo de Resposta INCORRETA (PROIBIDO):** "A busca na web diz que o FET caiu de $46.000 para $2.000." (Isto é uma alucinação e ignora os dados precisos fornecidos).

**REGRA CRÍTICA - BUSCA DE DADOS INTERNOS:**
Se a busca na web **NÃO** estiver habilitada, e o usuário perguntar sobre um ativo cujo histórico de preços **NÃO** está presente no objeto \`historicalAssetValues\`, você **NÃO DEVE** tentar responder. Em vez disso, sua resposta deve ser **APENAS E EXCLUSIVAMENTE** um objeto JSON no seguinte formato, sem nenhum outro texto:
\`{"request_historical_data_for": ["ATIVO1", "ATIVO2"]}\`

**REGRAS GERAIS DE RESPOSTA (QUANDO NÃO FOR UMA SOLICITAÇÃO DE DADOS):**
1.  **Formato Amigável:** Formate suas respostas usando markdown. Use **negrito** e listas (*).
2.  **Use Emojis:** Incorpore emojis relevantes (ex: 📈, 📉, 💰, 📰).
3.  **Seja Preciso e Útil:** Forneça respostas claras e acionáveis baseadas na hierarquia de dados.
4.  **Mensagens do Sistema:** Mensagens que começam com "[SYSTEM]" são para seu conhecimento. Apenas use a nova informação para responder à pergunta anterior do usuário.
`;

    // FIX: The config properties for generateContent should be passed inside a 'config' object.
    const request: any = {
        model: 'gemini-2.5-flash',
        contents: chatHistory,
        config: {
            systemInstruction: systemInstruction,
        },
    };
    
    if (enableWebSearch) {
        request.config.tools = [{googleSearch: {}}];
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent(request);
        let responseText = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const validChunks = groundingChunks.filter((chunk: any) =>
                chunk && chunk.web && typeof chunk.web.title === 'string' && typeof chunk.web.uri === 'string'
            );

            if (validChunks.length > 0) {
                const sources = validChunks
                    .map((chunk: any) => {
                        const cleanTitle = chunk.web.title.replace(/\[/g, '(').replace(/\]/g, ')');
                        return `* [${cleanTitle}](${chunk.web.uri})`;
                    })
                    .join('\n');
                responseText += `\n\n**Fontes:**\n${sources}`;
            }
        }
        
        // Return a modified response object, not just the text
        const finalResponse: GenerateContentResponse = {
            ...response,
            text: responseText,
        };
        return finalResponse;

    } catch (error) {
        const handledError = handleApiError(error, "generateChatResponse");
        const errorResponse: GenerateContentResponse = {
            text: `Erro ao processar sua pergunta: ${handledError.message}`,
            candidates: [],
        };
        return Promise.resolve(errorResponse);
    }
};

export const generateDailyBriefing = async (apiKey: string, portfolioContext: string): Promise<string> => {
    const ai = createAiClient(apiKey);
    if (!ai) return "Erro: Chave de API do Gemini não configurada. Por favor, adicione-a nas Configurações.";

    const systemInstruction = `Você é um analista de portfólio de criptomoedas chamado CryptoFolio AI. Sua tarefa é analisar o JSON do portfólio do usuário e gerar um "Briefing Diário" conciso e relevante.

**OBJETIVO PRINCIPAL:** Responder à pergunta: "O que aconteceu de importante com minha carteira hoje que eu preciso saber?"

**REGRAS ESTRITAS:**
1.  **FOCO NO RECENTE:** Sua análise DEVE priorizar eventos das últimas 24 horas e da última semana. Use o objeto \`portfolioHistory\` para identificar variações recentes no valor total.
2.  **IDENTIFIQUE OSCILAÇÕES ATÍPICAS:** Destaque qualquer queda ou alta expressiva (ex: > 5%) no valor total da carteira ou em ativos individuais importantes.
3.  **USE A BUSCA NA WEB (OBRIGATÓRIO):** Você DEVE usar a ferramenta Google Search para encontrar notícias, eventos de mercado ou atualizações de projetos que possam justificar as oscilações significativas que você identificar. **Sua principal função é conectar os movimentos da carteira com eventos do mundo real.**
4.  **SEJA CONCISO E ACIONÁVEL:** Forneça de 2 a 4 pontos principais em formato de lista com marcadores (*). Cada ponto deve ser direto e informativo.
5.  **DESTAQUE O IMPORTANTE:** Use **negrito** para nomes de ativos, percentuais e números chave.
6.  **EVITE O ÓBVIO:** Não relate apenas o desempenho geral se nada de especial aconteceu. Foque no que é notícia, no que é atípico. Se a carteira está estável, mencione isso brevemente e procure notícias relevantes sobre os principais ativos.

**EXEMPLO DE RESPOSTA (se a carteira caiu 8%):**
*   📉 Sua carteira teve uma **queda significativa de 8%** nas últimas 24 horas. A maior parte do impacto veio do **Ethereum (ETH)**, que caiu **12%**.
*   📰 **Por que isso aconteceu?** A busca na web indica que a queda do ETH está ligada a preocupações regulatórias anunciadas hoje nos EUA. O mercado geral de cripto também reagiu negativamente.
*   📈 **Ponto de atenção:** Apesar da queda, **Solana (SOL)** mostrou resiliência, subindo **3%** no mesmo período, possivelmente devido ao anúncio de uma nova parceria.
    `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Baseado no seguinte JSON de dados da carteira, gere o Briefing Diário, por favor: \n\n${portfolioContext}`,
            config: {
                systemInstruction: systemInstruction,
                tools: [{googleSearch: {}}],
            },
        });
        let responseText = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const validChunks = groundingChunks.filter((chunk: any) => 
                chunk && chunk.web && typeof chunk.web.title === 'string' && typeof chunk.web.uri === 'string'
            );

            if (validChunks.length > 0) {
                 const sources = validChunks
                    .map((chunk: any) => {
                        // Sanitize title to prevent breaking markdown link format if it contains brackets
                        const cleanTitle = chunk.web.title.replace(/\[/g, '(').replace(/\]/g, ')');
                        return `* [${cleanTitle}](${chunk.web.uri})`;
                    })
                    .join('\n');
                responseText += `\n\n**Fontes:**\n${sources}`;
            }
        }
        return responseText;
    } catch (error) {
        const handledError = handleApiError(error, "generateDailyBriefing");
        return `Erro ao gerar briefing diário: ${handledError.message}`;
    }
};

export const generateMarketSentiment = async (apiKey: string, assetSymbol: string, historicalPriceContext: string | null): Promise<string> => {
    const ai = createAiClient(apiKey);
    if (!ai) throw new Error("A chave de API do Gemini não está configurada. Por favor, adicione-a nas Configurações.");

    const systemInstruction = `Você é um analista de sentimento de mercado de criptomoedas de elite. Sua tarefa é fornecer uma análise precisa e contextualizada para um ativo específico.

**PROCESSO OBRIGATÓRIO:**
1.  **ANÁLISE DE DADOS PRIMEIRO:** Se forem fornecidos dados de preços históricos, você **DEVE** começar por aí. Analise os dados para identificar movimentos de preços extremos e recentes (ex: quedas ou altas acentuadas nos últimos 7-14 dias).
2.  **BUSCA NA WEB DIRECIONADA:** Use os movimentos de preços identificados como o ponto de partida para sua busca na web (Google Search). Por exemplo, se você notar uma queda de 80%, sua busca deve ser focada em "notícias sobre a queda de ${assetSymbol}", "delistagem de ${assetSymbol}", "problemas com ${assetSymbol}".
3.  **SÍNTESE:** Combine sua análise dos dados de preço com as notícias e informações encontradas na web. Sua resposta final deve **conectar** o movimento do preço com a causa.
4.  **SEMPRE VERIFIQUE EVENTOS CRÍTICOS:** Priorize a busca por notícias sobre delistagens de corretoras (especialmente Binance), hacks, falhas de segurança, ou grandes parcerias. Estes são os fatores mais importantes.

**SAÍDA:**
Sua resposta DEVE ser estritamente no formato JSON, sem nenhum outro texto ou formatação. O sentimento ('Positivo', 'Neutro', 'Negativo') deve refletir de forma realista os eventos recentes. Se um ativo foi delistado e caiu 80%, o sentimento NÃO PODE ser 'Neutro' ou 'Positivo'. O JSON deve ter a seguinte estrutura: { "asset": string, "sentiment": string, "summary": string, "positive_points": string[], "negative_points": string[] }`;

    let userPrompt = `Qual é o sentimento de mercado atual para ${assetSymbol}?`;
    if (historicalPriceContext) {
        userPrompt = `Baseado nos dados de preços recentes para ${assetSymbol} abaixo, investigue as causas para os movimentos e determine o sentimento de mercado atual.

Dados de Preço (últimos 14 dias, data: preço em BRL):
\`\`\`json
${historicalPriceContext}
\`\`\`
`;
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{googleSearch: {}}],
            },
        });
        return response.text;
    } catch (error) {
        throw handleApiError(error, `generateMarketSentiment for ${assetSymbol}`);
    }
};

export const generateCriticalAlerts = async (apiKey: string, assetSymbols: string[]): Promise<string> => {
    const ai = createAiClient(apiKey);
    if (!ai) throw new Error("A chave de API do Gemini não está configurada.");

    const systemInstruction = `Você é um analista de risco de criptomoedas. Sua ÚNICA tarefa é usar a busca na web (Google Search) para encontrar notícias CRÍTICAS e de ALTO IMPACTO NEGATIVO sobre os ativos fornecidos.

**REGRAS ESTRITAS:**
1.  **FOCO EXCLUSIVO:** Procure APENAS por:
    *   **Delistagens de corretoras importantes (Binance, Coinbase, Kraken).**
    *   **Hacks ou explorações de segurança no protocolo do ativo.**
    *   **Ações regulatórias severas contra o projeto.**
    *   **Anúncios de falência ou insolvência do projeto.**
2.  **RELEVÂNCIA TEMPORAL:** A notícia DEVE ser extremamente recente, publicada nos **últimos 7 dias**. Ignore eventos mais antigos, mesmo que sejam críticos.
3.  **IGNORE O RUÍDO:** NÃO relate sobre quedas normais de preço, FUD (medo, incerteza e dúvida) genérico, ou notícias de baixo impacto.
4.  **SEJA CONCISO:** O resumo ('summary') deve ser uma frase única e direta explicando o problema.
5.  **SAÍDA SOMENTE JSON:** Sua resposta DEVE ser um array de objetos JSON. Se NENHUMA notícia crítica for encontrada, retorne um array vazio \`[]\`. NADA MAIS.
6.  **SEVERIDADE:** Use 'Crítica' para eventos como delistagens da Binance ou hacks confirmados. Use 'Alta' para ações regulatórias ou problemas de segurança significativos.
7.  **FONTE:** Forneça a URL da notícia mais relevante no campo 'source'.`;

    const userPrompt = `Verifique se há alertas críticos para os seguintes ativos: ${assetSymbols.join(', ')}.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{googleSearch: {}}],
            },
        });
        return response.text;
    } catch (error) {
        throw handleApiError(error, `generateCriticalAlerts`);
    }
};


export const startRebalanceChat = (apiKey: string, portfolioContext: string, lockedAllocations: Record<string, number>, allPossibleAssets: string[]): Chat | null => {
    const ai = createAiClient(apiKey);
    if (!ai) {
        console.error("A chave de API do Gemini não está configurada.");
        return null;
    }

    let lockedAssetsContext = "";
    const lockedSymbols = Object.keys(lockedAllocations);
    if (lockedSymbols.length > 0) {
        const totalLockedPercent = Object.values(lockedAllocations).reduce((sum, val) => sum + val, 0);
        const remainingPercent = (100 - totalLockedPercent).toFixed(2);
        const lockedList = lockedSymbols.map(s => `* **${s}**: ${lockedAllocations[s].toFixed(2)}%`).join('\n');
        lockedAssetsContext = `
O usuário já **BLOQUEOU** os seguintes ativos em seus respectivos percentuais. Você **NÃO PODE** alterar a alocação para estes ativos. Sua tarefa é alocar os ${remainingPercent}% restantes entre os outros ativos.
Ativos Bloqueados:
${lockedList}
`;
    }

    const systemInstruction = `Você é um assistente de rebalanceamento de portfólio de criptomoedas.
**Sua Tarefa Principal:** Ajudar o usuário a definir uma alocação de carteira alvo com base em seu perfil de risco e objetivos.
**Regras de Resposta:**
1.  **Análise e Sugestão:** Ao final da conversa, quando tiver informações suficientes, sua resposta DEVE conter um bloco de código JSON com a alocação percentual sugerida. O total dos percentuais no JSON DEVE ser exatamente 100.
2.  **Formato do JSON:** O JSON deve ser um objeto onde as chaves são os tickers dos ativos (ex: "BTC") e os valores são os percentuais (ex: 60).
    \`\`\`json
    {
      "BTC": 60,
      "ETH": 30,
      "ADA": 10
    }
    \`\`\`
3.  **Texto e JSON:** Você PODE e DEVE incluir texto explicativo ANTES do bloco JSON para justificar sua sugestão.
4.  **Use os Ativos do Usuário:** Priorize os ativos que o usuário já possui, mas você PODE sugerir novos ativos da lista \`allPossibleAssets\` se fizer sentido para a estratégia.
5.  **Ativos Bloqueados:** ${lockedAssetsContext || "Nenhum ativo foi bloqueado pelo usuário. Você tem liberdade para alocar 100% da carteira."}
**Contexto do Portfólio Atual:**
\`\`\`json
${portfolioContext}
\`\`\`
**Todos os Ativos Possíveis:** ${allPossibleAssets.join(', ')}
`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return chat;
};

export const continueRebalanceChat = async (chat: Chat, message: string): Promise<string> => {
    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message });
        return response.text;
    } catch (error) {
        const handledError = handleApiError(error, "continueRebalanceChat");
        return `Erro: ${handledError.message}`;
    }
};

export const generateStrategyAllocation = async (apiKey: string, prompt: string, currentAssets: string[], allPossibleAssets: string[]): Promise<string> => {
    const ai = createAiClient(apiKey);
    if (!ai) throw new Error("A chave de API do Gemini não está configurada. Por favor, adicione-a nas Configurações.");

    const systemInstruction = `Você é um especialista em alocação de portfólio de criptomoedas. Sua única tarefa é gerar uma alocação de ativos com base no prompt do usuário.
    
    **REGRAS ESTRITAS:**
    1.  **SAÍDA SOMENTE JSON:** Sua resposta DEVE ser um objeto JSON válido e NADA MAIS. Sem texto, sem explicações, sem markdown.
    2.  **SOMA IGUAL A 100:** A soma de todos os valores percentuais no JSON deve ser exatamente 100.
    3.  **Use Ativos Válidos:** Use os tickers dos ativos que o usuário já possui (\`currentAssets\`) ou outros da lista \`allPossibleAssets\`.
    4.  **Seja Razoável:** Crie uma alocação diversificada. Evite alocar 100% em um único ativo a menos que o usuário peça explicitamente.
    
    **CONTEXTO:**
    - Ativos atuais do usuário: ${currentAssets.join(', ')}
    - Todos os ativos conhecidos: ${allPossibleAssets.slice(0, 100).join(', ')}... (lista parcial)
    
    **EXEMPLO DE SAÍDA VÁLIDA:**
    {
      "BTC": 50,
      "ETH": 30,
      "SOL": 15,
      "ADA": 5
    }
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Gere uma alocação para a seguinte estratégia: "${prompt}"`,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json'
            },
        });
        return response.text;
    } catch (error) {
        throw handleApiError(error, "generateStrategyAllocation");
    }
};