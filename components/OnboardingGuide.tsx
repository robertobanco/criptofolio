
import React, { useState, useLayoutEffect, useRef } from 'react';
import Button from './ui/Button';
import { Section as SectionEnum } from '../types';

interface OnboardingGuideProps {
  onComplete: () => void;
  onNavigate: (section: SectionEnum) => void;
}

interface Step {
  targetId?: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onComplete, onNavigate }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: Step[] = [
    {
      position: 'center',
      title: 'Bem-vindo ao CryptoFolio AI! 🚀',
      content: 'Este é um tour rápido para mostrar as principais funcionalidades. Vamos começar a configurar seu portfólio para o sucesso!',
    },
    {
      targetId: 'onboarding-account-dropdown',
      position: 'bottom',
      title: '1. Gerencie suas Contas',
      content: 'Você pode criar múltiplas carteiras (contas) para organizar seus ativos, por exemplo, uma para cada corretora.',
    },
    {
      targetId: 'onboarding-new-tx-row',
      position: 'bottom',
      title: '2. Adicione suas Transações',
      content: 'Este é o coração do app. Registre suas compras e vendas aqui para que possamos analisar seu desempenho.',
      action: () => onNavigate(SectionEnum.Transactions),
    },
    {
      targetId: 'onboarding-ai-btn',
      position: 'bottom',
      title: '3. Análise com Inteligência Artificial',
      content: 'Nossa IA pode fornecer insights, responder perguntas complexas e até ajudar a rebalancear sua carteira de forma inteligente.',
      action: () => onNavigate(SectionEnum.Dashboard),
    },
    {
      targetId: 'onboarding-settings-btn',
      position: 'bottom',
      title: '4. Configure suas Chaves de API',
      content: 'Essencial! Aqui você adiciona suas chaves da CoinMarketCap, CryptoCompare e Gemini para obter preços, gráficos e análises de IA.',
    },
    {
      position: 'center',
      title: 'Tudo Pronto!',
      content: 'Agora vamos abrir as configurações para você inserir suas chaves e começar. Bons investimentos!',
    },
  ];

  const currentStep = steps[stepIndex];

  useLayoutEffect(() => {
    if (currentStep.action) {
      currentStep.action();
    }
    
    const updatePosition = () => {
        const targetElement = currentStep.targetId ? document.getElementById(currentStep.targetId) : null;
        const rect = targetElement?.getBoundingClientRect() ?? null;
        setTargetRect(rect);
        
        const tooltipEl = tooltipRef.current;
        if (!tooltipEl) return;

        const isMobile = window.innerWidth < 768;

        // On mobile, or for centered steps, always position the tooltip in the middle of the screen.
        if (isMobile || !rect || currentStep.position === 'center') {
          setStyle({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: 'calc(100vw - 32px)', // Ensure it fits on small screens
          });
          return;
        }

        // Desktop positioning logic
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const margin = 16;
        let top = 0;
        let left = 0;
        let transform = '';
        
        switch (currentStep.position) {
            case 'bottom':
                top = rect.bottom + margin;
                left = rect.left + rect.width / 2;
                transform = 'translateX(-50%)';
                break;
            case 'top':
                top = rect.top - margin;
                left = rect.left + rect.width / 2;
                transform = 'translate(-50%, -100%)';
                break;
            case 'left':
                top = rect.top + rect.height / 2;
                left = rect.left - margin;
                transform = 'translate(-100%, -50%)';
                break;
            case 'right':
                top = rect.top + rect.height / 2;
                left = rect.right + margin;
                transform = 'translateY(-50%)';
                break;
        }

        setStyle({
            top: `${top}px`,
            left: `${left}px`,
            transform: transform,
        });
    };
    
    const timeoutId = setTimeout(updatePosition, 50);
    window.addEventListener('resize', updatePosition);

    return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updatePosition);
    };

  }, [stepIndex, currentStep.targetId, currentStep.position, currentStep.action]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete();
    }
  };
  
  const handleSkip = () => {
      onComplete();
  };

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
        {/* Backdrop */}
        <div 
            className="absolute inset-0 bg-black/70 transition-all duration-300"
            style={{
                clipPath: targetRect 
                    ? `path(evenodd, 'M0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${targetRect.x - 6} ${targetRect.y - 6} H ${targetRect.right + 6} V ${targetRect.bottom + 6} H ${targetRect.x - 6} Z')` 
                    : 'none'
            }}
        ></div>

      {/* Tooltip/Modal Box */}
      <div
        ref={tooltipRef}
        className="fixed bg-gray-800 p-6 rounded-lg shadow-2xl max-w-sm border border-indigo-500/50 transition-all duration-300 animate-fadeIn"
        style={style}
      >
        <h3 className="text-xl font-bold text-indigo-400 mb-3">{currentStep.title}</h3>
        <p className="text-gray-300 mb-6">{currentStep.content}</p>
        <div className="flex justify-between items-center">
            <div>
                {!isLastStep && (
                    <Button onClick={handleSkip} variant="ghost">
                        Pular Tour
                    </Button>
                )}
            </div>
          <div className="flex items-center gap-3">
             <span className="text-sm text-gray-500">{stepIndex + 1} / {steps.length}</span>
            <Button onClick={handleNext} variant="primary">
              {isLastStep ? 'Concluir' : 'Próximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;
