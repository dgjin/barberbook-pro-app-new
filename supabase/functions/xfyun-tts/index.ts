
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Private-Network': 'true',
}

/**
 * 生成 WAV 头部，使浏览器 decodeAudioData 能够正确识别
 */
function getWavHeader(numSamples: number, sampleRate: number = 16000) {
    const buf = new ArrayBuffer(44);
    const view = new DataView(buf);
    // RIFF identifier
    view.setUint32(0, 0x52494646, false);
    // file length
    view.setUint32(4, 36 + numSamples * 2, true);
    // WAVE identifier
    view.setUint32(8, 0x57415645, false);
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false);
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 is PCM)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false);
    // data chunk length
    view.setUint32(40, numSamples * 2, true);
    return new Uint8Array(buf);
}

Deno.serve(async (req: Request) => {
    // 1. 处理 CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 处理 Ping
        const body = await req.json().catch(() => ({}));
        if (body.ping) {
            return new Response(JSON.stringify({ status: 'ok' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { text, vcn = 'aisxue', speed = 50, volume = 80, pitch = 50 } = body;
        if (!text) {
            return new Response(JSON.stringify({ error: 'Missing text' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Xfyun Config
        const APPID = Deno.env.get('XFYUN_APPID') || '8cc61805';
        const API_KEY = Deno.env.get('XFYUN_API_KEY') || 'ffed16b33a183c42c3b989d5306f0d75';
        const API_SECRET = Deno.env.get('XFYUN_API_SECRET') || 'MjU5OTkzOWMyN2ZiNDhlMDNkNjdjMDli';

        const url = new URL('wss://tts-api.xfyun.cn/v2/tts');
        const host = url.host;
        const date = new Date().toUTCString();
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;

        // Auth Signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(API_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureOrigin));
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

        const authHeader = btoa(`api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`);
        const wsUrl = `wss://${host}/v2/tts?authorization=${authHeader}&date=${encodeURIComponent(date)}&host=${host}`;

        // WebSocket logic wrapped in Promise
        return new Promise((resolve) => {
            const ws = new WebSocket(wsUrl);
            const audioChunks: Uint8Array[] = [];
            let isResolved = false;

            const timeout = setTimeout(() => {
                if (!isResolved) {
                    ws.close();
                    resolve(new Response(JSON.stringify({ error: 'Xfyun timeout' }), {
                        status: 504,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }));
                }
            }, 15000);

            ws.onopen = () => {
                console.log('Xfyun WS: Connected, sending request...');
                // 正确处理 UTF-8 字符串到 Base64 的转换，防止中文报错
                const textBase64 = btoa(Array.from(encoder.encode(text)).map(b => String.fromCharCode(b)).join(''));

                ws.send(JSON.stringify({
                    common: { app_id: APPID },
                    business: {
                        aue: 'raw',
                        auf: 'audio/L16;rate=16000',
                        vcn,
                        speed,
                        volume,
                        pitch,
                        bgs: 0,
                        tte: 'UTF8',
                        ent: 'intp65' // 增强拟人化表达
                    },
                    data: { status: 2, text: textBase64 }
                }));
            };

            ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.code !== 0) {
                    ws.close();
                    resolve(new Response(JSON.stringify({ error: data.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }));
                    return;
                }

                if (data.data?.audio) {
                    const raw = atob(data.data.audio);
                    const buf = new Uint8Array(raw.length);
                    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
                    audioChunks.push(buf);
                }

                if (data.data?.status === 2) {
                    ws.close();
                    isResolved = true;
                    clearTimeout(timeout);

                    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const header = getWavHeader(totalLength / 2);
                    const merged = new Uint8Array(header.length + totalLength);
                    merged.set(header, 0);
                    let offset = header.length;
                    for (const chunk of audioChunks) {
                        merged.set(chunk, offset);
                        offset += chunk.length;
                    }

                    // Convert to base64
                    let binary = '';
                    for (let i = 0; i < merged.byteLength; i++) {
                        binary += String.fromCharCode(merged[i]);
                    }

                    resolve(new Response(JSON.stringify({ audio: btoa(binary) }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }));
                }
            };

            ws.onerror = (err) => {
                resolve(new Response(JSON.stringify({ error: 'WS Error' }), {
                    status: 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }));
            };
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
