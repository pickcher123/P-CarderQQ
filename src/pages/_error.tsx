function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-slate-950 text-white">
      <h1 className="text-4xl font-bold mb-4">{statusCode ? `${statusCode} - 伺服器錯誤` : '發生錯誤'}</h1>
      <p className="mb-8 text-slate-400">抱歉，系統遭遇未預期狀況。</p>
      <a href="/" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-md">回到首頁</a>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
