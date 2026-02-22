/// <reference types="vite/client" />

/**
 * 环境变量类型声明
 * 确保 TypeScript 能够识别 Vite 的环境变量
 */

interface ImportMetaEnv {
  /** Google Gemini API Key - 用于 AI 对话和 TTS */
  readonly VITE_GEMINI_API_KEY: string
  
  /** Supabase 项目 URL */
  readonly VITE_SUPABASE_URL: string
  
  /** Supabase 匿名密钥 */
  readonly VITE_SUPABASE_ANON_KEY: string
  
  /** 科大讯飞 App ID */
  readonly VITE_XFYUN_APPID: string
  
  /** 科大讯飞 API Key */
  readonly VITE_XFYUN_API_KEY: string
  
  /** 科大讯飞 API Secret */
  readonly VITE_XFYUN_API_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 扩展 process.env 类型
declare namespace NodeJS {
  interface ProcessEnv {
    /** Google Gemini API Key */
    GEMINI_API_KEY?: string
    
    /** Supabase 项目 URL */
    SUPABASE_URL?: string
    
    /** Supabase 匿名密钥 */
    SUPABASE_ANON_KEY?: string
  }
}
