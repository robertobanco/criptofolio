import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, Toast } from '../../types';
import Button from '../ui/Button';
import AutoCompleteInput from '../ui/AutoCompleteInput';
import Modal from '../ui/Modal';

// Declaration for the xlsx library loaded from CDN
declare const XLSX: any;

type CryptoMap = Record<string, string>;

interface TransactionsSectionProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  cryptoMap: CryptoMap;
  addToast: (message: string, type: Toast['type']) => void;
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  accountNames: string;
  isMultiAccountView: boolean;
}

const TransactionRow: React.FC<{
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
  cryptoMap: CryptoMap;
  addToast: (message: string, type: Toast['type']) => void;
}> = ({ transaction, onSave, onDelete, cryptoMap, addToast }) => {
  const [isEditing, setIsEditing] = useState(false);

  const [editForm, setEditForm] = useState({
    type: transaction.type,
    date: transaction.date,
    asset: transaction.asset,
    quantity: String(transaction.quantity),
    value: String(transaction.value),
  });

  const handleEdit = () => {
    setEditForm({
      type: transaction.type,
      date: transaction.date,
      asset: transaction.asset,
      quantity: String(transaction.quantity),
      value: String(transaction.value),
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const quantity = parseFloat(editForm.quantity);
    const value = parseFloat(editForm.value);

    if (isNaN(quantity) || quantity <= 0 || isNaN(value) || value <= 0) {
      addToast("Quantidade e Valor devem ser números positivos.", "error");
      return;
    }

    onSave({
      ...transaction,
      ...editForm,
      quantity,
      value,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  }

  const totalOperation = (parseFloat(editForm.quantity) || 0) * (parseFloat(editForm.value) || 0);

  if (isEditing) {
    return (
      <tr className="bg-gray-700/50">
        <td className="p-2 align-middle">
          <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'buy' | 'sell' })} className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm">
            <option value="buy">Compra</option>
            <option value="sell">Venda</option>
          </select>
        </td>
        <td className="p-2 align-middle"><input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm" /></td>
        <td className="p-2 align-middle">
          <AutoCompleteInput
            value={editForm.asset}
            onChange={(value) => setEditForm({ ...editForm, asset: value })}
            suggestions={Object.values(cryptoMap)}
          />
        </td>
        <td className="p-2 align-middle"><input type="number" step="any" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm" /></td>
        <td className="p-2 align-middle"><input type="number" step="any" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 w-full text-sm" /></td>
        <td className="p-2 text-right align-middle">R$ {totalOperation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td className="p-2 align-middle">
          <div className="flex gap-2">
            <Button onClick={handleSave} variant="primary" icon="fa-save" className="py-1 px-2 text-xs" />
            <Button onClick={handleCancel} variant="ghost" icon="fa-times" className="py-1 px-2 text-xs" />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-800/50">
      <td className={`p-2 font-medium ${transaction.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{transaction.type === 'buy' ? 'COMPRA' : 'VENDA'}</td>
      <td className="p-2 text-gray-400">{new Date(transaction.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
      <td className="p-2 font-bold">{transaction.asset}</td>
      <td className="p-2 text-right">{transaction.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
      <td className="p-2 text-right">R$ {transaction.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="p-2 text-right">R$ {(transaction.quantity * transaction.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="p-2">
        <div className="flex gap-2">
          <Button onClick={handleEdit} variant="ghost" icon="fa-pencil-alt" className="py-1 px-2 text-xs" />
          <Button onClick={() => onDelete(transaction.id)} variant="danger" icon="fa-trash" className="py-1 px-2 text-xs" />
        </div>
      </td>
    </tr>
  );
};

const NewTransactionRow: React.FC<{
  onAdd: (tx: Omit<Transaction, 'id'>) => void;
  cryptoMap: CryptoMap;
  addToast: (message: string, type: Toast['type']) => void;
}> = ({ onAdd, cryptoMap, addToast }) => {
  const [newTx, setNewTx] = useState({
    type: 'buy' as 'buy' | 'sell',
    date: new Date().toISOString().split('T')[0],
    asset: '',
    quantity: '',
    value: ''
  });

  const [errors, setErrors] = useState({
    asset: false,
    quantity: false,
    value: false,
  });

  const validate = (tx: typeof newTx) => {
    const asset = tx.asset.trim();
    const quantity = parseFloat(tx.quantity);
    const value = parseFloat(tx.value);
    const isValidAsset = Object.keys(cryptoMap).map(s => s.toUpperCase()).includes(asset.toUpperCase());

    const newErrors = {
      asset: !asset || !isValidAsset,
      quantity: isNaN(quantity) || quantity <= 0,
      value: isNaN(value) || value <= 0,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  useEffect(() => {
    validate(newTx);
  }, [newTx, cryptoMap]);

  const handleInputChange = (field: keyof typeof newTx, value: string) => {
    setNewTx(prev => ({ ...prev, [field]: value }));
  };

  const handleAdd = () => {
    if (!validate(newTx)) {
      addToast("Por favor, corrija os campos inválidos.", "error");
      return;
    }

    onAdd({
      type: newTx.type,
      date: newTx.date,
      asset: newTx.asset.trim(),
      quantity: parseFloat(newTx.quantity),
      value: parseFloat(newTx.value)
    });
    setNewTx({
      type: 'buy',
      date: new Date().toISOString().split('T')[0],
      asset: '',
      quantity: '',
      value: ''
    });
  };

  const totalOperation = (parseFloat(newTx.quantity) || 0) * (parseFloat(newTx.value) || 0);
  const isFormValid = !Object.values(errors).some(Boolean);

  return (
    <tr className="bg-gray-800" id="onboarding-new-tx-row">
      <td className="p-2 align-middle">
        <select value={newTx.type} onChange={(e) => handleInputChange('type', e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm">
          <option value="buy">Compra</option>
          <option value="sell">Venda</option>
        </select>
      </td>
      <td className="p-2 align-middle"><input type="date" value={newTx.date} onChange={(e) => handleInputChange('date', e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-2 w-full text-sm" /></td>
      <td className="p-2 align-middle">
        <AutoCompleteInput
          value={newTx.asset}
          onChange={(value) => handleInputChange('asset', value)}
          suggestions={Object.values(cryptoMap)}
          placeholder="ex: BTC"
        />
      </td>
      <td className="p-2 align-middle">
        <input
          type="number"
          step="any"
          placeholder="0,00"
          value={newTx.quantity}
          onChange={(e) => handleInputChange('quantity', e.target.value)}
          className={`bg-gray-900 border rounded p-2 w-full text-sm focus:outline-none focus:ring-2 ${errors.quantity ? 'border-red-500 text-red-400 focus:ring-red-500' : 'border-gray-600 focus:ring-indigo-500'
            }`}
        />
      </td>
      <td className="p-2 align-middle">
        <input
          type="number"
          step="any"
          placeholder="0,00"
          value={newTx.value}
          onChange={(e) => handleInputChange('value', e.target.value)}
          className={`bg-gray-900 border rounded p-2 w-full text-sm focus:outline-none focus:ring-2 ${errors.value ? 'border-red-500 text-red-400 focus:ring-red-500' : 'border-gray-600 focus:ring-indigo-500'
            }`}
        />
      </td>
      <td className="p-2 text-right align-middle">R$ {totalOperation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="p-2 align-middle">
        <Button onClick={handleAdd} variant="primary" icon="fa-plus" className="w-full justify-center" disabled={!isFormValid}>
          Adicionar
        </Button>
      </td>
    </tr>
  )
}


const TransactionsSection: React.FC<TransactionsSectionProps> = ({
  transactions,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  cryptoMap,
  addToast,
  onImport,
  accountNames,
  isMultiAccountView,
}) => {

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (transactions.length === 0) {
      addToast("Nenhuma transação para exportar.", "info");
      return;
    }

    const exportData = transactions.map(tx => ({
      'Operação': tx.type === 'buy' ? 'Compra' : 'Venda',
      'Data': new Date(tx.date + 'T00:00:00'),
      'Ativo': tx.asset,
      'Quantidade': tx.quantity,
      'Valor (BRL)': tx.value,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    worksheet['!cols'] = [{ wch: 10 }, { wch: 12, z: 'dd/mm/yyyy' }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

    const sanitizedName = accountNames.replace(/[^a-z0-9_]/gi, '-').toLowerCase();
    const fileName = `crypto-portfolio_${sanitizedName}_export.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const expectedHeaders = {
        operation: 'Operação',
        date: 'Data',
        asset: 'Ativo',
        quantity: 'Quantidade',
        value: 'Valor (BRL)',
      };

      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        const validTransactions: Omit<Transaction, 'id'>[] = [];
        const errors: string[] = [];

        if (json.length === 0) {
          addToast("O arquivo selecionado está vazio ou não possui dados na primeira planilha.", "error");
          return;
        }

        const headers = Object.keys(json[0]);
        if (!headers.includes(expectedHeaders.operation) || !headers.includes(expectedHeaders.date) || !headers.includes(expectedHeaders.asset)) {
          addToast(`A importação falhou. O arquivo possui cabeçalhos de coluna incorretos.`, "error");
          return;
        }

        json.forEach((row, index) => {
          const rowIndex = index + 2;

          const operation = row[expectedHeaders.operation];
          const date = row[expectedHeaders.date];
          const asset = row[expectedHeaders.asset];
          const quantity = row[expectedHeaders.quantity];
          const value = row[expectedHeaders.value];

          let rowIsValid = true;
          let parsedDate: Date | null = null;

          if (date instanceof Date && !isNaN(date.getTime())) {
            parsedDate = date;
          } else if (typeof date === 'string') {
            const parts = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (parts) {
              const [, day, month, year] = parts;
              parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
            }
          }
          if (!parsedDate) {
            errors.push(`Linha ${rowIndex}: '${expectedHeaders.date}' inválida ou ausente. Use o formato DD/MM/YYYY ou uma data válida do Excel.`);
            rowIsValid = false;
          }

          const lowerType = String(operation || '').toLowerCase().trim();
          if (lowerType !== 'compra' && lowerType !== 'venda') {
            errors.push(`Linha ${rowIndex}: '${expectedHeaders.operation}' inválida ou ausente. Deve ser 'Compra' ou 'Venda'.`);
            rowIsValid = false;
          }

          if (!asset || typeof asset !== 'string' || asset.trim() === '') {
            errors.push(`Linha ${rowIndex}: '${expectedHeaders.asset}' inválido ou ausente.`);
            rowIsValid = false;
          }

          const parseNumericValue = (val: any): number => {
            if (val === null || val === undefined) return NaN;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              return Number(val.replace(/\./g, '').replace(',', '.'));
            }
            return NaN;
          };

          const numQuantity = parseNumericValue(quantity);
          if (isNaN(numQuantity) || numQuantity <= 0) {
            errors.push(`Linha ${rowIndex}: '${expectedHeaders.quantity}' inválida ou ausente. Deve ser um número positivo.`);
            rowIsValid = false;
          }

          const numValue = parseNumericValue(value);
          if (isNaN(numValue) || numValue <= 0) {
            errors.push(`Linha ${rowIndex}: '${expectedHeaders.value}' inválida ou ausente. Deve ser um número positivo.`);
            rowIsValid = false;
          }

          if (rowIsValid && parsedDate) {
            const assetStr = String(asset).toUpperCase().trim();
            const correctedAsset = cryptoMap[assetStr] || assetStr;
            validTransactions.push({
              type: lowerType === 'compra' ? 'buy' : 'sell',
              date: parsedDate.toISOString().split('T')[0],
              asset: correctedAsset,
              quantity: numQuantity,
              value: numValue
            });
          }
        });

        if (errors.length > 0) {
          errors.slice(0, 5).forEach(err => addToast(err, 'error'));
          if (errors.length > 5) {
            addToast(`E mais ${errors.length - 5} outros erros...`, 'error');
          }
        } else if (validTransactions.length === 0) {
          addToast("Nenhuma transação válida encontrada para importar.", "error");
        } else {
          onImport(validTransactions);
        }
      } catch (error) {
        console.error("Erro ao importar arquivo:", error);
        addToast(`Falha ao processar o arquivo. Pode estar corrompido ou em formato não suportado.`, "error");
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportClick = () => {
    if (isMultiAccountView) {
      addToast("Selecione uma única conta para importar transações.", "error");
      return;
    }
    setIsImportModalOpen(true);
  };

  const handleSelectFile = () => {
    setIsImportModalOpen(false);
    fileInputRef.current?.click();
  };


  return (
    <>
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Transações do Excel"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSelectFile} icon="fa-file-excel">Selecionar Arquivo</Button>
          </>
        }
      >
        <div className="space-y-4 text-gray-300">
          <p>Prepare sua planilha com as seguintes colunas para uma importação bem-sucedida:</p>
          <ul className="list-disc list-inside space-y-2 bg-gray-900/50 p-3 rounded-md border border-gray-700">
            <li><code className="bg-gray-700 px-1 rounded-sm text-indigo-300">Operação</code>: Aceita os valores <span className="font-semibold">"Compra"</span> ou <span className="font-semibold">"Venda"</span>.</li>
            <li><code className="bg-gray-700 px-1 rounded-sm text-indigo-300">Data</code>: Use o formato de data do Excel ou texto no formato <span className="font-semibold">DD/MM/AAAA</span>.</li>
            <li><code className="bg-gray-700 px-1 rounded-sm text-indigo-300">Ativo</code>: O ticker da criptomoeda (ex: <span className="font-semibold">BTC</span>, <span className="font-semibold">ETH</span>).</li>
            <li><code className="bg-gray-700 px-1 rounded-sm text-indigo-300">Quantidade</code>: Um número positivo para a quantidade negociada.</li>
            <li><code className="bg-gray-700 px-1 rounded-sm text-indigo-300">Valor (BRL)</code>: O preço unitário em Reais (BRL) da transação.</li>
          </ul>
          <p className="text-sm text-gray-400">
            <i className="fas fa-info-circle mr-1"></i> A primeira linha da sua planilha deve conter exatamente estes cabeçalhos.
          </p>
        </div>
      </Modal>
      <div className="bg-gray-800/50 rounded-lg p-4 shadow-xl border border-indigo-500/30 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Transações</h2>
          <div className="flex gap-2">
            <Button onClick={handleImportClick} icon="fa-download" variant="secondary" className="py-1.5 px-3 text-xs" disabled={isMultiAccountView}>Importar do Excel</Button>
            <Button onClick={handleExport} icon="fa-upload" variant="secondary" className="py-1.5 px-3 text-xs">Exportar para Excel</Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
              aria-hidden="true"
            />
          </div>
        </div>
        {isMultiAccountView && (
          <div className="absolute inset-0 bg-gray-800/80 backdrop-blur-sm flex flex-col justify-center items-center z-10 rounded-lg">
            <i className="fas fa-info-circle text-3xl text-indigo-400 mb-3"></i>
            <h3 className="text-lg font-semibold text-white">Modo de Visualização de Múltiplas Contas</h3>
            <p className="text-gray-400">Por favor, selecione uma única conta no cabeçalho para adicionar ou editar transações.</p>
          </div>
        )}
        <div className="overflow-x-auto overflow-y-visible min-h-[220px]">
          <table className="w-full text-sm table-auto">
            <thead className="text-xs text-gray-400 uppercase">
              <tr>
                <th className="p-2 text-left w-24">Tipo</th>
                <th className="p-2 text-left w-32">Data</th>
                <th className="p-2 text-left min-w-[150px]">Ativo</th>
                <th className="p-2 text-right w-32">Quantidade</th>
                <th className="p-2 text-right w-32">Valor (BRL)</th>
                <th className="p-2 text-right w-40">Total da Operação</th>
                <th className="p-2 text-left w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              <NewTransactionRow onAdd={onAddTransaction} cryptoMap={cryptoMap} addToast={addToast} />
              {sortedTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <i className="fas fa-file-invoice-dollar fa-2x mb-2"></i>
                      <p className="font-semibold">Nenhuma transação encontrada.</p>
                      <p className="text-sm">Adicione sua primeira transação acima para começar.</p>
                    </div>
                  </td>
                </tr>
              )}
              {sortedTransactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onSave={onUpdateTransaction}
                  onDelete={onDeleteTransaction}
                  cryptoMap={cryptoMap}
                  addToast={addToast}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TransactionsSection;