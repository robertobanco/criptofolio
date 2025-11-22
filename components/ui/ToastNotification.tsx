import React, { useState, useEffect } from 'react';
import type { Toast } from '../../types';

interface ToastNotificationProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Slide in
        const enterTimeout = setTimeout(() => setVisible(true), 10);

        // Start countdown to slide out
        const exitTimeout = setTimeout(() => {
            setVisible(false);
        }, 3000); // User-visible duration

        // Actually remove from DOM after slide-out animation
        const removeTimeout = setTimeout(() => {
            onDismiss(toast.id);
        }, 3300); // Duration + animation time

        return () => {
            clearTimeout(enterTimeout);
            clearTimeout(exitTimeout);
            clearTimeout(removeTimeout);
        };
    }, [toast.id, onDismiss]);

    const icons = {
        info: 'fa-bell',
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle'
    };

    const baseClasses = 'bg-gray-700 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 ease-in-out';
    const visibilityClasses = visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';

    return (
        <div className={`${baseClasses} ${visibilityClasses}`}>
            <i className={`fas ${icons[toast.type]}`}></i>
            <p className="flex-grow">{toast.message}</p>
            <button
                onClick={() => setVisible(false)}
                className="ml-auto text-gray-400 hover:text-white"
                aria-label="Dispensar notificação"
            >
                &times;
            </button>
        </div>
    );
};

export default ToastNotification;
