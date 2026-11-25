import JSZip from 'jszip';

export interface SevenElevenOrderRow {
  packageValue: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  returnStoreName: string;
  returnStoreId: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  pickupStoreName: string;
  pickupStoreId: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 以 7-11 會員交貨便官方 Excel 範例檔 (/templates/711-template.xlsx) 為底版，
 * 100% 保留原始表頭、第 1~7 列範例、工作表保護鎖定、欄寬與樣式，
 * 從第 8 列 (B8 起) 寫入服務類型代碼固定為 2（常溫取貨不付款-一般材積）的訂單資料。
 */
export async function buildSevenElevenBatchXlsx(
  orders: SevenElevenOrderRow[],
  templateUrl = '/templates/711-template.xlsx'
): Promise<Blob> {
  const res = await fetch(templateUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`無法載入 7-11 官方範例檔 (${res.status})`);
  }
  const templateBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (!sheetFile || !sharedStringsFile) {
    throw new Error('7-11 範例檔結構不完整，缺少工作表或共用字串表');
  }

  let sheetXml = await sheetFile.async('string');
  let sstXml = await sharedStringsFile.async('string');

  // 解析既有 sharedStrings 數量，將新字串附加在結尾（相容 Windows Microsoft Excel 與 7-11 驗核）
  const existingSiMatches = sstXml.match(/<si[\s>]/g);
  let nextStringIndex = existingSiMatches ? existingSiMatches.length : 0;
  const existingCountMatch = sstXml.match(/\bcount="(\d+)"/);
  let totalStringRefCount = existingCountMatch ? parseInt(existingCountMatch[1], 10) : nextStringIndex;

  const addedStringsMap = new Map<string, number>();
  const addedSiXmlChunks: string[] = [];

  const getSharedStringIndex = (raw: string): number => {
    totalStringRefCount += 1;
    const cached = addedStringsMap.get(raw);
    if (cached !== undefined) return cached;
    const idx = nextStringIndex++;
    addedStringsMap.set(raw, idx);
    const escaped = escapeXml(raw);
    const needsPreserve = /^\s|\s$|\n/.test(raw);
    addedSiXmlChunks.push(
      needsPreserve
        ? `<si><t xml:space="preserve">${escaped}</t></si>`
        : `<si><t>${escaped}</t></si>`
    );
    return idx;
  };

  const makeStringCell = (ref: string, styleIdx: number, value: string): string => {
    if (!value) return '';
    const idx = getSharedStringIndex(value);
    return `<c r="${ref}" s="${styleIdx}" t="s"><v>${idx}</v></c>`;
  };

  const makeNumberOrTextCell = (ref: string, styleIdx: number, raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    // 若開頭為 0（如 012345）則以文字儲存避免 Excel 去掉前導 0；其餘純數字以數值寫入與官方範本一致
    if (/^[1-9]\d*$/.test(trimmed)) {
      return `<c r="${ref}" s="${styleIdx}"><v>${trimmed}</v></c>`;
    }
    return makeStringCell(ref, styleIdx, trimmed);
  };

  // 第 1~7 列為 7-11 官方鎖定表頭與範例列，實際寄件資料從第 8 列開始
  const START_ROW = 8;
  const newRowsXml: string[] = [];

  orders.forEach((order, index) => {
    const r = START_ROW + index;
    const pkgVal = (order.packageValue || '1000').replace(/\D/g, '') || '1000';
    const hasReturnStore = Boolean(order.returnStoreName.trim());

    // 樣式索引對應官方範本 styles.xml：
    // s="12" = 微軟正黑體 12pt / 未鎖定；s="18" = 文字格式(@) + 微軟正黑體 12pt / 未鎖定（電話欄 E、J 專用）
    const cells = [
      // A 欄：服務類型範例 (此欄不填寫) -> 留空
      `<c r="B${r}" s="12"><v>2</v></c>`, // B 欄：固定代碼 2 = (常溫)取貨不付款-一般材積
      `<c r="C${r}" s="12"><v>${pkgVal}</v></c>`, // C 欄：實際包裏價值
      makeStringCell(`D${r}`, 12, order.senderName.trim()), // D 欄：寄件人姓名
      makeStringCell(`E${r}`, 18, order.senderPhone.trim()), // E 欄：寄件人電話（文字格式保留 0）
      makeStringCell(`F${r}`, 12, order.senderEmail.trim()), // F 欄：寄件人 mail
      hasReturnStore ? makeStringCell(`G${r}`, 12, order.returnStoreName.trim()) : '', // G 欄：退貨門市（選填）
      hasReturnStore ? makeNumberOrTextCell(`H${r}`, 12, order.returnStoreId) : '', // H 欄：退貨門市店號
      makeStringCell(`I${r}`, 12, order.recipientName.trim()), // I 欄：取件人姓名
      makeStringCell(`J${r}`, 18, order.recipientPhone.trim()), // J 欄：取件人電話（文字格式保留 0）
      makeStringCell(`K${r}`, 12, order.recipientEmail.trim()), // K 欄：取件人 mail
      makeStringCell(`L${r}`, 12, order.pickupStoreName.trim()), // L 欄：取件門市
      makeNumberOrTextCell(`M${r}`, 12, order.pickupStoreId), // M 欄：取件門市店號
    ].filter(Boolean);

    newRowsXml.push(`<row r="${r}" spans="1:13" ht="17.5" customHeight="1">${cells.join('')}</row>`);
  });

  // 更新 sharedStrings.xml
  if (addedSiXmlChunks.length > 0) {
    sstXml = sstXml
      .replace(/\bcount="\d+"/, `count="${totalStringRefCount}"`)
      .replace(/\buniqueCount="\d+"/, `uniqueCount="${nextStringIndex}"`)
      .replace('</sst>', `${addedSiXmlChunks.join('')}</sst>`);
    zip.file('xl/sharedStrings.xml', sstXml);
  }

  // 更新 sheet1.xml：僅附加第 8 列起的新資料列與更新 dimension 範圍，完全不動第 1~7 列與 sheetProtection
  const lastRow = Math.max(7, START_ROW + orders.length - 1);
  sheetXml = sheetXml
    .replace(/<dimension ref="A1:M\d+"\/>/, `<dimension ref="A1:M${lastRow}"/>`)
    .replace('</sheetData>', `${newRowsXml.join('')}</sheetData>`);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}
