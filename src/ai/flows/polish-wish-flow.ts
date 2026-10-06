export async function polishWish({ wish }: { wish: string }): Promise<{ polishedWish: string }> {
  try {
    const res = await fetch('/api/ai/polish-wish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wish }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.polishedWish) return { polishedWish: data.polishedWish };
    }
  } catch (e) {
    // 忽略連線異常走本地強化
  }

  // 本地優雅潤飾增強
  const trimmed = wish.trim();
  const prefixes = [
    '【心願寄託】祈願能抽到心心念念的',
    '【狂熱收藏】強烈敲碗許願！希望能盡快迎來',
    '【球員卡心願】夢幻逸品！許願池賜福讓我遇見',
  ];
  const selectedPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return { polishedWish: `${selectedPrefix}：${trimmed}！🙏✨` };
}
