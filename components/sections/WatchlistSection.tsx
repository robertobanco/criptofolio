

import React, { useState } from 'react';
import type { CryptoData, Toast } from '../../types';
import Button from '../ui/Button';
import AutoCompleteInput from '../ui/AutoCompleteInput';
import EmptyState from '../ui/EmptyState';

type CryptoMap = Record<string, string>;

interface WatchlistSectionProps {
  watchlist: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  cryptoData: CryptoData;
  cryptoMap: CryptoMap;
  addToast: (message: string, type: Toast['type']) => void;
  ownedAssets: string[];
  onViewDetails: (symbol: string) => void;
}

const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  watchlist,
  onAdd,
  onRemove,
  cryptoData,
  cryptoMap,
  addToast,
  ownedAssets,
  onViewDetails,
}) => {
  const [newAsset, setNewAsset] = useState('');

  const handleAdd = () => {
    const inputAsset = newAsset.trim();
    if (!inputAsset) {
      addToast('O campo do ativo não pode estar vazio.', 'error');
      return;
    }

    // Find the correct symbol with original casing from cryptoMap
    const correctSymbol = Object.values(cryptoMap).find(
      s => s.toUpperCase() === inputAsset.toUpperCase()
    );

    if (!correctSymbol) {
      addToast(`O ativo "${inputAsset}" não foi encontrado. Verifique o ticker.`, 'error');
      return;
    }

    onAdd(correctSymbol);
    setNewAsset('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <h2 className="text-xl font-bold mb-2">Adicionar à Watchlist</h2>
        <p className="text-sm text-gray-400 mb-4">
          Adicione o ticker de uma criptomoeda para começar a acompanhá-la.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-grow">
            <AutoCompleteInput
              value={newAsset}
              onChange={setNewAsset}
              suggestions={Object.values(cryptoMap)}
              placeholder="ex: BTC, ETH, ADA..."
            />
          </div>
          <Button onClick={handleAdd} icon="fa-plus" className="justify-center">
            Adicionar Ativo
          </Button>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Sua Watchlist</h2>
        {watchlist.length === 0 ? (
          <EmptyState
            icon="fa-star"
            title="Sua Watchlist está vazia"
            message="Adicione ativos que você deseja monitorar para vê-los aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase">
                <tr>
                  <th className="p-2 text-left">Ativo</th>
                  <th className="p-2 text-right">Preço Atual (BRL)</th>
                  <th className="p-2 text-right">Variação 24h</th>
                  <th className="p-2 text-center w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map(symbol => {
                  const data = cryptoData[symbol];
                  const isOwned = ownedAssets.includes(symbol);
                  return (
                    <tr
                      key={symbol}
                      className="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-2 font-bold">
                        <button
                          onClick={() => onViewDetails(symbol)}
                          className="bg-transparent border-none p-0 font-bold text-inherit hover:text-indigo-400 focus:outline-none focus:text-indigo-400 transition-colors cursor-pointer"
                          aria-label={`Ver detalhes de ${symbol}`}
                        >
                          {symbol}
                        </button>
                        {isOwned && <i className="fas fa-wallet text-indigo-400 text-xs ml-2" title="Você possui este ativo"></i>}
                      </td>
                      <td className="p-2 text-right">
                        {data ? `R$ ${data.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : <span className="text-gray-500">Carregando...</span>}
                      </td>
                      <td className={`p-2 text-right font-semibold ${!data || data.percent_change_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {data ? `${data.percent_change_24h.toFixed(2)}%` : <span className="text-gray-500">...</span>}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row's onClick from firing
                            onRemove(symbol)
                          }}
                          variant="danger"
                          icon="fa-trash"
                          className="py-1 px-2 text-xs"
                          aria-label={`Remover ${symbol} da watchlist`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistSection;
