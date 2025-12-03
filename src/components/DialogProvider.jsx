import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DialogContext = createContext(null);

export function useDialog() {
    return useContext(DialogContext);
}

export default function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null);

    const close = (result) => {
        if (dialog && dialog.resolve) dialog.resolve(result);
        setDialog(null);
    };

    const api = useMemo(() => ({
        alert: (message, { title = 'Notice' } = {}) => new Promise((resolve) => {
            setDialog({ type: 'alert', title, message, resolve });
        }),
        confirm: (message, { title = 'Confirm' } = {}) => new Promise((resolve) => {
            setDialog({ type: 'confirm', title, message, resolve });
        }),
        prompt: (message, { title = 'Input', defaultValue = '' } = {}) => new Promise((resolve) => {
            setDialog({ type: 'prompt', title, message, resolve, defaultValue });
        }),
    }), [setDialog]);

    const [inputValue, setInputValue] = useState('');

    const onOpen = useCallback(() => {
        if (dialog?.type === 'prompt') setInputValue(dialog.defaultValue ?? '');
    }, [dialog]);

    return (
        <DialogContext.Provider value={api}>
            {children}
            {dialog && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => close(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-5 transform transition-all animate-scale-in">
                        <h3 className="text-lg font-semibold mb-2 text-[#1E293B]">{dialog.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{dialog.message}</p>
                        {dialog.type === 'prompt' && (
                            <input
                                autoFocus
                                className="input mb-4"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onFocus={onOpen}
                            />
                        )}
                        <div className="flex justify-end gap-2">
                            {dialog.type !== 'alert' && (
                                <button className="btn-secondary" onClick={() => close(false)}>Cancel</button>
                            )}
                            <button
                                className="btn-primary"
                                onClick={() => close(dialog.type === 'prompt' ? inputValue : true)}
                            >
                                {dialog.type === 'confirm' ? 'Confirm' : dialog.type === 'prompt' ? 'OK' : 'OK'}
                            </button>
                        </div>
                    </div>
                    <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes scaleIn { from { opacity: 0; transform: translateY(8px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
            .animate-fade-in { animation: fadeIn 150ms ease-out both }
            .animate-scale-in { animation: scaleIn 180ms ease-out both }
          `}</style>
                </div>
            )}
        </DialogContext.Provider>
    );
}


