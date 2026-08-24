'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function VIPRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/profile');
    }, [router]);

    return (
        <div className="container py-32 text-center flex flex-col items-center justify-center gap-4 text-white">
            <Loader2 className="animate-spin h-10 w-10 text-cyan-400" />
            <p className="font-headline tracking-widest text-slate-400 text-sm">正在前往會員中心...</p>
        </div>
    );
}
