'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-3xl font-bold text-red-500">500 - 系統發生非預期錯誤</h1>
          <p className="text-gray-400">
            抱歉，頁面載入時發生異常。請點擊下方按鈕重試。
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
          >
            重新載入
          </button>
        </div>
      </body>
    </html>
  );
}
