import { GoogleGenAI, Modality } from "@google/genai";

// 安全获取环境变量
const getApiKey = (): string | undefined => {
  // 尝试多个可能的环境变量名
  const key = import.meta.env?.VITE_GEMINI_API_KEY 
    || import.meta.env?.GEMINI_API_KEY
    || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  
  return key;
};

// Helper: Base64 decode for raw PCM audio data
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a hair consultation response from Gemini.
 * Uses 'gemini-3-flash-preview' as recommended for basic text tasks.
 */
export const generateHairConsultation = async (
  query: string, 
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("[Gemini Service] API Key 未配置。请在 .env.local 文件中设置 GEMINI_API_KEY");
    return "AI 功能暂时不可用，请稍后重试或联系管理员配置 API 密钥。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3-flash-preview';
    const systemInstruction = "你是一位专业的发型设计顾问。请根据用户的描述推荐合适的发型。回答要简洁、专业，并富有亲和力。";

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: query });
    return result.text || "抱歉，我暂时无法回答这个问题。";

  } catch (error) {
    console.error("[Gemini Service] API Error:", error);
    return "网络连接似乎有点问题，请稍后再试。";
  }
};

/**
 * Generates speech (TTS) using the Gemini 2.5 Flash TTS model.
 * Returns raw PCM data as Uint8Array.
 */
export const generateSpeech = async (text: string): Promise<Uint8Array | null> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("[Gemini Service] API Key 未配置。TTS 功能不可用。请在 .env.local 文件中设置 GEMINI_API_KEY");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return decodeBase64(base64Audio);
    }
    return null;
  } catch (error) {
    console.error("[Gemini Service] TTS Error:", error);
    return null;
  }
};

/**
 * 检查 AI 服务是否可用
 */
export const isAIServiceAvailable = (): boolean => {
  return !!getApiKey();
};
