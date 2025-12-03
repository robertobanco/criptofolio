
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { ChatMessage, CriticalAlert, SentimentAnalysisResult } from "../types";

// Interface para compatibilidade com o código existente
export interface GenerateContentResponse {
    text: string;
    candidates?: any[];
}

// Lista de modelos para tentar em ordem de preferência
const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

// Helper para tentar executar uma ação com fallback de múltiplos modelos
async function executeWithFallback(
    genAI: GoogleGenerativeAI,
    action: (modelName: string) => Promise<string>
): Promise<string> {
    const modelsToTry = MODELS_TO_TRY;
    let lastError: any;

    for (const modelName of modelsToTry) {
        try {
            return await action(modelName);
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || "";
            // Se for erro 404 (Not Found) ou fetch error, tenta o próximo
            if (errorMessage.includes("404") || errorMessage.includes("not found") || errorMessage.includes("fetch")) {
                console.warn(`Falha com modelo ${modelName}, tentando próximo...`);
                continue;
            }
            // Se for outro erro (ex: quota, auth), para imediatamente
            throw error;
        }
    }
    throw lastError;
}

export const verifyGeminiApiKey = async (apiKey: string): Promise<{ isValid: boolean; error?: string }> => {
    if (!apiKey) {
        return { isValid: false, error: 'A chave não pode estar vazia.' };
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Tenta validar iterando pelos modelos
        await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.generateContent("Hello");
            return "OK";
        });

        return { isValid: true };
    } catch (error) {
        console.error("Gemini API Key verification failed:", error);

        // DIAGNÓSTICO: Tentar listar os modelos disponíveis para esta chave
        let availableModelsMsg = "";
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (response.ok) {
                const data = await response.json();
                if (data.models) {
                    const modelNames = data.models
                        .map((m: any) => m.name.replace('models/', ''))
                        .filter((n: string) => n.includes('gemini')); // Filtrar apenas modelos gemini para brevidade
                    availableModelsMsg = ` | Modelos detectados na sua conta: ${modelNames.join(', ')}`;
                }
            }
        } catch (e) {
            console.error("Falha no diagnóstico de modelos:", e);
        }

        if (error instanceof Error) {
            const errorMessage = error.message;

            if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                return { isValid: false, error: 'Limite de quota da API atingido.' };
            }

            if (errorMessage.includes('400') || errorMessage.includes('key')) {
                return { isValid: false, error: 'Chave de API inválida.' };
            }

            return { isValid: false, error: `Erro: ${errorMessage}${availableModelsMsg}` };
        }
        return { isValid: false, error: `Erro desconhecido na verificação.${availableModelsMsg}` };
    }
};

const createAiClient = (apiKey: string | undefined): GoogleGenerativeAI | null => {
    if (!apiKey) {
        console.error("Chave de API do Gemini não configurada.");
        return null;
    }
    return new GoogleGenerativeAI(apiKey);
};

const handleApiError = (error: unknown, context: string): Error => {
    console.error(`Erro Gemini em ${context}:`, error);
    if (error instanceof Error) {
        return new Error(`Erro na IA: ${error.message}`);
    }
    return new Error("Erro desconhecido na IA.");
};

