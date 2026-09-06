import type { Metadata, Viewport } from 'next';
import '@/lib/safe-json';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import Script from 'next/script';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#070b14',
};

export const metadata: Metadata = {
  title: 'P+Carder 玩卡人｜球員卡線上抽卡、福袋、團拆平台',
  description: 'P+Carder 玩卡人是專業領先的球員卡數位收藏平台，提供線上抽卡、拼卡競技、幸運福袋、直播團拆等多元玩法。公平透明的機率機制，讓您安心收藏心愛的球星卡。立即加入，開啟您的玩卡之旅！',
  keywords: '球員卡, P+Carder, 抽卡, 福袋, 團拆, 籃球卡, 棒球卡, 數位收藏, 玩卡人',
  metadataBase: new URL('https://p-carder.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://p-carder.com/',
    title: 'P+Carder 玩卡人｜球員卡線上抽卡、福袋、團拆平台',
    description: '專業領先的球員卡數位收藏平台，提供抽卡、福袋、團拆等多元玩法。公開透明、機率披露、數位存證。',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'P+Carder 玩卡人｜球員卡線上抽卡平台',
      },
    ],
    siteName: 'P+Carder 玩卡人',
    locale: 'zh_TW',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'P+Carder 玩卡人｜球員卡線上抽卡、福袋、團拆平台',
    description: '專業領先的球員卡數位收藏平台，提供抽卡、福袋、團拆等多元玩法',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: "/192x192.png",
    apple: "/192x192.png",
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://p-carder.com/#organization',
        'name': 'P+Carder 玩卡人',
        'alternateName': '云希國際股份有限公司',
        'url': 'https://p-carder.com/',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://p-carder.com/192x192.png'
        },
        'contactPoint': {
          '@type': 'ContactPoint',
          'email': 'pickcher1234@gmail.com',
          'contactType': 'customer service'
        }
      },
      {
        '@type': 'WebSite',
        '@id': 'https://p-carder.com/#website',
        'url': 'https://p-carder.com/',
        'name': 'P+Carder 玩卡人',
        'publisher': {
          '@id': 'https://p-carder.com/#organization'
        }
      }
    ]
  };

  return (
    <html lang="zh-Hant" suppressHydrationWarning className="bg-[#070b14] text-foreground min-h-screen min-h-[100dvh] w-full overflow-x-hidden m-0 p-0">
      <body className={cn("min-h-screen min-h-[100dvh] bg-[#070b14] text-foreground font-body antialiased overflow-x-hidden max-w-full w-full m-0 p-0")} suppressHydrationWarning>
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
