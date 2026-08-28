import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { 
      prompt, 
      title = '', 
      category = '', 
      type = 'card-pool', // 'card-pool' | 'news-banner' | 'category' | 'general'
      style = 'cinematic', 
      aspectRatio = '16:9', // '16:9' | '4:3' | '3:4' | '1:1' | '9:16'
      enhancePrompt = true
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器未配置 GEMINI_API_KEY 環境變數' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    let finalPrompt = prompt || title;

    // 如果使用者只輸入簡短文字或勾選了 AI 擴寫潤飾，先用 gemini-3.7-flash 將 prompt 轉化為極致質感的生圖指令
    if (enhancePrompt && finalPrompt) {
      try {
        const enhancerPrompt = `You are a world-class prompt engineer for AI image generators (like Imagen / Gemini Image Generation).
The user wants an image for a premium sports trading card & mystery box platform (P-Carder).
Context Type: ${type}
Target Title/Topic: ${title}
Category: ${category}
User Notes: ${prompt}
Style Preference: ${style} (e.g. Cinematic, Photorealistic Luxury, Holographic Laser, Cyberpunk Neon, Anime Fantasy, etc.)

TASK:
Write a single, vivid, high-impact English prompt (under 120 words) for the image generator.
Focus on:
- Subject: Ultra-detailed subject (e.g. pristine luxury sports card packs, sparkling championship trophies, glowing stadium lights, dynamic action posing, metallic foil textures).
- Lighting & Atmosphere: Dramatic volumetric lighting, neon glow, gold particle sparks, cinematic lens flare, 8k resolution, photorealistic studio lighting.
- NO text, letters, or spelling inside the image. Clean, professional composition suitable for a ${aspectRatio} banner or cover.

Output ONLY the prompt text in English, no introductory or concluding remarks.`;

        const enhancementRes = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: enhancerPrompt,
        });

        const enhancedText = enhancementRes.text?.trim();
        if (enhancedText) {
          finalPrompt = enhancedText;
        }
      } catch (enhanceErr) {
        console.warn('Prompt enhancement fallback to original:', enhanceErr);
      }
    }

    // 呼叫生圖模型
    // 優先使用 gemini-3.1-flash-lite-image
    try {
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
          },
        },
      });

      const parts = imageResponse.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ('inlineData' in part && part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
          return NextResponse.json({
            success: true,
            imageUrl,
            usedPrompt: finalPrompt,
          });
        }
      }
    } catch (liteErr: any) {
      console.warn('gemini-3.1-flash-lite-image failed, trying fallback model:', liteErr?.message);
      
      // 嘗試備援模型 imagen-3.0-generate-002
      try {
        const imagenResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio) ? aspectRatio : '16:9') as any,
            outputMimeType: 'image/jpeg',
          },
        });

        const generatedImage = imagenResponse.generatedImages?.[0];
        if (generatedImage?.image?.imageBytes) {
          const imageUrl = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
          return NextResponse.json({
            success: true,
            imageUrl,
            usedPrompt: finalPrompt,
          });
        }
      } catch (imagenErr: any) {
        console.error('All image generation models failed:', imagenErr);
        throw imagenErr;
      }
    }

    return NextResponse.json(
      { error: '模型未能產出有效圖片，請嘗試修改關鍵字後重試' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('AI Image Generation API Error:', error);
    return NextResponse.json(
      { error: error?.message || '生成圖片時發生錯誤，請檢查 API Key 或網路狀態' },
      { status: 500 }
    );
  }
}
