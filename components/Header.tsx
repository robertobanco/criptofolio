import React, { useState, useRef, useEffect } from 'react';
import { Section, Account, Toast } from '../types';
import Button from './ui/Button';

interface HeaderProps {
    activeSection: Section;
    setActiveSection: (section: Section) => void;
    onAnalyze: () => void; // Para o chat
    isAnalyzing: boolean; // Para o chat
    onOpenSettings: () => void;
    accounts: Account[];
    activeAccountIds: number[];
    onSelectAccountIds: (ids: number[]) => void;
    onRefreshPrices: () => void;
    isLoadingPrices: boolean;
    isAutoRefreshEnabled: boolean;
    onToggleAutoRefresh: (enabled: boolean) => void;
    lastUpdated: Date | null;
    hasTriggeredAlerts: boolean;
    onManageAccount: (mode: 'add' | 'rename', accountId?: number, accountName?: string) => void;
    onDeleteAccount: (id: number) => void;
    addToast: (message: string, type: Toast['type']) => void;
    onOpenBriefingModal: () => void;
    isPrivacyMode: boolean;
    onTogglePrivacyMode: (enabled: boolean) => void;
}

const NavButton: React.FC<{
    label: string;
    isActive?: boolean;
    onClick: () => void;
    icon?: string;
    hasNotification?: boolean;
    isHighlighted?: boolean;
    isMobile?: boolean;
}> = ({ label, isActive = false, onClick, icon, hasNotification = false, isHighlighted = false, isMobile = false }) => {
    const baseClasses = `font-medium transition-colors flex items-center gap-2 w-full text-left ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 rounded-md text-sm'}`;

    let styleClasses = '';
    if (isActive) {
        styleClasses = 'bg-indigo-600 text-white';
    } else if (isHighlighted) {
        styleClasses = 'text-purple-300 hover:bg-purple-900/50 border border-purple-500/0 hover:border-purple-500/50';
    } else {
        styleClasses = 'text-gray-300 hover:bg-gray-700 hover:text-white';
    }

    const notificationClass = hasNotification ? 'text-yellow-400 animate-pulse' : '';

    return (
        <button onClick={onClick} className={`${baseClasses} ${styleClasses} ${notificationClass}`}>
            {icon && <i className={`fas ${icon} w-5 text-center`}></i>}
            {label}
        </button>
    );
};

const useClickOutside = (ref: React.RefObject<HTMLElement>, callback: () => void) => {
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callback();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref, callback]);
};

const formatLastUpdated = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        return `Últ. At.: ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return `Últ. At.: ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
};


