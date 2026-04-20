'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    }
    setDeferredPrompt(null);
    setIsAvailable(false);
  };

  if (!isAvailable || !isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[9999] flex items-center gap-2">
      <Button 
        onClick={handleInstallClick}
        className="rounded-full shadow-lg bg-primary text-primary-foreground font-black animate-bounce"
      >
        <Download className="mr-2 h-4 w-4" />
        安裝 APP
      </Button>
      <button 
        onClick={() => setIsVisible(false)}
        className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors"
        aria-label="關閉"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
