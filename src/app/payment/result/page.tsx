// src/app/payment/result/page.tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

function PaymentResultContent() {
  const router = useRouter();

  useEffect(() => {
    // Since we cannot read the POST body from PayUni on the client,
    // we show a generic processing message. The actual points update
    // is handled by the backend notify URL.
    // We will redirect the user to their profile page after a short delay.
    
    const timer = setTimeout(() => {
      router.push('/profile');
    }, 5000); // Redirect after 5 seconds

    // Cleanup the timer if the component unmounts
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <h2 className="text-2xl font-semibold">正在處理您的交易</h2>
      <p className="text-muted-foreground mt-2">
        請稍候，您的點數將在交易確認後自動更新。
        <br />
        五秒後將自動將您導向會員中心。
      </p>
      
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/profile">立即前往會員中心</Link>
        </Button>
      </div>
    </div>
  );
}


export default function PaymentResultPage() {
  return (
    <div className="container flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center">交易處理中</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />}>
            <PaymentResultContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