const Header: React.FC<HeaderProps> = ({
    activeSection,
    setActiveSection,
    onAnalyze,
    isAnalyzing,
    onOpenSettings,
    accounts,
    activeAccountIds,
    onSelectAccountIds,
    onRefreshPrices,
    isLoadingPrices,
    isAutoRefreshEnabled,
    onToggleAutoRefresh,
    lastUpdated,
    hasTriggeredAlerts,
    onManageAccount,
    onDeleteAccount,
    addToast,
    onOpenBriefingModal,
    isPrivacyMode,
    onTogglePrivacyMode,
}) => {
    const [isAccountDropdownOpen, setAccountDropdownOpen] = useState(false);
    const [isManageDropdownOpen, setManageDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

    const accountDropdownRef = useRef<HTMLDivElement>(null);
    const manageDropdownRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    useClickOutside(accountDropdownRef, () => setAccountDropdownOpen(false));
    useClickOutside(manageDropdownRef, () => setManageDropdownOpen(false));
    useClickOutside(mobileMenuRef, () => setMobileMenuOpen(false));


    const handleAccountSelection = (id: number) => {
        const isSelected = activeAccountIds.includes(id);
        let newSelection;
        if (isSelected) {
            newSelection = activeAccountIds.filter(activeId => activeId !== id);
        } else {
            newSelection = [...activeAccountIds, id];
        }
        // Ensure at least one account is always selected
        if (newSelection.length > 0) {
            onSelectAccountIds(newSelection);
        }
    };

    const handleSelectAllAccounts = () => {
        if (activeAccountIds.length === accounts.length) {
            // Deselect all, but keep the first one selected
            onSelectAccountIds([accounts[0].id]);
        } else {
            onSelectAccountIds(accounts.map(a => a.id));
        }
    };

    const handleAddAccountClick = () => {
        onManageAccount('add');
        setManageDropdownOpen(false);
    };

    const handleRenameAccountClick = () => {
        if (activeAccountIds.length === 1) {
            const account = accounts.find(a => a.id === activeAccountIds[0]);
            if (account) {
                onManageAccount('rename', account.id, account.name);
            }
        } else {
            addToast("Selecione uma única conta para renomear.", "info");
        }
        setManageDropdownOpen(false);
    };

    const handleDeleteAccountClick = () => {
        if (activeAccountIds.length === 1) {
            onDeleteAccount(activeAccountIds[0]);
        } else {
            addToast("Selecione uma única conta para excluir.", "info");
        }
        setManageDropdownOpen(false);
    };

    const selectedAccountNames = () => {
        if (activeAccountIds.length > 1) {
            return `${activeAccountIds.length} Contas`;
        }
        const account = accounts.find(acc => acc.id === activeAccountIds[0]);
        return account?.name || 'Nenhuma Conta';
    };

    const handleChatClick = () => {
        onAnalyze();
    };

    const handleNavClick = (section: Section) => {
        setActiveSection(section);
        setMobileMenuOpen(false);
    };

    const handleBriefingClick = () => {
        onOpenBriefingModal();
        setMobileMenuOpen(false);
    }

    const renderNavItems = (isMobile = false) => (
        <>
            <NavButton
                label="Painel"
                isActive={activeSection === Section.Dashboard}
                onClick={() => handleNavClick(Section.Dashboard)}
                icon="fa-home"
                isMobile={isMobile}
            />
            {isMobile && <div className="border-t border-gray-700 mx-4 my-1"></div>}
            {!isMobile && <div className="border-l border-gray-700 h-5 self-center mx-1"></div>}
            <NavButton
                label="Transações"
                isActive={activeSection === Section.Transactions}
                onClick={() => handleNavClick(Section.Transactions)}
                icon="fa-exchange-alt"
                isMobile={isMobile}
            />
            <NavButton
                label="Análise de Lucros"
                isActive={activeSection === Section.ProfitAnalysis}
                onClick={() => handleNavClick(Section.ProfitAnalysis)}
                icon="fa-chart-line"
                isMobile={isMobile}
            />
            <NavButton
                label="Comparador"
                isActive={activeSection === Section.PerformanceComparator}
                onClick={() => handleNavClick(Section.PerformanceComparator)}
                icon="fa-poll"
                isMobile={isMobile}
            />
            <NavButton
                label="Impostos"
                isActive={activeSection === Section.Taxes}
                onClick={() => handleNavClick(Section.Taxes)}
                icon="fa-file-invoice-dollar"
                isMobile={isMobile}
            />
            <NavButton
                label="Rebalancear"
                isActive={activeSection === Section.Rebalance}
                onClick={() => handleNavClick(Section.Rebalance)}
                icon="fa-balance-scale"
                isMobile={isMobile}
            />
            <NavButton
                label="Alertas"
                isActive={activeSection === Section.Alerts}
                onClick={() => handleNavClick(Section.Alerts)}
                icon="fa-bell"
                hasNotification={hasTriggeredAlerts}
                isMobile={isMobile}
            />
            <NavButton
                label="Watchlist"
                isActive={activeSection === Section.Watchlist}
                onClick={() => handleNavClick(Section.Watchlist)}
                icon="fa-star"
                isMobile={isMobile}
            />
            {isMobile && <div className="border-t border-gray-700 mx-4 my-1"></div>}
            <NavButton
                label="Briefing Diário"
                onClick={handleBriefingClick}
                icon="fa-brain"
                isHighlighted={true}
                isMobile={isMobile}
            />
        </>
    );

    return (
        <header className="bg-gray-800 shadow-md p-4 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex flex-col gap-4">

                {/* --- Top Row: Logo, Mobile Nav, Main Actions --- */}
                <div className="flex justify-between items-center w-full">
                    {/* Left side: Mobile Menu and Logo */}
                    <div className="flex items-center gap-2">
                        {/* Mobile Hamburger Menu */}
                        <div className="md:hidden relative" ref={mobileMenuRef}>
                            <button
                                onClick={() => setMobileMenuOpen(prev => !prev)}
                                className="px-3 py-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white"
                                aria-label="Abrir menu de navegação"
                                aria-expanded={isMobileMenuOpen}
                            >
                                <i className="fas fa-bars fa-lg"></i>
                            </button>
                            {isMobileMenuOpen && (
                                <div className="absolute top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden flex flex-col">
                                    {renderNavItems(true)}
                                </div>
                            )}
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-chart-pie text-indigo-400"></i>
                            <span>Cripto Control</span>
                        </h1>
                    </div>

                    {/* Right side - Main Actions */}
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden md:flex items-center gap-3">
                            {lastUpdated && !isLoadingPrices && (
                                <div className="text-xs text-gray-400" title={`Atualizado em ${lastUpdated.toLocaleString('pt-BR')}`}>
                                    {formatLastUpdated(lastUpdated)}
                                </div>
                            )}
                            <div className="flex items-center bg-gray-700 rounded-md p-0.5 gap-0.5">
                                <button
                                    onClick={onRefreshPrices}
                                    disabled={isLoadingPrices}
                                    className="px-2 py-1 rounded-md font-semibold text-sm transition-all text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-wait"
                                    aria-label="Atualizar preços"
                                    title="Atualizar preços"
                                >
                                    <i className={`fas fa-sync ${isLoadingPrices ? 'fa-spin' : ''}`}></i>
                                </button>
                                <button
                                    role="switch"
                                    aria-checked={isAutoRefreshEnabled}
                                    onClick={() => onToggleAutoRefresh(!isAutoRefreshEnabled)}
                                    className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${isAutoRefreshEnabled ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600 text-gray-300'}`}
                                    title={isAutoRefreshEnabled ? 'Desativar atualização automática' : 'Ativar atualização automática'}
                                >
                                    AUTO
                                </button>
                            </div>
                        </div>
                        {hasTriggeredAlerts && (
                            <button
                                onClick={() => handleNavClick(Section.Alerts)}
                                className="md:hidden px-3 py-2 rounded-md text-yellow-400 animate-pulse hover:bg-gray-700"
                                aria-label="Ver alertas disparados"
                                title="Alertas disparados!"
                            >
                                <i className="fas fa-bell fa-lg"></i>
                            </button>
                        )}
                        <Button
                            id="onboarding-ai-btn"
                            onClick={handleChatClick}
                            disabled={isAnalyzing}
                            variant="primary"
                            className="bg-purple-600 hover:bg-purple-500"
                        >
                            {isAnalyzing ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span className="hidden sm:inline">Analisando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-comments"></i>
                                    <span className="hidden sm:inline">Chat com IA</span>
                                </>
                            )}
                        </Button>
                        <button
                            onClick={() => onTogglePrivacyMode(!isPrivacyMode)}
                            className={`px-3 py-2 rounded-md font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 ${isPrivacyMode ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                            aria-label={isPrivacyMode ? "Desativar modo privacidade" : "Ativar modo privacidade"}
                            title={isPrivacyMode ? "Mostrar valores" : "Ocultar valores"}
                        >
                            <i className={`fas ${isPrivacyMode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                        <button
                            id="onboarding-settings-btn"
                            onClick={onOpenSettings}
                            className="px-3 py-2 rounded-md font-semibold text-sm transition-all bg-gray-700 text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500"
                            aria-label="Abrir configurações"
                        >
                            <i className="fas fa-cogs"></i>
                        </button>
                    </div>
                </div>

                {/* --- Bottom Row: Account Management & Secondary Actions --- */}
                <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-1 flex-grow" id="onboarding-account-dropdown">
                        <div className="relative" ref={accountDropdownRef}>
                            <button
                                onClick={() => setAccountDropdownOpen(prev => !prev)}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold pl-3 pr-2 py-2 rounded-l-md text-sm transition-colors w-full"
                            >
                                <span className="truncate max-w-[150px] sm:max-w-xs">{selectedAccountNames()}</span>
                                <i className={`fas fa-chevron-down transition-transform duration-200 ${isAccountDropdownOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            {isAccountDropdownOpen && (
                                <div className="absolute mt-2 w-64 bg-gray-700 rounded-md shadow-lg z-50 overflow-hidden">
                                    <ul>
                                        <li className="border-b border-gray-600">
                                            <a
                                                href="#"
                                                onClick={(e) => { e.preventDefault(); handleSelectAllAccounts(); }}
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-500"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                                    readOnly
                                                    checked={activeAccountIds.length === accounts.length}
                                                />
                                                <span>Selecionar Todas</span>
                                            </a>
                                        </li>
                                        {accounts.map(account => (
                                            <li key={account.id}>
                                                <a
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleAccountSelection(account.id);
                                                    }}
                                                    className={`flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-500 ${activeAccountIds.includes(account.id) ? 'bg-indigo-600/50' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                                        readOnly
                                                        checked={activeAccountIds.includes(account.id)}
                                                    />
                                                    <span>{account.name}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={manageDropdownRef}>
                            <button
                                onClick={() => setManageDropdownOpen(prev => !prev)}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-3 py-2 rounded-r-md text-sm transition-colors border-l border-gray-600/50"
                                aria-label="Gerenciar contas"
                            >
                                <i className="fas fa-ellipsis-v"></i>
                            </button>
                            {isManageDropdownOpen && (
                                <div className="absolute mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-50 overflow-hidden right-0">
                                    <ul className="text-sm text-gray-200">
                                        <li>
                                            <button onClick={handleAddAccountClick} className="w-full text-left block px-4 py-2 hover:bg-indigo-500">Adicionar Nova Conta</button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={handleRenameAccountClick}
                                                disabled={activeAccountIds.length !== 1}
                                                className="w-full text-left block px-4 py-2 hover:bg-indigo-500 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                                            >
                                                Renomear Conta
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={handleDeleteAccountClick}
                                                disabled={activeAccountIds.length !== 1}
                                                className="w-full text-left block px-4 py-2 hover:bg-red-500 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-700 disabled:hover:text-gray-500"
                                            >
                                                Excluir Conta
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Price Refresh for Mobile */}
                    <div className="flex md:hidden items-center gap-3">
                        {lastUpdated && !isLoadingPrices && (
                            <div className="text-xs text-gray-400" title={`Atualizado em ${lastUpdated.toLocaleString('pt-BR')}`}>
                                {formatLastUpdated(lastUpdated)}
                            </div>
                        )}
                        <div className="flex items-center bg-gray-700 rounded-md p-0.5 gap-0.5">
                            <button
                                onClick={onRefreshPrices}
                                disabled={isLoadingPrices}
                                className="px-2 py-1 rounded-md font-semibold text-sm transition-all text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-wait"
                                aria-label="Atualizar preços"
                                title="Atualizar preços"
                            >
                                <i className={`fas fa-sync ${isLoadingPrices ? 'fa-spin' : ''}`}></i>
                            </button>
                            <button
                                role="switch"
                                aria-checked={isAutoRefreshEnabled}
                                onClick={() => onToggleAutoRefresh(!isAutoRefreshEnabled)}
                                className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${isAutoRefreshEnabled ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600 text-gray-300'}`}
                                title={isAutoRefreshEnabled ? 'Desativar atualização automática' : 'Ativar atualização automática'}
                            >
                                AUTO
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- Main Navigation for Desktop --- */}
                <nav className="hidden md:flex items-center justify-center space-x-2 bg-gray-900/50 p-1 rounded-lg">
                    {renderNavItems(false)}
                </nav>

            </div>
        </header>
    );
};

export default Header;
