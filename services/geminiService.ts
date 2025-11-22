
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

export const generateChatResponse = async (apiKey: string, chatHistory: ChatMessage[], portfolioContext: string, enableWebSearch: boolean): Promise<GenerateContentResponse> => {
    const genAI = createAiClient(apiKey);
    if (!genAI) {
        return { text: "Erro: Chave API não configurada." };
    }

    const systemInstruction = `Você é o Cripto Control AI, especialista em criptomoedas.
    
    REGRA DE OURO: Use o JSON abaixo como ÚNICA fonte de verdade para números.
    
    DADOS DO PORTFÓLIO:
    \`\`\`json
    ${portfolioContext}
    \`\`\`
    
    Se a busca web estiver ativa, use-a APENAS para contexto (notícias), NUNCA para substituir os números do JSON.
    Responda em Markdown.`;

    try {
        const text = await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction
            });

            // Converter histórico para o formato do Gemini
            // ChatMessage geralmente tem 'role' e 'content' (ou 'text')
            const history = chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: (msg as any).content || (msg as any).text || "" }]
            }));

            const lastMessage = history.pop();
            if (!lastMessage) throw new Error("Conversa vazia.");

            // IMPORTANTE: A API Gemini exige que o histórico comece com 'user'
            // Se após remover a última mensagem, o histórico começar com 'model', removemos até encontrar 'user'
            while (history.length > 0 && history[0].role === 'model') {
                history.shift(); // Remove a primeira mensagem se for 'model'
            }

            const chatConfig: any = {
                history: history,
                generationConfig: {
                    maxOutputTokens: 2000,
                },
            };

            // Habilitar busca web se solicitado (Google Search grounding)
            if (enableWebSearch) {
                chatConfig.tools = [{
                    googleSearchRetrieval: {}
                }];
            }

            const chat = model.startChat(chatConfig);

            const result = await chat.sendMessage(lastMessage.parts[0].text);
            const response = await result.response;
            return response.text();
        });

        return { text };

    } catch (error) {
        const err = handleApiError(error, "generateChatResponse");
        return { text: `Erro: ${err.message}` };
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
                generationConfig: { responseMimeType: "application/json" }
            });
            const prompt = `Sentimento para ${assetSymbol}. Dados: ${historicalPriceContext || "Sem dados históricos."}`;
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

    const systemInstruction = `Analista de risco crypto. Busque APENAS alertas CRÍTICOS (hacks, delistagens) recentes (7 dias).
    SAÍDA: Array JSON de alertas. Se nada, retorne [].
    Sem markdown.`;

    try {
        return await executeWithFallback(genAI, async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(`Alertas para: ${assetSymbols.join(', ')}`);
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