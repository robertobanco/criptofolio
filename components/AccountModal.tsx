import React, { useState, useEffect, useRef } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, id?: number) => void;
    mode: 'add' | 'rename';
    initialName?: string;
    accountId?: number;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSave, mode, initialName = '', accountId }) => {
    const [name, setName] = useState(initialName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            // Focus the input when the modal opens
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialName]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim(), accountId);
            onClose();
        }
    };

    const title = mode === 'add' ? 'Adicionar Nova Conta' : 'Renomear Conta';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
                </>
            }
        >
            <div>
                <label htmlFor="account-name" className="block text-sm font-medium text-gray-300 mb-1">
                    Nome da Conta
                </label>
                <input
                    ref={inputRef}
                    id="account-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Minha Carteira"
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
            </div>
        </Modal>
    );
};

export default AccountModal;
