


import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../types';
import Button from '../ui/Button';

interface AIChatViewProps {
  history: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (message: string, enableWebSearch: boolean) => void;
  isWebSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  onShare: (text: string, title?: string) => void;
  onClearHistory: () => void;
}

interface SuggestedQuestion {
  text: string;
  enableWebSearch: boolean;
}

const suggestedQuestions: SuggestedQuestion[] = [
  { text: "Analise as maiores variações recentes e justifique com notícias.", enableWebSearch: true },
  { text: "Qual a performance geral da minha carteira?", enableWebSearch: false },
  { text: "Quais são meus ativos mais lucrativos e os que mais deram prejuízo?", enableWebSearch: false },
  { text: "Minha carteira está bem diversificada? Justifique.", enableWebSearch: false },
  { text: "Com base no meu histórico, qual ativo parece ser o mais arriscado?", enableWebSearch: false },
  { text: "Faça uma análise completa da carteira, abordando diversificação, riscos e sugestões.", enableWebSearch: false }
];

const renderFormattedMessage = (text: string) => {
  // Regex para encontrar links markdown e convertê-los em tags <a>
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


const AIChatView: React.FC<AIChatViewProps> = ({ history, isThinking, onSendMessage, isWebSearchEnabled, onWebSearchToggle, onShare, onClearHistory }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isThinking]);

  const handleSend = () => {
    if (input.trim() && !isThinking) {
      onSendMessage(input.trim(), isWebSearchEnabled);
      setInput('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  };

  const displayedHistory = history.filter(msg => !msg.parts[0].text.startsWith('[SYSTEM]'));

  return (
    <div className="flex flex-col h-[60vh] bg-gray-800 text-gray-200">
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {displayedHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-prose p-3 rounded-lg relative group ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'
                }`}
            >
              <div
                className="prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={renderFormattedMessage(msg.parts[0].text)}>
              </div>
              {msg.role === 'model' && (
                <button
                  onClick={() => onShare(msg.parts[0].text, "Análise do Chat CriptoFólio AI")}
                  className="absolute top-1 right-1 p-1.5 rounded-full bg-gray-600/50 text-gray-300 opacity-60 hover:opacity-100 transition-opacity hover:bg-gray-500 hover:text-white"
                  aria-label="Compartilhar análise"
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
            <div className="max-w-xs p-4 rounded-2xl rounded-tl-none bg-gray-700 shadow-md">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-gray-300 font-medium ml-2">Analisando dados...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700 space-y-3">
        {displayedHistory.length <= 1 && !isThinking && (
          <div className="animate-fadeIn">
            <p className="text-xs text-gray-400 mb-2 text-center">Não sabe por onde começar? Tente uma destas perguntas:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const useWebSearch = isWebSearchEnabled || q.enableWebSearch;
                    if (q.enableWebSearch && !isWebSearchEnabled) {
                      onWebSearchToggle(true);
                    }
                    onSendMessage(q.text, useWebSearch);
                  }}
                  disabled={isThinking}
                  className="bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 text-xs font-semibold py-1.5 px-3 rounded-full transition-colors"
                >
                  {q.text}
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
            placeholder="Pergunte sobre seu portfólio..."
            className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            disabled={isThinking}
            aria-label="Sua pergunta para a IA"
          />
          <Button onClick={handleSend} disabled={isThinking || !input.trim()} icon="fa-paper-plane">
            Enviar
          </Button>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center">
            <input
              id="web-search-toggle"
              type="checkbox"
              checked={isWebSearchEnabled}
              onChange={(e) => onWebSearchToggle(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-800"
              disabled={isThinking}
            />
            <label htmlFor="web-search-toggle" className="ml-2 text-sm text-gray-400">
              Buscar na Web (para notícias e eventos recentes)
            </label>
          </div>
          {displayedHistory.length > 1 && (
            <button
              onClick={onClearHistory}
              disabled={isThinking}
              className="text-xs text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              title="Limpar conversa"
            >
              <i className="fas fa-trash-alt"></i>
              Limpar Conversa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatView;