export const generateChatResponse = async (
    apiKey: string,
    chatHistory: ChatMessage[],
    portfolioContext: string,
    enableWebSearch: boolean,
    newsContext?: string
): Promise<GenerateContentResponse> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) {
        return { text: "Erro: Chave API não configurada." };
    }

    // Limitar tamanho das notícias para não estourar tokens (aprox 2000 caracteres)
    const safeNewsContext = newsContext ? newsContext.substring(0, 2000) : '';

    const systemInstruction = `Você é o Cripto Control AI, especialista em criptomoedas.
    
    REGRA DE OURO: Use o JSON abaixo como ÚNICA fonte de verdade para números do portfólio.
    
    DADOS DO PORTFÓLIO:
    \`\`\`json
    ${portfolioContext}
    \`\`\`
    
    ${enableWebSearch ?
            `VOCÊ TEM ACESSO À BUSCA DO GOOGLE.
             - Use a ferramenta de busca para encontrar informações ATUALIZADAS sobre o mercado, notícias recentes e eventos relevantes.
             - Se o usuário perguntar sobre "notícias", "mercado hoje", "por que caiu/subiu", USE A BUSCA.
             - IMPORTANTE: Quando citar uma fonte da busca, você DEVE incluir a URL COMPLETA que a ferramenta de busca retornou.
             - Formato obrigatório para fontes: [Nome do Site - Título](URL_COMPLETA_AQUI)
             - Exemplo correto: [CoinDesk - Bitcoin sobe 5%](https://www.coindesk.com/markets/2024/...)
             - NÃO use textos genéricos como "IA Analysis + Web". Use URLs REAIS dos resultados da busca.` :
            'Use apenas os dados do portfólio fornecidos acima para sua análise.'}
    
    ${safeNewsContext ? `CONTEXTO ADICIONAL (RSS): ${safeNewsContext}` : ''}

    INSTRUÇÕES PARA ANÁLISE DE VARIAÇÕES:
    1. Identifique as maiores variações (positivas e negativas) no portfólio.
    2. Para cada ativo com variação significativa (>5% ou <-5%), USE A BUSCA DO GOOGLE para encontrar o motivo RECENTE (últimos 3-7 dias).
    3. Quando encontrar uma notícia específica na busca, cite-a com o link COMPLETO no formato: [Título da Notícia](URL_completa)
    4. Se não encontrar nada específico, mencione o movimento geral do mercado (ex: Bitcoin puxando altcoins).
    5. NÃO diga "não há notícias no feed". Busque ativamente.
    6. OBRIGATÓRIO: Ao citar fontes da busca do Google, SEMPRE inclua a URL real retornada pela ferramenta.
    
    Responda em Markdown com formatação clara.`;

    console.log('🤖 Gerando resposta da IA...');

    try {
        const text = await executeWithFallback(genAI, async (modelName) => {
            const tools = enableWebSearch ? [{ googleSearch: {} }] : [];

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                tools: tools as any
            });

            // Converter histórico para formato da API
            const fullHistory = chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: (msg as any).content || (msg as any).text || (msg.parts && msg.parts[0] ? msg.parts[0].text : "") }]
            }));

            // Separar a última mensagem (pergunta atual)
            const lastMessage = fullHistory.pop();
            if (!lastMessage) throw new Error("Conversa vazia.");

            // Limitar histórico anterior para não estourar tokens
            // Manter apenas as últimas 10 mensagens anteriores
            const limitedHistory = fullHistory.slice(-10);

            // IMPORTANTE: A API Gemini exige que o histórico comece com 'user'
            while (limitedHistory.length > 0 && limitedHistory[0].role === 'model') {
                limitedHistory.shift(); // Remove a primeira mensagem se for 'model'
            }

            const chat = model.startChat({
                history: limitedHistory,
                generationConfig: {
                    maxOutputTokens: 8192, // Aumentado para permitir respostas longas
                    temperature: 0.7,
                }
            });

            const result = await chat.sendMessage(lastMessage.parts[0].text);
            const response = await result.response;

            console.log('📦 Resposta Bruta Gemini:', JSON.stringify(response, null, 2));

            const text = response.text();
            console.log('📝 Texto extraído:', text ? text.substring(0, 50) + '...' : 'VAZIO');

            return text;
        });

        return { text };
    } catch (error) {
        console.error('Erro fatal no geminiService:', error);
        return { text: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente." };
    }
};

export const generateDailyBriefing = async (apiKey: string, portfolioContext: string): Promise<string> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) return "Erro: Chave API não configurada.";

    const systemInstruction = `Analista Cripto Control AI. Gere um Briefing Diário conciso.
    FOCO: Eventos das últimas 24h no portfólio.
    Use emojis. Seja direto.`;

    try {
        return await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction
            });
            const result = await model.generateContent(`Analise este portfólio e crie um briefing: ${portfolioContext}`);
            return result.response.text();
        });
    } catch (error) {
        const err = handleApiError(error, "generateDailyBriefing");
        return `Erro: ${err.message}`;
    }
};

export const generateMarketSentiment = async (apiKey: string, assetSymbol: string, historicalPriceContext: string | null): Promise<string> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) throw new Error("Chave API não configurada.");

    const systemInstruction = `Analista de sentimento crypto.
    SAÍDA OBRIGATÓRIA: JSON estrito { "asset": string, "sentiment": "Positivo"|"Neutro"|"Negativo", "summary": string, "positive_points": string[], "negative_points": string[] }
    Sem markdown, apenas JSON.`;

    try {
        return await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                generationConfig: { responseMimeType: "application/json" },
                // @ts-ignore
                tools: [{ googleSearch: {} }] // Enable search for sentiment analysis
            });
            const prompt = `Sentimento para ${assetSymbol}. Use a busca para encontrar notícias RECENTES. Dados históricos: ${historicalPriceContext || "Sem dados históricos."}`;
            const result = await model.generateContent(prompt);
            return result.response.text();
        });
    } catch (error) {
        throw handleApiError(error, "generateMarketSentiment");
    }
};

