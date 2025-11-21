









import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../types';
import Button from '../ui/Button';

interface AIRebalanceViewProps {
  history: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onApplySuggestion: (suggestion: Record<string, number>, analysisText: string) => void;
  onCompare: (suggestion: Record<string, number>) => void;
  onShare: (text: string, title?: string) => void;
}

const suggestedResponses = [
    "Crescimento Agressivo",
    "Balanceado",
    "Preservação de Capital",
];

const renderMessage = (text: string) => {
    const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;
    const analysisText = text.replace(jsonBlockRegex, '').trim();
    
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    let suggestionHtml = '';
    if (match && match[1]) {
        try {
            let jsonString = match[1].trim();
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }
            const parsed = JSON.parse(jsonString);
            
            suggestionHtml = '<div class="mt-3 pt-2 border-t border-gray-600/50"><h4 class="font-semibold text-sm mb-1 text-indigo-300">📊 Plano de Alocação Sugerido:</h4><ul class="space-y-1">';
            const sortedEntries = Object.entries(parsed).sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0));
            
            for (const [key, value] of sortedEntries) {
                if (typeof value === 'number' || typeof value === 'string') {
                    const numericValue = Number(value);
                    if (isFinite(numericValue)) {
                         suggestionHtml += `<li class="flex justify-between text-sm"><span>${key}</span><strong class="font-mono">${numericValue.toFixed(2)}%</strong></li>`;
                    }
                }
            }
            suggestionHtml += '</ul></div>';
        } catch (e) {
            // JSON malformado, não renderiza a sugestão
        }
    }

    let analysisHtml = analysisText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(\n\s*[*|-|•]\s+.*)+/g, (match) => {
        const items = match.trim().split('\n').map(item => `<li>${item.replace(/[*|-|•]\s*/, '').trim()}</li>`).join('');
        return `<ul class="list-disc pl-5">${items}</ul>`;
      })
      .replace(/\n/g, '<br />')
      .replace(/<\/li><br \/>/g, '</li>');

    return { __html: analysisHtml + suggestionHtml };
};


const AIRebalanceView: React.FC<AIRebalanceViewProps> = ({ history, isThinking, onSendMessage, onApplySuggestion, onCompare, onShare }) => {
  const [input, setInput] = useState('');
  const [parsedSuggestion, setParsedSuggestion] = useState<Record<string, number> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    
    let lastValidSuggestion: Record<string, number> | null = null;

    // Iterate backwards through history to find the most recent valid suggestion
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'model') {
            const text = msg.parts[0].text;
            const match = text.match(/```json\n([\s\S]*?)\n```/);
            
            if (match && match[1]) {
                let jsonString = match[1].trim();
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                }

                try {
                    const parsed = JSON.parse(jsonString);
                    if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
                        const parsedRecord = parsed as Record<string, unknown>;
                        // Fix: explicit generic for reduce to ensure 'sum' is treated as number.
                        const total = Object.values(parsedRecord).reduce<number>((sum, val) => {
                            const num = Number(val);
                            return sum + (Number.isNaN(num) ? 0 : num);
                        }, 0);
                        
                        if (Math.abs(total - 100) < 1.5) { // Allow for small rounding errors
                            const numericParsedSuggestion: Record<string, number> = {};
                            for (const key in parsed) {
                                if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                                    const numValue = Number((parsed as Record<string, unknown>)[key]);
                                    if(!isNaN(numValue)) {
                                       numericParsedSuggestion[key] = numValue;
                                    }
                                }
                            }
                            lastValidSuggestion = numericParsedSuggestion;
                            break; // Found it, stop searching
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors and continue searching
                    console.warn("Found a JSON block in history, but failed to parse:", e);
                }
            }
        }
    }
    
    setParsedSuggestion(lastValidSuggestion);

  }, [history]);

  const handleSend = () => {
    if (input.trim() && !isThinking) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  };

  const handleApplyClick = () => {
      if (parsedSuggestion) {
          let analysisText = 'Análise da IA não encontrada.';
          for (let i = history.length - 1; i >= 0; i--) {
              const msg = history[i];
              if (msg.role === 'model') {
                  const text = msg.parts[0].text;
                  const match = text.match(/```json\n([\s\S]*?)\n```/);
                  if (match && match[1]) {
                      try {
                          let jsonString = match[1].trim();
                          const firstBrace = jsonString.indexOf('{');
                          const lastBrace = jsonString.lastIndexOf('}');
                           if (firstBrace !== -1 && lastBrace > firstBrace) {
                                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                            }
                          const currentParsed = JSON.parse(jsonString);
                          if (JSON.stringify(currentParsed) === JSON.stringify(parsedSuggestion)) {
                              const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;
                              analysisText = text.replace(jsonBlockRegex, '').trim();
                              break;
                          }
                      } catch (e) { /* ignore parsing errors */ }
                  }
              }
          }
          onApplySuggestion(parsedSuggestion, analysisText);
      }
  }

  return (
    <div className="flex flex-col h-[60vh] bg-gray-800 text-gray-200">
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {history.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-prose p-3 rounded-lg relative group ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'
              }`}
            >
              <div 
                className="prose prose-invert prose-sm max-w-none" 
                dangerouslySetInnerHTML={renderMessage(msg.parts[0].text)}
              ></div>
               {msg.role === 'model' && (
                <button
                    onClick={() => onShare(msg.parts[0].text, "Sugestão de Rebalanceamento IA")}
                    className="absolute top-1 right-1 p-1.5 rounded-full bg-gray-600/50 text-gray-300 opacity-60 hover:opacity-100 transition-opacity hover:bg-gray-500 hover:text-white"
                    aria-label="Compartilhar sugestão"
                    title="Compartilhar ou Copiar"
                >
                    <i className="fas fa-share-alt fa-xs"></i>
                </button>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="max-w-xs p-3 rounded-lg bg-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Analisando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {parsedSuggestion && !isThinking && (
          <div className="px-4 pb-2 text-center animate-fadeIn">
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={handleApplyClick} icon="fa-check" variant="primary">
                    Aplicar Sugestão
                </Button>
                <Button onClick={() => onCompare(parsedSuggestion)} icon="fa-chart-line" variant="secondary">
                    Comparar Desempenho
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">"Aplicar" preencherá os sliders com a sugestão. "Comparar" simulará a performance histórica.</p>
          </div>
      )}

      <div className="p-4 border-t border-gray-700 space-y-3">
         {history.length <= 1 && !isThinking && (
            <div className="animate-fadeIn">
                <p className="text-xs text-gray-400 mb-2 text-center">Qual é o seu perfil de investidor?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedResponses.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => onSendMessage(q)}
                            disabled={isThinking}
                            className="bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 text-sm font-semibold py-1.5 px-3 rounded-full transition-colors"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </div>
         )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Responda ou peça um refinamento..."
            className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            disabled={isThinking}
            aria-label="Sua resposta para a IA"
          />
          <Button onClick={handleSend} disabled={isThinking || !input.trim()} icon="fa-paper-plane">
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIRebalanceView;