import { GoogleGenAI } from '@google/genai';
import { getAdminDb } from './firebase-admin';
import * as admin from 'firebase-admin';

export interface AiMatchResult {
  matchStatus: 'finished' | 'in_progress' | 'not_started' | 'postponed' | 'unknown';
  actualScore?: string;
  winningOptions: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 透過 Gemini 聯網搜尋體育賽事的官方最終賽果、完賽比分與勝出選項
 */
export async function fetchMatchResultWithAi(event: {
  id: string;
  matchName: string;
  question: string;
  options: string[];
  sportCategory?: string;
  league?: string;
  bettingEndTime: string;
}): Promise<AiMatchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    throw new Error('未配置 GEMINI_API_KEY，無法執行 AI 賽果聯網搜尋');
  }

  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().split('T')[0];

  const prompt = `你是一個權威的體育賽事官方比分與盤口結算專家。
今天是 ${today}。
請利用 Google 搜尋下列這場賽事的官方最終賽果與完賽比分：

【賽事資訊】
- 聯賽：${event.league || '全球體育賽事'}
- 對決：${event.matchName}
- 預測競猜題目：${event.question}
- 本題提供給玩家下注的所有選項（完全一致比對）：${JSON.stringify(event.options)}
- 原訂下注截止/開賽時間：${event.bettingEndTime}

【你的任務】
1. 聯網搜尋此場賽事是否已經「完賽 (Final / Finished)」？
2. 如果已完賽，請查明官方「最終比分」(例如: 金州勇士 115 - 110 洛杉磯湖人)。
3. 根據題目「${event.question}」與官方比分，精確判定哪一個或哪些選項獲勝（必須從提供的選項陣列中完全挑選，不得自行發明文字）。例如若勇士淨勝 5 分且選項有 "金州勇士 (-3.5)"，則此選項獲勝。
4. 提供簡明清楚的裁定說明 (explanation，50-100字)。
5. 若比賽「尚未開打」、「延期」、「因雨暫停」或「進行中」，請將 matchStatus 設定為對應狀態，且 winningOptions 留空陣列。

請嚴格輸出合法的 JSON 物件（請勿附加任何額外 markdown 外層包裹或額外廢話，僅回傳標準 JSON）：
{
  "matchStatus": "finished" | "in_progress" | "not_started" | "postponed" | "unknown",
  "actualScore": "隊伍A 102 - 98 隊伍B",
  "winningOptions": ["獲勝選項文字"],
  "explanation": "裁判說明...",
  "confidence": "high" | "medium" | "low"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    // 清理 markdown code blocks
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);

    // 驗證 winningOptions 是否在 event.options 之中
    const validWinningOptions: string[] = [];
    if (Array.isArray(parsed.winningOptions)) {
      for (const w of parsed.winningOptions) {
        const found = event.options.find(
          (o) => o.trim().toLowerCase() === String(w).trim().toLowerCase()
        );
        if (found) {
          validWinningOptions.push(found);
        } else {
          // 模糊比對
          const fuzzy = event.options.find(
            (o) => o.includes(String(w)) || String(w).includes(o)
          );
          if (fuzzy && !validWinningOptions.includes(fuzzy)) {
            validWinningOptions.push(fuzzy);
          }
        }
      }
    }

    return {
      matchStatus: parsed.matchStatus || 'unknown',
      actualScore: parsed.actualScore || '',
      winningOptions: validWinningOptions,
      explanation: parsed.explanation || '',
      confidence: parsed.confidence || 'medium',
    };
  } catch (error: any) {
    console.error('AI Fetch Match Result Error:', error);
    throw new Error(`AI 賽果搜尋解析失敗: ${error.message || error}`);
  }
}

/**
 * 執行單一賽事結算與派發 P+ 點數
 */
export async function settlePredictionEvent(
  eventId: string,
  options?: {
    winningOptions?: string[];
    actualScore?: string;
    explanation?: string;
    settledBy?: string;
  }
) {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase Admin DB 尚未初始化');
  }

  const eventRef = db.collection('predictionEvents').doc(eventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    throw new Error(`找不到賽事 ID: ${eventId}`);
  }

  const eventData = eventDoc.data()!;
  let winningOptions = options?.winningOptions;
  let actualScore = options?.actualScore;
  let explanation = options?.explanation;

  // 若未指定 winningOptions，透過 AI 聯網查詢
  if (!winningOptions || winningOptions.length === 0) {
    const aiResult = await fetchMatchResultWithAi({
      id: eventId,
      matchName: eventData.matchName || '',
      question: eventData.question || '',
      options: eventData.options || [],
      sportCategory: eventData.sportCategory,
      league: eventData.league,
      bettingEndTime: eventData.bettingEndTime || '',
    });

    if (aiResult.matchStatus !== 'finished') {
      return {
        settled: false,
        eventId,
        matchName: eventData.matchName,
        reason: `賽事目前狀態為【${aiResult.matchStatus}】，尚未完賽，已暫緩結算。`,
        aiResult,
      };
    }

    if (!aiResult.winningOptions || aiResult.winningOptions.length === 0) {
      return {
        settled: false,
        eventId,
        matchName: eventData.matchName,
        reason: `賽事已完賽（${aiResult.actualScore}），但 AI 無法判定對應之獲勝選項，需管理員手動確認。`,
        aiResult,
      };
    }

    winningOptions = aiResult.winningOptions;
    actualScore = actualScore || aiResult.actualScore;
    explanation = explanation || aiResult.explanation;
  }

  const rewardPerWinner = Number(eventData.reward) || 100;

  // 查詢下注該賽事的所有玩家紀錄
  const userPredsSnapshot = await db
    .collection('userPredictions')
    .where('eventId', '==', eventId)
    .get();

  const totalPredictions = userPredsSnapshot.size;
  let winnersCount = 0;
  let totalPayout = 0;

  // 取得批次寫入物件
  // Firestore 單一 batch 上限 500 個 operation，分批處理
  const BATCH_SIZE = 450;
  const userPredDocs = userPredsSnapshot.docs;
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (let i = 0; i < userPredDocs.length; i += BATCH_SIZE) {
    const currentChunk = userPredDocs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const predDoc of currentChunk) {
      const pred = predDoc.data();
      const userChoice = pred.option;
      const isWinner = winningOptions.includes(userChoice);

      // 檢查是否已經派發過獎勵 (避免重複派發)
      const alreadySettledAsWinner = pred.status === 'settled' && pred.isWinner === true;

      if (isWinner) {
        winnersCount++;
        if (!alreadySettledAsWinner) {
          totalPayout += rewardPerWinner;

          // 1. 更新使用者 bonusPoints
          const userRef = db.collection('users').doc(pred.userId);
          batch.update(userRef, {
            bonusPoints: admin.firestore.FieldValue.increment(rewardPerWinner),
          });

          // 2. 寫入交易紀錄 transactions
          const txRef = db.collection('transactions').doc();
          batch.set(txRef, {
            userId: pred.userId,
            transactionType: 'Reward',
            section: 'predictions',
            currency: 'p-point',
            amount: rewardPerWinner,
            details: `賽事預測猜中派獎：【${eventData.matchName || ''}】預測「${userChoice}」勝出`,
            eventId,
            predictionId: predDoc.id,
            transactionDate: now,
            createdAt: now,
          });

          // 3. 更新 userPrediction 狀態為已結算中獎
          batch.update(predDoc.ref, {
            status: 'settled',
            isWinner: true,
            payoutAmount: rewardPerWinner,
            settledAt: now,
          });
        }
      } else {
        // 未中獎玩家
        batch.update(predDoc.ref, {
          status: 'settled',
          isWinner: false,
          payoutAmount: 0,
          settledAt: now,
        });
      }
    }

    await batch.commit();
  }

  // 更新主賽事狀態為已開獎 finished
  await eventRef.update({
    status: 'finished',
    winningOptions,
    winningOption: winningOptions.join(', '),
    actualScore: actualScore || '',
    settlementNote: explanation || '',
    settledAt: now,
    settledBy: options?.settledBy || 'admin',
    payoutSummary: {
      totalPredictions,
      winnersCount,
      totalPayout,
      rewardPerWinner,
    },
  });

  return {
    settled: true,
    eventId,
    matchName: eventData.matchName,
    winningOptions,
    actualScore,
    explanation,
    totalPredictions,
    winnersCount,
    totalPayout,
    rewardPerWinner,
  };
}

/**
 * 自動掃描所有已截止但未完賽之賽事，執行 AI 賽果檢索與自動派獎
 */
export async function autoSettlePendingPredictions() {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase Admin DB 尚未初始化');
  }

  const now = new Date();

  // 取得所有未完賽 (status != 'finished') 的賽事
  const snapshot = await db.collection('predictionEvents').get();
  const pendingEvents: any[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status !== 'finished') {
      const isPastEndTime = data.bettingEndTime && new Date(data.bettingEndTime) < now;
      if (isPastEndTime) {
        pendingEvents.push({ id: doc.id, ...data });
      }
    }
  });

  const results: any[] = [];
  let settledCount = 0;
  let totalPointsPaid = 0;

  for (const event of pendingEvents) {
    try {
      const settleRes = await settlePredictionEvent(event.id, {
        settledBy: 'cron-auto-settler',
      });
      results.push(settleRes);
      if (settleRes.settled) {
        settledCount++;
        totalPointsPaid += settleRes.totalPayout || 0;
      }
    } catch (err: any) {
      console.error(`自動結算賽事 ${event.id} (${event.matchName}) 發生異常:`, err);
      results.push({
        settled: false,
        eventId: event.id,
        matchName: event.matchName,
        error: err.message || String(err),
      });
    }
  }

  // 記錄最後結算時間於系統設定
  await db.collection('system_configs').doc('prediction_settlement').set(
    {
      lastSettledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSettledCount: settledCount,
      lastTotalPointsPaid: totalPointsPaid,
    },
    { merge: true }
  );

  return {
    scannedCount: pendingEvents.length,
    settledCount,
    totalPointsPaid,
    results,
  };
}