export const generateCriticalAlerts = async (apiKey: string, assetSymbols: string[]): Promise<string> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) throw new Error("Chave API não configurada.");

    const systemInstruction = `Você é um analista de risco de criptomoedas.
    
    TAREFA: Analise os seguintes ativos e retorne APENAS alertas CRÍTICOS (hacks, delistagens, falências, vulnerabilidades graves).
    USE A BUSCA DO GOOGLE para verificar informações recentes.
    
    Se você NÃO encontrar eventos críticos recentes, retorne um array vazio [].
    
    FORMATO DE SAÍDA: Array JSON de objetos com: { "asset": "SÍMBOLO", "severity": "high"|"critical", "message": "descrição breve em Português" }
    
    Seja HONESTO. Não invente alertas.`;

    try {
        return await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                generationConfig: { responseMimeType: "application/json" },
                // @ts-ignore
                tools: [{ googleSearch: {} }]
            });
            const result = await model.generateContent(`Verifique alertas críticos para: ${assetSymbols.join(', ')}`);
            return result.response.text();
        });
    } catch (error) {
        throw handleApiError(error, "generateCriticalAlerts");
    }
};

export const startRebalanceChat = (apiKey: string, portfolioContext: string, lockedAllocations: Record<string, number>, allPossibleAssets: string[]): any => {
    const genAI = createAiClient(apiKey);
    if (!genAI) return null;

    const systemInstruction = `Assistente de rebalanceamento. Ajude a definir alocação % alvo.
    Ao final, forneça JSON { "TICKER": % }.
    Contexto: ${portfolioContext}`;

    // Usar o primeiro modelo disponível da lista de fallback
    const modelName = MODELS_TO_TRY[0];

    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
    });

    return model.startChat();
};

export const continueRebalanceChat = async (chat: any, message: string): Promise<string> => {
    try {
        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (error) {
        const err = handleApiError(error, "continueRebalanceChat");
        return `Erro: ${err.message}`;
    }
};

export interface AICriticalAlert {
    asset: string;
    summary: string; // Em português
    severity: 'Alta' | 'Média';
    sourceUrl?: string;
}

export const analyzeCriticalNews = async (
    apiKey: string,
    newsContext: string,
    assets: string[]
): Promise<AICriticalAlert[]> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) return [];

    const prompt = `
    Você é um analista de risco cripto.
    
    ATIVOS DO PORTFÓLIO: ${assets.join(', ')}
    
    NOTÍCIAS (RSS):
    ${newsContext.substring(0, 3000)}
    
    TAREFA:
    1. Use a ferramenta de BUSCA DO GOOGLE para verificar se há eventos CRÍTICOS recentes (últimas 24h-48h) afetando estes ativos (Hacks, Processos, Delistings, Quedas > 20%).
    2. Combine com as notícias do RSS fornecidas.
    3. Identifique APENAS eventos de ALTO RISCO. Ignore oscilações normais de mercado.
    4. Gere alertas em PORTUGUÊS.
    
    Retorne APENAS um JSON (sem markdown) no formato:
    [
        {
            "asset": "BTC",
            "summary": "Resumo curto e direto do risco em português",
            "severity": "Alta",
            "sourceUrl": "Link da notícia se houver"
        }
    ]
    
    Se não houver nada crítico, retorne [].
    `;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" },
            // @ts-ignore
            tools: [{ googleSearch: {} }]
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return JSON.parse(text) as AICriticalAlert[];
    } catch (error) {
        console.error("Erro na análise de notícias críticas:", error);
        return [];
    }
};

export const generateStrategyAllocation = async (apiKey: string, prompt: string, currentAssets: string[], allPossibleAssets: string[]): Promise<string> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) throw new Error("Chave API não configurada.");

    const systemInstruction = `Especialista em alocação. Gere JSON { "TICKER": % } somando 100%.
    Sem markdown.`;

    try {
        return await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(`Estratégia: ${prompt}. Ativos atuais: ${currentAssets.join(', ')}`);
            return result.response.text();
        });
    } catch (error) {
        throw handleApiError(error, "generateStrategyAllocation");
    }
};