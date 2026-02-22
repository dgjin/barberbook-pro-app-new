import { supabase } from './supabase';

/**
 * 通过 Supabase Edge Function 代理调用讯飞 TTS
 * 解决生产环境下浏览器 WebSocket 被拦截或签名计算不安全的问题
 */
export async function generateXfyunSpeech(text: string, vcn?: string): Promise<Uint8Array | null> {
    try {
        const functionUrl = '/api/xfyun-tts';

        console.log(`Xfyun TTS: [${vcn || 'default'}] 通过本地代理发起请求 -> ${functionUrl}`);

        // 调用本地 Vite 代理，由 Node.js 服务端转发请求到 Supabase
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, vcn })
        }).catch(err => {
            console.error('Fetch 网络层错误:', err);
            // 特别针对国内环境的提示
            throw new Error(`网络连接失败。如果您在中国境内，请检查是否开启了代理(VPN)或代理配置是否正确。详情: ${err.message}`);
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Edge Function 业务逻辑错误:', response.status, errorData);
            throw new Error(`云端合成报错 (${response.status}): ${errorData.error || '未知错误'}`);
        }

        const data = await response.json();
        console.log('Xfyun TTS: 响应解析成功');

        if (data && data.audio) {
            console.log('Xfyun TTS: 收到数据，正在进行 Base64 解码...');
            const binaryString = atob(data.audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        }

        console.error('Xfyun TTS: 返回的 JSON 中缺少 audio 字段:', data);
        return null;
    } catch (err: any) {
        console.error('TTS 链路异常:', err);
        throw err;
    }
}
