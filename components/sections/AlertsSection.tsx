import React, { useState, useMemo, useEffect } from 'react';
import type { PriceAlert, CryptoData, Toast } from '../../types';
import Button from '../ui/Button';
import AutoCompleteInput from '../ui/AutoCompleteInput';
import useDebounce from '../../hooks/useDebounce';

type CryptoMap = Record<string, string>;

const SPECIAL_ASSETS = {
  '__PORTFOLIO_TOTAL__': 'Valor Total da Carteira',
  '__UNREALIZED_PROFIT__': 'Lucro Não Realizado Total',
};

interface AlertsSectionProps {
  alerts: PriceAlert[];
  cryptoData: CryptoData;
  cryptoMap: CryptoMap;
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'triggered' | 'triggeredAt'>) => void;
  onUpdateAlert: (alert: PriceAlert) => void;
  onReArmAlert: (alert: PriceAlert) => void;
  onDeleteAlert: (id: string) => void;
  onAlertAssetChange: (asset: string) => void;
  addToast: (message: string, type: Toast['type']) => void;
  totalPortfolioValue: number;
  totalUnrealizedProfit: number;
}

const getTriggerDescription = (alert: PriceAlert): string => {
    const conditionText = alert.condition === 'above' ? 'ultrapassou' : 'caiu abaixo de';
    if (alert.type === 'price') {
        return `O valor ${conditionText} R$ ${alert.targetValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.`;
    }
    if (alert.type === 'change24h') {
        const targetPercent = alert.condition === 'above' ? alert.targetValue : -alert.targetValue;
        return `A variação em 24h ${conditionText} ${targetPercent}%.`;
    }
    return 'Alerta disparado.'; // Fallback
};

