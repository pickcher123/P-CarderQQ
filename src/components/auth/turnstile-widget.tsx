'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
          size?: 'normal' | 'compact' | 'flexible';
          action?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action?: 'login' | 'register';
  resetKey?: number;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY);
}

/**
 * Cloudflare Turnstile 無感防機器人驗證元件（appearance: 'interaction-only'）
 * - 已配置 NEXT_PUBLIC_TURNSTILE_SITE_KEY 時：背景自動無感通過，僅可疑流量才要求互動。
 * - 未配置金鑰時：不阻擋操作，顯示內建防機器人與頻率保護狀態。
 */
export function TurnstileWidget({
  action = 'login',
  resetKey = 0,
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'verified' | 'error'>('loading');

  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      setStatus('loading');
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: 'dark',
        appearance: 'interaction-only',
        size: 'flexible',
        action,
        callback: (token: string) => {
          if (cancelled) return;
          setStatus('verified');
          onVerifyRef.current(token);
        },
        'expired-callback': () => {
          if (cancelled) return;
          setStatus('loading');
          onExpireRef.current?.();
        },
        'error-callback': () => {
          if (cancelled) return;
          setStatus('error');
          onErrorRef.current?.();
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          renderWidget();
        }
      }, 150);

      const timeout = setTimeout(() => {
        clearInterval(poll);
        if (!cancelled && !window.turnstile) {
          setStatus('error');
        }
      }, 10000);

      return () => {
        cancelled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [action, resetKey]);

  if (!SITE_KEY) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1 text-[10.5px] text-slate-400 select-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
        <span>已啟用無感安全防護與異常頻率偵測</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="w-full min-h-[1px]" />
      <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-slate-400 select-none">
        {status === 'verified' ? (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-300/90">無感人機安全驗證已通過</span>
          </>
        ) : status === 'error' ? (
          <span className="text-rose-400">安全驗證載入異常，請重新整理頁面</span>
        ) : (
          <>
            <Loader2 className="w-3 h-3 text-[#FDE68A] animate-spin shrink-0" />
            <span>正在背景進行無感安全驗證...</span>
          </>
        )}
      </div>
    </div>
  );
}
