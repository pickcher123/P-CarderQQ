'use client';

import { useState, useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';
import { Badge } from '@/components/ui/badge';

export function Footer() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <footer className="border-t border-border/40 py-8">
      <div className="container pb-20 md:pb-0 relative flex flex-col items-center">
        <div className="text-center text-xs leading-loose text-muted-foreground sm:text-sm">
          <p>© {new Date().getFullYear()} P+Carder. All rights reserved.</p>
          <p>云希國際股份有限公司 統一編號: 90301251</p>
          <p>Email: pickcher1234@gmail.com | Line@: @288qqsyq</p>
        </div>
        
        {/* 版本標籤強化 - 置中顯示於底部 */}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 border-primary/30 text-primary font-code text-[10px] py-0 px-2 animate-pulse">
            System Production
          </Badge>
          <Badge variant="secondary" className="bg-black/40 border-white/10 text-white/60 font-code text-[10px] py-0 px-2">
            Ver {APP_VERSION}
          </Badge>
        </div>
      </div>
    </footer>
  );
}