const AlertRow: React.FC<{
    priceAlert: PriceAlert;
    currentPrice?: number;
    currentChange24h?: number;
    isEditing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: (updatedAlert: PriceAlert) => void;
    onDelete: () => void;
    onReArm: (alert: PriceAlert) => void;
    addToast: (message: string, type: Toast['type']) => void;
}> = ({ priceAlert, currentPrice, currentChange24h, isEditing, onEdit, onCancel, onSave, onDelete, onReArm, addToast }) => {
    
    const [editForm, setEditForm] = useState({
        condition: priceAlert.condition,
        targetValue: String(priceAlert.targetValue),
        recurring: priceAlert.recurring,
    });
    
    const isSpecialAsset = Object.keys(SPECIAL_ASSETS).includes(priceAlert.asset);
    const assetDisplayName = isSpecialAsset ? SPECIAL_ASSETS[priceAlert.asset as keyof typeof SPECIAL_ASSETS] : priceAlert.asset;

    useEffect(() => {
        if (isEditing) {
            setEditForm({
                condition: priceAlert.condition,
                targetValue: String(priceAlert.targetValue),
                recurring: priceAlert.recurring,
            });
        }
    }, [isEditing, priceAlert]);
    
    const handleSave = () => {
        const targetValue = parseFloat(editForm.targetValue);
        if (isNaN(targetValue) || (priceAlert.type !== 'change24h' && targetValue <= 0 && !isSpecialAsset)) {
            addToast("O valor alvo deve ser um número válido. Para alertas de preço, deve ser positivo.", "error");
            return;
        }
        onSave({ ...priceAlert, condition: editForm.condition, targetValue, recurring: editForm.recurring });
    };

    const { distance, distanceColor, distancePrefix, isConditionStillMet } = useMemo(() => {
        let dist: number | null = null;
        let color = 'text-gray-400';
        let prefix = '';
        let conditionMet = false;

        const currentValue = priceAlert.type === 'price' ? currentPrice : currentChange24h;

        if (currentValue != null) {
            if (priceAlert.type === 'price') {
                if (currentPrice !== undefined && (currentPrice > 0 || isSpecialAsset || currentPrice < 0)) {
                    dist = ((priceAlert.targetValue / currentPrice) - 1) * 100;
                    conditionMet = (priceAlert.condition === 'above' && currentPrice >= priceAlert.targetValue) ||
                                   (priceAlert.condition === 'below' && currentPrice <= priceAlert.targetValue);
                }
            } else if (priceAlert.type === 'change24h' && currentChange24h != null) {
                const effectiveTarget = priceAlert.condition === 'above' ? priceAlert.targetValue : -priceAlert.targetValue;
                dist = effectiveTarget - currentChange24h;
                conditionMet = (priceAlert.condition === 'above' && currentChange24h >= effectiveTarget) ||
                               (priceAlert.condition === 'below' && currentChange24h <= effectiveTarget);
            }

            if (dist !== null && isFinite(dist)) {
                const hasPassed = (priceAlert.condition === 'above' && dist <= 0) || (priceAlert.condition === 'below' && dist >= 0);
                color = hasPassed ? 'text-green-400' : 'text-red-400';
                prefix = dist > 0 ? '+' : '';
            }
        }
    
        return { distance: dist, distanceColor: color, distancePrefix: prefix, isConditionStillMet: conditionMet };
    }, [priceAlert, currentPrice, currentChange24h, isSpecialAsset]);


    if (priceAlert.triggered && !isEditing) {
         return (
            <div className={`flex items-center justify-between gap-4 p-3 rounded-lg text-sm bg-yellow-900/40 border border-yellow-500/50`}>
                <div className="flex-1 flex flex-col gap-y-1">
                    <span className="font-bold text-lg text-yellow-400">{assetDisplayName}</span>
                    <span className="text-yellow-200">{getTriggerDescription(priceAlert)}</span>
                    <span className="text-yellow-300/80 text-xs">Disparado em {new Date(priceAlert.triggeredAt!).toLocaleDateString('pt-BR')} às {new Date(priceAlert.triggeredAt!).toLocaleTimeString('pt-BR')}</span>
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 justify-end text-right">
                    {priceAlert.type === 'price' && (
                        currentPrice != null ? (
                            <>
                                <div className="text-right">
                                    <span className="text-yellow-400/80 block text-xs">Valor Atual</span>
                                    <span className="text-yellow-200">R$ {currentPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                {distance !== null && isFinite(distance) && (
                                    <div className="text-right">
                                        <span className="text-yellow-400/80 block text-xs">Distância</span>
                                        <span className={distanceColor}>{distancePrefix}{distance.toFixed(2)}%</span>
                                    </div>
                                )}
                            </>
                        ) : <span className="text-xs text-yellow-500">Carregando...</span>
                    )}

                    {priceAlert.type === 'change24h' && (
                        currentChange24h != null ? (
                            <>
                                <div className="text-right">
                                    <span className="text-yellow-400/80 block text-xs">Variação Atual (24h)</span>
                                    <span className={currentChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {currentChange24h.toFixed(2)}%
                                    </span>
                                </div>
                                {distance !== null && isFinite(distance) && (
                                    <div className="text-right">
                                        <span className="text-yellow-400/80 block text-xs">Distância p/ Alvo</span>
                                        <span className={distanceColor}>{distance.toFixed(2)}pp</span>
                                    </div>
                                )}
                            </>
                        ) : <span className="text-xs text-yellow-500">Carregando...</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button onClick={onEdit} icon="fa-pencil-alt" variant="ghost" className="py-1 px-2 text-xs" aria-label="Editar alerta" />
                    {!isConditionStillMet && (
                         <Button onClick={() => onReArm(priceAlert)} icon="fa-bell" variant="secondary" className="py-1 px-2 text-xs">Reativar</Button>
                    )}
                    <Button onClick={onDelete} icon="fa-trash" variant="danger" className="py-1 px-2 text-xs" aria-label="Excluir alerta" />
                </div>
            </div>
        );
    }


    if (isEditing) {
        return (
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-indigo-900/30 border border-indigo-500">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                    <span className="font-bold text-lg text-white col-span-1">{assetDisplayName} ({priceAlert.type === 'price' ? 'Preço' : 'Variação 24h'})</span>
                     <select
                        value={editForm.condition}
                        onChange={(e) => setEditForm({ ...editForm, condition: e.target.value as 'above' | 'below' })}
                        className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm"
                    >
                        <option value="above">Acima de</option>
                        <option value="below">Abaixo de</option>
                    </select>
                     <input
                        type="number"
                        placeholder="Valor Alvo"
                        value={editForm.targetValue}
                        onChange={(e) => setEditForm({ ...editForm, targetValue: e.target.value })}
                        className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm"
                    />
                    <div className="flex items-center justify-center">
                        <input id={`recurring-${priceAlert.id}`} type="checkbox" checked={editForm.recurring} onChange={(e) => setEditForm({...editForm, recurring: e.target.checked})} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor={`recurring-${priceAlert.id}`} className="ml-2 text-sm text-gray-300">Recorrente</label>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <Button onClick={handleSave} icon="fa-save" variant="primary" className="py-1 px-2 text-xs" aria-label="Salvar Alerta" />
                    <Button onClick={onCancel} icon="fa-times" variant="ghost" className="py-1 px-2 text-xs" aria-label="Cancelar Edição" />
                </div>
            </div>
        );
    }
    
    return (
        <div className={`flex items-center justify-between gap-4 p-3 rounded-lg text-sm transition-colors bg-gray-700/50`}>
            <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={`font-bold text-lg text-white`}>{assetDisplayName}</span>
                {!isSpecialAsset && (
                    <span className="text-xs text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded-full">
                        {priceAlert.type === 'price' ? 'Preço' : 'Variação 24h'}
                    </span>
                )}
                <span className="text-gray-400">{priceAlert.condition === 'above' ? 'acima de' : 'abaixo de'}</span>
                <span className="font-semibold text-white">
                    {priceAlert.type === 'price' ? `R$ ${priceAlert.targetValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `${priceAlert.targetValue}%`}
                </span>
                 {priceAlert.recurring && (
                    <span className="text-xs text-green-300 bg-green-900/50 px-2 py-0.5 rounded-full">
                        <i className="fas fa-sync-alt mr-1"></i> Recorrente
                    </span>
                )}
            </div>
             <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 justify-end text-right">
                {priceAlert.type === 'price' && (
                    currentPrice != null ? (
                        <>
                            <div className="text-right">
                                <span className="text-gray-400 block text-xs">Valor Atual</span>
                                <span>R$ {currentPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            {distance !== null && isFinite(distance) && (
                                <div className="text-right">
                                    <span className="text-gray-400 block text-xs">Distância</span>
                                    <span className={distanceColor}>{distancePrefix}{distance.toFixed(2)}%</span>
                                </div>
                            )}
                        </>
                    ) : <span className="text-xs text-gray-500">Carregando...</span>
                )}

                {priceAlert.type === 'change24h' && (
                    currentChange24h != null ? (
                        <>
                            <div className="text-right">
                                <span className="text-gray-400 block text-xs">Variação Atual (24h)</span>
                                <span className={currentChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {currentChange24h.toFixed(2)}%
                                </span>
                            </div>
                            {distance !== null && isFinite(distance) && (
                                <div className="text-right">
                                    <span className="text-gray-400 block text-xs">Distância p/ Alvo</span>
                                    <span className={distanceColor}>{distance.toFixed(2)}pp</span>
                                </div>
                            )}
                        </>
                    ) : <span className="text-xs text-gray-500">Carregando...</span>
                )}
            </div>
            <div className="flex gap-2">
                <Button onClick={onEdit} icon="fa-pencil-alt" variant="ghost" className="py-1 px-2 text-xs" aria-label="Editar alerta" />
                <Button onClick={onDelete} icon="fa-trash" variant="danger" className="py-1 px-2 text-xs" aria-label="Excluir alerta" />
            </div>
        </div>
    );
};


const AlertsSection: React.FC<AlertsSectionProps> = ({ alerts, cryptoData, cryptoMap, onAddAlert, onUpdateAlert, onReArmAlert, onDeleteAlert, onAlertAssetChange, addToast, totalPortfolioValue, totalUnrealizedProfit }) => {
  const [newAlert, setNewAlert] = useState({
    asset: '',
    type: 'price' as 'price' | 'change24h',
    condition: 'above' as 'above' | 'below',
    targetValue: '',
    recurring: true,
  });
  const [selectedAssetPrice, setSelectedAssetPrice] = useState<number | null>(null);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  const debouncedAsset = useDebounce(newAlert.asset, 500);
  
  const alertSuggestions = useMemo(() => [
      ...Object.keys(cryptoMap), 
      ...Object.values(SPECIAL_ASSETS)
  ], [cryptoMap]);

  const isSpecialAssetSelected = Object.values(SPECIAL_ASSETS).includes(newAlert.asset);

  useEffect(() => {
    let price: number | undefined;

    if (newAlert.asset === SPECIAL_ASSETS.__PORTFOLIO_TOTAL__) {
        price = totalPortfolioValue;
    } else if (newAlert.asset === SPECIAL_ASSETS.__UNREALIZED_PROFIT__) {
        price = totalUnrealizedProfit;
    } else {
        const upperCaseAsset = newAlert.asset.toUpperCase();
        price = cryptoData[upperCaseAsset]?.price;
    }
    
    setSelectedAssetPrice(price ?? null);

    if (isSpecialAssetSelected) {
        setNewAlert(prev => ({ ...prev, type: 'price' }));
    }

  }, [newAlert.asset, cryptoData, totalPortfolioValue, totalUnrealizedProfit, isSpecialAssetSelected]);

  useEffect(() => {
    onAlertAssetChange(debouncedAsset);
  }, [debouncedAsset, onAlertAssetChange]);

  const handleAddAlert = () => {
    const assetInput = newAlert.asset.trim();
    const specialAssetKey = Object.keys(SPECIAL_ASSETS).find(key => SPECIAL_ASSETS[key as keyof typeof SPECIAL_ASSETS] === assetInput);
    const asset = specialAssetKey || assetInput.toUpperCase();
    
    const isValidCrypto = Object.keys(cryptoMap).map(s => s.toUpperCase()).includes(asset);
    const targetValue = parseFloat(newAlert.targetValue);
    
    let errors = [];
    if (!asset || (!isValidCrypto && !specialAssetKey)) errors.push("O Ativo ou Métrica não é válido.");
    if (isNaN(targetValue)) {
        errors.push("O valor alvo deve ser um número.");
    } else if (newAlert.type === 'price' && targetValue <= 0 && asset !== '__UNREALIZED_PROFIT__') {
        errors.push(`O valor alvo deve ser maior que 0.`);
    }
    
    if (errors.length > 0) {
        errors.forEach(error => addToast(error, 'error'));
        return;
    }

    onAddAlert({
        asset,
        type: newAlert.type,
        condition: newAlert.condition,
        targetValue,
        recurring: newAlert.recurring,
    });
    setNewAlert({
        asset: '',
        type: 'price',
        condition: 'above',
        targetValue: '',
        recurring: true,
    });
  };

  const { activeAlerts, triggeredAlerts } = useMemo(() => {
    const active: PriceAlert[] = [];
    const triggered: PriceAlert[] = [];
    alerts.forEach(alert => {
        if(alert.triggered) {
            triggered.push(alert);
        } else {
            active.push(alert);
        }
    });
    triggered.sort((a,b) => new Date(b.triggeredAt!).getTime() - new Date(a.triggeredAt!).getTime());
    return { activeAlerts: active, triggeredAlerts: triggered };
  }, [alerts]);
  
  const getAlertCurrentValue = (alert: PriceAlert): { price?: number, change24h?: number } => {
      if (alert.asset === '__PORTFOLIO_TOTAL__') {
          return { price: totalPortfolioValue };
      }
      if (alert.asset === '__UNREALIZED_PROFIT__') {
          return { price: totalUnrealizedProfit };
      }
      const data = cryptoData[alert.asset];
      if (data) {
          return { price: data.price, change24h: data.percent_change_24h };
      }
      return {};
  }

  const valueInputLabel = newAlert.type === 'price' ? "Valor-Alvo (BRL)" : "Variação (%)";
  const valueInputPlaceholder = newAlert.type === 'price' ? "50000" : "5";


  return (
    <div className="space-y-6">
        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Adicionar Novo Alerta</h2>
             <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-1">
                    <label className="text-sm text-gray-400 block mb-1">Ativo / Métrica</label>
                     <div className="flex gap-1 mb-1.5 flex-wrap">
                        <button 
                            onClick={() => setNewAlert(prev => ({ ...prev, asset: SPECIAL_ASSETS.__PORTFOLIO_TOTAL__ }))}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-full transition-colors"
                        >
                           <i className="fas fa-wallet mr-1"></i>
                           {SPECIAL_ASSETS.__PORTFOLIO_TOTAL__}
                        </button>
                        <button 
                            onClick={() => setNewAlert(prev => ({ ...prev, asset: SPECIAL_ASSETS.__UNREALIZED_PROFIT__ }))}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-full transition-colors"
                        >
                           <i className="fas fa-chart-line mr-1"></i>
                           {SPECIAL_ASSETS.__UNREALIZED_PROFIT__}
                        </button>
                    </div>
                    <AutoCompleteInput
                        value={newAlert.asset}
                        onChange={(value) => setNewAlert({ ...newAlert, asset: value })}
                        suggestions={alertSuggestions}
                        placeholder="ex: BTC"
                    />
                    {selectedAssetPrice !== null && (
                        <div className="text-xs text-gray-400 mt-1">
                            Atual: R$ {selectedAssetPrice.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: isSpecialAssetSelected ? 2 : 8
                            })}
                        </div>
                    )}
                </div>
                <div className="md:col-span-1">
                    <label className="text-sm text-gray-400 block mb-1">Tipo de Alerta</label>
                    <select
                        value={newAlert.type}
                        onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value as 'price' | 'change24h' })}
                        className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm h-[42px] disabled:bg-gray-800 disabled:cursor-not-allowed"
                        disabled={isSpecialAssetSelected}
                    >
                        <option value="price">Valor Atinge</option>
                        <option value="change24h">Variação % em 24h</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="text-sm text-gray-400 block mb-1">Condição</label>
                    <select
                        value={newAlert.condition}
                        onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as 'above' | 'below' })}
                        className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm h-[42px]"
                    >
                        <option value="above">Acima de</option>
                        <option value="below">Abaixo de</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                     <label className="text-sm text-gray-400 block mb-1">{valueInputLabel}</label>
                    <input
                        type="number"
                        placeholder={valueInputPlaceholder}
                        value={newAlert.targetValue}
                        onChange={(e) => setNewAlert({ ...newAlert, targetValue: e.target.value })}
                        className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm h-[42px]"
                    />
                </div>
                <div className="md:col-span-1 flex items-center justify-center h-[42px]">
                     <div className="flex items-center">
                        <input id="recurring-new" type="checkbox" checked={newAlert.recurring} onChange={(e) => setNewAlert({...newAlert, recurring: e.target.checked})} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="recurring-new" className="ml-2 text-sm text-gray-300">Recorrente</label>
                    </div>
                </div>
                <div className="md:col-span-1">
                    <Button onClick={handleAddAlert} icon="fa-plus" className="w-full justify-center h-[42px]">Adicionar Alerta</Button>
                </div>
            </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl min-h-[200px]">
             <h2 className="text-xl font-bold mb-4">Alertas Ativos</h2>
             <div className="space-y-3">
                {activeAlerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <i className="fas fa-bell-slash fa-2x mb-2"></i>
                        <p>Nenhum alerta ativo.</p>
                        <p className="text-sm">Crie seu primeiro alerta acima.</p>
                    </div>
                ) : (
                    activeAlerts.map(alert => {
                        const { price, change24h } = getAlertCurrentValue(alert);
                        return (
                            <AlertRow
                                key={alert.id}
                                priceAlert={alert}
                                currentPrice={price}
                                currentChange24h={change24h}
                                isEditing={editingAlertId === alert.id}
                                onEdit={() => setEditingAlertId(alert.id)}
                                onCancel={() => setEditingAlertId(null)}
                                onSave={(updatedAlert) => {
                                    onUpdateAlert(updatedAlert);
                                    setEditingAlertId(null);
                                }}
                                onDelete={() => onDeleteAlert(alert.id)}
                                onReArm={onReArmAlert}
                                addToast={addToast}
                            />
                        )
                    })
                )}
             </div>
        </div>

        {triggeredAlerts.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl min-h-[100px]">
                <h2 className="text-xl font-bold mb-4 text-yellow-400">Alertas Disparados</h2>
                <div className="space-y-3">
                    {triggeredAlerts.map(alert => (
                        <AlertRow
                            key={alert.id}
                            priceAlert={alert}
                            currentPrice={getAlertCurrentValue(alert).price}
                            currentChange24h={getAlertCurrentValue(alert).change24h}
                            isEditing={editingAlertId === alert.id}
                            onEdit={() => setEditingAlertId(alert.id)}
                            onCancel={() => setEditingAlertId(null)}
                            onSave={(updatedAlert) => {
                                onUpdateAlert(updatedAlert);
                                setEditingAlertId(null);
                            }}
                            onDelete={() => onDeleteAlert(alert.id)}
                            onReArm={onReArmAlert}
                            addToast={addToast}
                        />
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default AlertsSection;
