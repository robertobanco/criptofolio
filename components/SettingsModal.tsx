import React, { useState, useEffect } from 'react';
import type { Toast } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getProxiedUrl, PROXIES } from '../services/proxyService';
import { verifyGeminiApiKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  onGeminiApiKeySave: (key: string) => void;
  apiKey: string;
  onApiKeySave: (key: string) => void;
  cryptoCompareApiKey: string;
  onCryptoCompareApiKeySave: (key: string) => void;
  selectedProxy: string;
  onProxyChange: (proxyKey: string) => void;
  addToast: (message: string, type: Toast['type']) => void;
  notificationsEnabled: boolean;
  onNotificationsEnabledChange: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    geminiApiKey,
    onGeminiApiKeySave,
    apiKey, 
    onApiKeySave, 
    cryptoCompareApiKey,
    onCryptoCompareApiKeySave,
    selectedProxy,
    onProxyChange,
    addToast,
    notificationsEnabled,
    onNotificationsEnabledChange,
}) => {
  const [currentApiKey, setCurrentApiKey] = useState(apiKey);
  const [currentCCApiKey, setCurrentCCApiKey] = useState(cryptoCompareApiKey);
  const [currentGeminiApiKey, setCurrentGeminiApiKey] = useState(geminiApiKey);
  
  const [isVerifyingCMC, setIsVerifyingCMC] = useState(false);
  const [verificationStatusCMC, setVerificationStatusCMC] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [isVerifyingCC, setIsVerifyingCC] = useState(false);
  const [verificationStatusCC, setVerificationStatusCC] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  
  const [isVerifyingGemini, setIsVerifyingGemini] = useState(false);
  const [verificationStatusGemini, setVerificationStatusGemini] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [permissionStatus, setPermissionStatus] = useState('Notification' in window ? Notification.permission : 'default');


  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
        setCurrentApiKey(apiKey);
        setCurrentCCApiKey(cryptoCompareApiKey);
        setCurrentGeminiApiKey(geminiApiKey);
        setVerificationStatusCMC(null);
        setIsVerifyingCMC(false);
        setVerificationStatusCC(null);
        setIsVerifyingCC(false);
        setVerificationStatusGemini(null);
        setIsVerifyingGemini(false);
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }
  }, [isOpen, apiKey, cryptoCompareApiKey, geminiApiKey]);
  
  const handleToggleNotifications = async () => {
    // Primeiro, verifique se a API de Notificação é suportada pelo navegador.
    if (!('Notification' in window)) {
        addToast("Seu navegador não suporta notificações.", "error");
        return;
    }

    // Se as notificações já estiverem habilitadas no app, o usuário quer desabilitá-las.
    if (notificationsEnabled) {
        onNotificationsEnabledChange(false);
        addToast("Notificações desativadas no aplicativo.", "info");
        return;
    }

    // Se o usuário está tentando habilitar as notificações...
    let currentPermission = Notification.permission;

    if (currentPermission === 'granted') {
        // A permissão já foi concedida, então apenas habilite no estado do app.
        onNotificationsEnabledChange(true);
        addToast("Notificações ativadas!", "success");
    } else if (currentPermission === 'denied') {
        // A permissão está bloqueada no navegador.
        const inIframe = window.self !== window.top;
        let message = "As notificações estão bloqueadas pelo navegador. Altere nas configurações do site para permitir.";
        if (inIframe) {
            message = "As notificações estão bloqueadas. Se você já as permitiu no navegador, a plataforma onde o app está rodando pode estar restringindo o acesso.";
        }
        addToast(message, "error");
    } else { // O status é 'default' (padrão), então precisamos pedir permissão.
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission); // Atualiza o estado para refletir a escolha do usuário
        if (permission === 'granted') {
            onNotificationsEnabledChange(true);
            addToast("Permissão de notificação concedida!", "success");
        } else {
            addToast("Permissão de notificação não foi concedida.", "info");
        }
    }
  };


  const handleVerifyCMCKey = async () => {
    setIsVerifyingCMC(true);
    setVerificationStatusCMC(null);
  
    try {
      const apiUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=1';
      const response = await fetch(getProxiedUrl(apiUrl, selectedProxy), {
        headers: { 'X-CMC_PRO_API_KEY': currentApiKey },
      });
  
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.status?.error_message || `Erro de HTTP: ${response.status}`;
        throw new Error(errorMessage);
      }
  
      onApiKeySave(currentApiKey);
      setVerificationStatusCMC({ message: 'A Chave de API é válida e foi salva com sucesso!', type: 'success' });
      addToast("Chave da CoinMarketCap salva com sucesso!", "success");
  
    } catch (error) {
      console.error("Verification failed with error:", error);
      let errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      let displayMessage = `Falha na Validação: ${errorMessage}`;
      if (errorMessage.toLowerCase().includes("failed to fetch")) {
        displayMessage = "Falha na Validação: Não foi possível conectar ao servidor. Verifique sua conexão ou proxy.";
      }
      setVerificationStatusCMC({ message: displayMessage, type: 'error' });
    } finally {
      setIsVerifyingCMC(false);
    }
  };

  const handleVerifyCCKey = async () => {
    setIsVerifyingCC(true);
    setVerificationStatusCC(null);
    try {
        const url = `https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=BRL&api_key=${currentCCApiKey}`;
        const proxiedUrl = getProxiedUrl(url, selectedProxy);
        const response = await fetch(proxiedUrl);
        const data = await response.json();

        if (data.Response === 'Error' || data.TYPE === 'ERROR' || !response.ok) {
            throw new Error(data.Message || 'Chave de API inválida ou erro de rede.');
        }
        
        if (data.BRL) {
             onCryptoCompareApiKeySave(currentCCApiKey);
             setVerificationStatusCC({ message: 'A Chave de API da CryptoCompare é válida e foi salva!', type: 'success' });
             addToast("Chave da CryptoCompare salva com sucesso!", "success");
        } else {
            throw new Error('Resposta inesperada da API. A chave pode ser inválida.');
        }
    } catch (error) {
        console.error("Verification failed with error:", error);
        let errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
        let displayMessage = `Falha na Validação: ${errorMessage}`;
        if (errorMessage.toLowerCase().includes("failed to fetch")) {
            displayMessage = "Falha na Validação: Não foi possível conectar ao servidor. Verifique sua conexão ou proxy.";
        }
        setVerificationStatusCC({ message: displayMessage, type: 'error' });
    } finally {
        setIsVerifyingCC(false);
    }
  };

  const handleVerifyGeminiKey = async () => {
    setIsVerifyingGemini(true);
    setVerificationStatusGemini(null);
    const result = await verifyGeminiApiKey(currentGeminiApiKey);
    if (result.isValid) {
        onGeminiApiKeySave(currentGeminiApiKey);
        setVerificationStatusGemini({ message: 'A Chave de API do Gemini é válida e foi salva!', type: 'success' });
        addToast("Chave do Gemini salva com sucesso!", "success");
    } else {
        setVerificationStatusGemini({ message: `Falha na Validação: ${result.error}`, type: 'error' });
    }
    setIsVerifyingGemini(false);
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
      <div className="space-y-6">
        <section aria-labelledby="api-key-heading">
          <h3 id="api-key-heading" className="text-lg font-semibold text-gray-200 mb-2">Chaves de API e Conexão</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-300">Google Gemini (Análise IA)</h4>
              <p className="text-sm text-gray-400 mb-2">
                Necessária para todas as funcionalidades de IA (chat, insights, etc). Obtenha uma chave no{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                  Google AI Studio
                </a>.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <input
                    type="password"
                    value={currentGeminiApiKey}
                    onChange={(e) => setCurrentGeminiApiKey(e.target.value)}
                    placeholder="Insira sua chave de API do Gemini"
                    className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    aria-label="Chave de API do Google Gemini"
                    />
                    <Button onClick={handleVerifyGeminiKey} disabled={isVerifyingGemini}>
                        {isVerifyingGemini ? <><i className="fas fa-spinner fa-spin"></i> Verificando...</> : 'Testar e Salvar'}
                    </Button>
                </div>
                {verificationStatusGemini && (
                    <p className={`text-sm mt-1 ${verificationStatusGemini.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {verificationStatusGemini.message}
                    </p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-300">CoinMarketCap (Preços em tempo real)</h4>
              <p className="text-sm text-gray-400 mb-2">
                Necessária para buscar preços em tempo real, 24h, etc. Obtenha uma chave no{' '}
                <a href="https://coinmarketcap.com/api/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                  Portal do Desenvolvedor da CoinMarketCap
                </a>.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <input
                    type="password"
                    value={currentApiKey}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    placeholder="Insira sua chave de API da CMC"
                    className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    aria-label="Chave de API da CoinMarketCap"
                    />
                    <Button onClick={handleVerifyCMCKey} disabled={isVerifyingCMC}>
                        {isVerifyingCMC ? <><i className="fas fa-spinner fa-spin"></i> Verificando...</> : 'Testar e Salvar'}
                    </Button>
                </div>
                {verificationStatusCMC && (
                    <p className={`text-sm mt-1 ${verificationStatusCMC.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {verificationStatusCMC.message}
                    </p>
                )}
              </div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300">CryptoCompare (Dados Históricos do Gráfico)</h4>
                 <p className="text-sm text-gray-400 mb-2">
                    Necessária para buscar o histórico de preços para o gráfico de evolução. Obtenha uma chave gratuita em{' '}
                    <a href="https://min-api.cryptocompare.com/pricing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    CryptoCompare
                    </a>.
                </p>
                 <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={currentCCApiKey}
                            onChange={(e) => setCurrentCCApiKey(e.target.value)}
                            placeholder="Insira sua chave de API da CryptoCompare"
                            className="flex-grow bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            aria-label="Chave de API da CryptoCompare"
                        />
                         <Button onClick={handleVerifyCCKey} disabled={isVerifyingCC}>
                            {isVerifyingCC ? <><i className="fas fa-spinner fa-spin"></i> Verificando...</> : 'Testar e Salvar'}
                        </Button>
                    </div>
                    {verificationStatusCC && (
                        <p className={`text-sm mt-1 ${verificationStatusCC.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {verificationStatusCC.message}
                        </p>
                    )}
                </div>
            </div>
            <div>
                <label htmlFor="proxy-selector" className="block text-sm font-medium text-gray-300 mb-1">
                Serviço de Proxy
                </label>
                <select
                id="proxy-selector"
                value={selectedProxy}
                onChange={(e) => onProxyChange(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded p-2 text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                {Object.keys(PROXIES).map((key) => (
                    <option key={key} value={key}>
                    {PROXIES[key].name}
                    </option>
                ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                Se os preços não carregarem, tente selecionar um serviço de proxy diferente.
                </p>
            </div>
          </div>
        </section>
        
        <section aria-labelledby="notifications-heading">
            <h3 id="notifications-heading" className="text-lg font-semibold text-gray-200 mb-2">Notificações de Alertas</h3>
             <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-gray-300">Notificações Sonoras e Visuais</h4>
                        <p className="text-sm text-gray-400">Receba um alerta sonoro e uma notificação no navegador quando um alerta for disparado.</p>
                    </div>
                    <button
                        role="switch"
                        aria-checked={notificationsEnabled}
                        onClick={handleToggleNotifications}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                        notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                    >
                        <span
                        aria-hidden="true"
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                        />
                    </button>
                </div>
                 {permissionStatus === 'denied' && (
                    <p className="text-xs text-yellow-400 mt-2">
                        <i className="fas fa-exclamation-triangle mr-1"></i> As notificações estão bloqueadas. Você precisa permitir nas configurações de permissão do site em seu navegador.
                    </p>
                )}
            </div>
        </section>
      </div>
    </Modal>
  );
};

export default SettingsModal;
