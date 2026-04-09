'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h1 className="text-4xl font-bold mb-4">500 - 伺服器錯誤</h1>
      <p className="mb-8">抱歉，系統發生了一些問題。</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        重試
      </button>
    </div>
  );
}
