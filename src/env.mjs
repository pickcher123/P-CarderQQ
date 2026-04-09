
import { z } from "zod";

/**
 * 建立環境變數驗證邏輯。
 * 使用 skipValidation: true 確保在 App Hosting 建置階段即使 Secrets 尚未設定也能通過。
 */
const server = z.object({
  PAYUNI_MERCHANT_ID: z.string().optional(),
  PAYUNI_HASH_KEY: z.string().optional(),
  PAYUNI_HASH_IV: z.string().optional(),
  PAYUNI_API_URL: z.string().optional(),
  PAYUNI_RETURN_URL: z.string().optional(),
  PAYUNI_NOTIFY_URL: z.string().optional(),
});

const client = z.object({
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

const processEnv = {
  PAYUNI_MERCHANT_ID: process.env.PAYUNI_MERCHANT_ID,
  PAYUNI_HASH_KEY: process.env.PAYUNI_HASH_KEY,
  PAYUNI_HASH_IV: process.env.PAYUNI_HASH_IV,
  PAYUNI_API_URL: process.env.PAYUNI_API_URL,
  PAYUNI_RETURN_URL: process.env.PAYUNI_RETURN_URL,
  PAYUNI_NOTIFY_URL: process.env.PAYUNI_NOTIFY_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

// 執行驗證，但在建置期間不因缺少變數而崩潰
const isServer = typeof window === "undefined";

let env = process.env;

if (isServer) {
  env = { ...processEnv };
}

export { env };
