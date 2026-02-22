import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { supabase } from '../services/supabase';
import { Barber, Appointment, PageRoute, User } from '../types';
import { generateXfyunSpeech } from '../services/xfyunService';

// --- Sub-components (Memoized for Performance) ---

const StatItem = memo(({ icon, label, value, unit, colorClass }: { icon: string, label: string, value: string | number, unit?: string, colorClass: string }) => (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
            <p className="text-3xl font-bold">{value}{unit && <span className="text-sm ml-1 opacity-50">{unit}</span>}</p>
        </div>
    </div>
));

const BarberCard = memo(({ barber, queue }: { barber: Barber, queue: Appointment[] }) => {
    // 获取所有已签到的顾客，按签到时间排序
    const checkedInCustomers = queue
        .filter(a => a.status === 'checked_in')
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    
    // 第一个签到的顾客为正在服务，其余为等待中
    const currentCustomer = checkedInCustomers.length > 0 ? checkedInCustomers[0] : null;
    const waitingCheckedInCustomers = checkedInCustomers.slice(1);
    
    // 等待序列：其他已签到的顾客（按签到顺序）+ 已确认/待处理的预约
    const waitingList = [
        ...waitingCheckedInCustomers,
        ...queue.filter(a => a.status === 'confirmed' || a.status === 'pending')
    ];

    return (
        <div className="bg-slate-800/80 rounded-3xl border border-slate-700 overflow-hidden flex flex-col h-[340px] transition-all hover:border-primary shadow-xl group transform-gpu">
            <div className="p-5 flex items-start gap-4 bg-slate-800/40">
                <img src={barber.image} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-600" alt={barber.name} />
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{barber.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{barber.title}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${currentCustomer ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                    {currentCustomer ? '正在服务' : '空闲'}
                </span>
            </div>

            <div className="flex-1 p-5 flex flex-col">
                {currentCustomer ? (
                    <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700 mb-4 animate-fade-in">
                        <p className="text-[9px] text-primary font-bold uppercase mb-2">正在剪裁</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xl font-bold text-white">{currentCustomer.customer_name}</p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">单号: #{currentCustomer.id}</p>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">{currentCustomer.time_str}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl mb-4 text-slate-600">
                        <span className="material-symbols-outlined text-2xl mb-1">chair</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">等候接单</span>
                    </div>
                )}

                <div className="mt-auto space-y-2">
                    <p className="text-[9px] text-slate-500 font-bold uppercase px-1">等待序列 ({waitingList.length})</p>
                    {waitingList.slice(0, 2).map((w, idx) => (
                        <div key={w.id} className="flex items-center justify-between bg-slate-900/30 p-2.5 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                                <span className="text-sm font-bold">{w.customer_name}</span>
                            </div>
                            <span className="text-[10px] font-mono opacity-40">{w.time_str}</span>
                        </div>
                    ))}
                    {waitingList.length === 0 && <p className="text-[10px] text-slate-700 text-center py-2 italic font-bold tracking-widest uppercase opacity-40">暂无预约</p>}
                </div>
            </div>
        </div>
    );
});

const LogFeed = memo(({ logs }: { logs: string[] }) => (
    <div className="flex-1 bg-slate-800/80 rounded-3xl p-6 flex flex-col overflow-hidden relative border border-slate-700/50 shadow-2xl">
        <h3 className="text-xs font-black text-slate-400 mb-5 flex items-center gap-2 uppercase tracking-widest">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            实时动态 / LIVE FEED
        </h3>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar transform-gpu">
            {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 text-[11px] animate-fade-in-left ${i === 0 ? 'text-white' : 'text-slate-500'}`}>
                    <span className="opacity-30 flex-none font-mono tracking-tighter">[{logs.length - i}]</span>
                    <p className="leading-relaxed font-medium">{log}</p>
                </div>
            ))}
        </div>
    </div>
));

// --- Main Components ---

interface Props {
    onNavigate: (route: PageRoute) => void;
    currentUser?: User | null;
}

export const WebMonitor: React.FC<Props> = ({ onNavigate, currentUser }) => {
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [recentLogs, setRecentLogs] = useState<string[]>([]);
    const [stats, setStats] = useState({ servedToday: 0, totalWaiting: 0, avgWaitTime: 0 });

    // 语音播报核心状态
    const [audioEnabled, setAudioEnabled] = useState(false);
    const audioEnabledRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const channelRef = useRef<any>(null);

    // 使用 ref 存储所有播报相关状态，避免闭包问题
    const announcedIdsRef = useRef<Set<number>>(new Set());
    const pendingQueueRef = useRef<Record<string, Appointment[]>>({});
    const currentServingRef = useRef<Record<string, Appointment>>({});
    const globalQueueRef = useRef<Array<{ barberName: string; appt: Appointment; source: string }>>([]);
    const isProcessingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const xfyunAvailableRef = useRef(true); // 讯飞API是否可用
    
    // 播报次数记录：key为appointmentId，value为已播报次数
    const announceCountRef = useRef<Record<number, number>>({});
    const ANNOUNCE_MAX_COUNT = 3; // 默认播报3次
    const ANNOUNCE_INTERVAL = 60000; // 间隔60秒
    
    // 科大讯飞发音人配置 - 聆小旋（大气宣传片风格女声）
    const XFYUN_VCN = 'xiaoxuan'; // 聆小旋

    // 从 sessionStorage 恢复已播报记录
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('announcedIds');
            if (saved) {
                const ids = JSON.parse(saved);
                ids.forEach((id: number) => announcedIdsRef.current.add(id));
                console.log('[Init] 从 sessionStorage 恢复已播报记录:', ids.length, '条');
            }
        } catch (e) {
            console.error('[Init] 恢复已播报记录失败:', e);
        }
    }, []);

    const getTodayString = () => {
        const d = new Date();
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    };

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRecentLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
    };

    // 初始化音频上下文
    const initAudioContext = async () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    // 浏览器原生 TTS 降级
    const speakWithNativeTTS = (text: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) {
                resolve();
                return;
            }

            addLog(`📢 浏览器播报: ${text.slice(0, 20)}...`);
            
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                
                utterance.onend = () => {
                    setIsPlaying(false);
                    addLog('✓ 浏览器播报完成');
                    resolve();
                };
                
                utterance.onerror = (e) => {
                    console.error('[TTS] 浏览器播报错误:', e);
                    setIsPlaying(false);
                    resolve();
                };

                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.error('[TTS] 浏览器播报异常:', e);
                setIsPlaying(false);
                resolve();
            }
        });
    };

    // 语音播报函数 - 优先使用科大讯飞，失败时降级到浏览器原生TTS
    const speak = async (text: string): Promise<void> => {
        if (!audioEnabledRef.current) {
            console.log('[TTS] Audio not enabled, skipping:', text);
            return;
        }

        setIsPlaying(true);

        // 如果讯飞API之前失败过，直接降级
        if (!xfyunAvailableRef.current) {
            addLog('📢 讯飞不可用，使用浏览器播报');
            await speakWithNativeTTS(text);
            return;
        }

        try {
            addLog(`📢 讯飞播报: ${text.slice(0, 20)}...`);
            
            // 调用科大讯飞TTS
            const audioData = await generateXfyunSpeech(text, XFYUN_VCN);
            
            if (!audioData || !audioContextRef.current) {
                throw new Error('No audio data received');
            }

            // 解码并播放音频
            const decodedBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(audioContextRef.current.destination);
            
            await new Promise<void>((resolvePlay) => {
                source.onended = () => {
                    setIsPlaying(false);
                    addLog('✓ 讯飞播报完成');
                    resolvePlay();
                };
                
                source.onerror = () => {
                    setIsPlaying(false);
                    resolvePlay();
                };
                
                source.start(0);
            });
            
        } catch (err: any) {
            console.error('[TTS] 讯飞播报失败:', err);
            addLog(`⚠ 讯飞失败，降级到浏览器播报`);
            
            // 标记讯飞API不可用
            xfyunAvailableRef.current = false;
            
            // 降级到浏览器原生TTS
            await speakWithNativeTTS(text);
        }
    };

    // 处理全局队列
    const processQueue = async () => {
        if (isProcessingRef.current) {
            console.log('[Queue] Already processing, waiting...');
            return;
        }

        const item = globalQueueRef.current.shift();
        if (!item) {
            console.log('[Queue] Queue is empty');
            return;
        }

        isProcessingRef.current = true;
        const { barberName, appt, source } = item;
        const apptId = appt.id!;

        console.log('[Queue] Processing:', appt.customer_name, 'Source:', source);

        try {
            // 获取当前播报次数
            const currentCount = announceCountRef.current[apptId] || 0;
            
            if (currentCount < ANNOUNCE_MAX_COUNT) {
                const sourceLabel = source === 'idle_checkin' ? '空闲叫号' : source === 'complete' ? '完成播报' : '呼叫下一位';
                const countLabel = currentCount > 0 ? ` (第${currentCount + 1}次)` : '';
                addLog(`[${sourceLabel}] ${appt.customer_name} (${barberName})${countLabel}`);
                
                await speak(`您好，请 ${apptId % 1000} 号顾客 ${appt.customer_name}，到理发师 ${appt.barber_name} 处准备理发，祝您理发愉快。`);
                
                // 增加播报次数
                announceCountRef.current[apptId] = currentCount + 1;
                
                // 如果还没播报到3次，重新加入队列等待下次播报
                if (announceCountRef.current[apptId] < ANNOUNCE_MAX_COUNT) {
                    globalQueueRef.current.push({ barberName, appt, source: 'repeat' });
                    addLog(`[重复播报] ${appt.customer_name} 将在 ${ANNOUNCE_INTERVAL / 1000} 秒后再次播报 (${announceCountRef.current[apptId]}/${ANNOUNCE_MAX_COUNT})`);
                } else {
                    // 播报到3次，标记为已播报完成
                    announcedIdsRef.current.add(apptId);
                    addLog(`[播报完成] ${appt.customer_name} 已播报 ${ANNOUNCE_MAX_COUNT} 次`);
                    
                    // 保存到 sessionStorage
                    try {
                        sessionStorage.setItem('announcedIds', JSON.stringify([...announcedIdsRef.current]));
                    } catch (e) {
                        console.error('[Queue] 保存已播报记录失败:', e);
                    }
                }
            } else {
                addLog(`[跳过] ${appt.customer_name} 已播报过 ${ANNOUNCE_MAX_COUNT} 次`);
            }
        } catch (e) {
            console.error('[Queue] Error processing item:', e);
            addLog(`[错误] 播报失败: ${appt.customer_name}`);
        } finally {
            isProcessingRef.current = false;
        }

        // 如果队列还有内容，延迟后继续处理（重复播报间隔60秒，其他情况间隔800ms）
        if (globalQueueRef.current.length > 0) {
            const nextItem = globalQueueRef.current[0];
            const isRepeat = nextItem.source === 'repeat';
            const delay = isRepeat ? ANNOUNCE_INTERVAL : 800;
            if (isRepeat) {
                addLog(`[等待] ${delay / 1000} 秒后进行下一次播报...`);
            }
            setTimeout(processQueue, delay);
        }
    };

    // 添加到全局队列
    const addToQueue = (barberName: string, appt: Appointment, source: string, forceRepeat: boolean = false, singleAnnounce: boolean = false) => {
        console.log('[Queue] Adding:', appt.customer_name, 'Source:', source, 'AudioEnabled:', audioEnabledRef.current, 'ForceRepeat:', forceRepeat, 'SingleAnnounce:', singleAnnounce);
        
        const apptId = appt.id!;
        
        // 如果是强制重新播报，重置播报次数和状态，并允许重新加入队列
        if (forceRepeat) {
            if (singleAnnounce) {
                // 单次播报模式：设置为已播报2次，这样播报一次后就会停止
                announceCountRef.current[apptId] = ANNOUNCE_MAX_COUNT - 1;
                announcedIdsRef.current.delete(apptId);
                addLog(`[重新播报] ${appt.customer_name} 单次播报模式`);
            } else {
                // 完整重新播报模式：重置为0，播报3次
                announceCountRef.current[apptId] = 0;
                announcedIdsRef.current.delete(apptId);
                addLog(`[重新播报] ${appt.customer_name} 重置播报次数`);
            }
            
            // 检查是否已在队列中，如果在则移除（以便重新加入）
            const existingIndex = globalQueueRef.current.findIndex(item => item.appt.id === apptId);
            if (existingIndex !== -1) {
                globalQueueRef.current.splice(existingIndex, 1);
                addLog(`[重新播报] ${appt.customer_name} 从原队列中移除`);
            }
        } else {
            // 非强制重新播报时，检查是否已在队列中
            const exists = globalQueueRef.current.some(item => item.appt.id === apptId);
            if (exists) {
                addLog(`[重复] ${appt.customer_name} 已在全局队列中`);
                return;
            }

            if (announcedIdsRef.current.has(apptId)) {
                addLog(`[重复] ${appt.customer_name} 已播报过 ${ANNOUNCE_MAX_COUNT} 次`);
                return;
            }
        }

        globalQueueRef.current.push({ barberName, appt, source });
        addLog(`[加入队列] ${appt.customer_name} (${barberName}) - 队列长度: ${globalQueueRef.current.length}`);
        
        // 触发处理（如果语音已启用）
        if (audioEnabledRef.current) {
            processQueue();
        } else {
            addLog(`[等待] 语音系统未启用，已加入队列等待`);
        }
    };

    // 从数据库获取理发师的下一个待服务顾客
    const fetchNextCustomerFromDB = async (barberName: string): Promise<Appointment | null> => {
        try {
            const todayStr = getTodayString();
            const { data, error } = await supabase
                .from('app_appointments')
                .select('*')
                .eq('barber_name', barberName)
                .eq('date_str', todayStr)
                .eq('status', 'checked_in')
                .order('created_at', { ascending: true })
                .limit(1);
            
            if (error) {
                console.error('[fetchNextCustomerFromDB] 数据库错误:', error);
                return null;
            }
            
            if (data && data.length > 0) {
                const appt = data[0] as Appointment;
                // 检查是否已经被播报过
                if (!announcedIdsRef.current.has(appt.id!)) {
                    console.log('[fetchNextCustomerFromDB] 从数据库获取到下一位:', appt.customer_name);
                    return appt;
                }
            }
            return null;
        } catch (e) {
            console.error('[fetchNextCustomerFromDB] 异常:', e);
            return null;
        }
    };

    // 处理理发师的待播报队列
    const processBarberQueue = async (barberName: string, source: 'complete' | 'call_next' = 'complete') => {
        console.log('[processBarberQueue] 处理队列:', barberName, 'source:', source);
        const queue = pendingQueueRef.current[barberName];
        console.log('[processBarberQueue] 当前内存队列:', queue);
        
        let nextAppt: Appointment | null = null;
        
        // 首先尝试从内存队列获取
        if (queue && queue.length > 0) {
            nextAppt = queue.shift() || null;
            console.log('[processBarberQueue] 从内存队列取出:', nextAppt?.customer_name);
        }
        
        // 如果内存队列为空，从数据库获取
        if (!nextAppt) {
            console.log('[processBarberQueue] 内存队列为空，尝试从数据库获取');
            nextAppt = await fetchNextCustomerFromDB(barberName);
        }
        
        if (nextAppt) {
            // 设置为当前服务
            currentServingRef.current[barberName] = nextAppt;
            addLog(`[叫号] ${barberName} 开始为 ${nextAppt.customer_name} 服务`);
            addToQueue(barberName, nextAppt, source);
        } else {
            addLog(`[空闲] ${barberName} 暂无待服务顾客`);
            console.log('[processBarberQueue] 没有待服务顾客');
        }
    };

    // 添加到理发师私有队列
    const addToPendingQueue = (appt: Appointment) => {
        const barberName = appt.barber_name;
        if (!pendingQueueRef.current[barberName]) {
            pendingQueueRef.current[barberName] = [];
        }

        const exists = pendingQueueRef.current[barberName].some(a => a.id === appt.id);
        if (!exists && !announcedIdsRef.current.has(appt.id)) {
            pendingQueueRef.current[barberName].push(appt);
            addLog(`[加入私有队列] ${appt.customer_name} → ${barberName} (${pendingQueueRef.current[barberName].length}人待叫号)`);
        }
    };

    // 获取监控数据并处理播报（轮询模式用）
    const fetchMonitorData = async (isPolling = false) => {
        try {
            const { data: barberData } = await supabase.from('app_barbers').select('*').order('id');
            if (barberData) setBarbers(barberData as unknown as Barber[]);

            const todayStr = getTodayString();
            const { data: apptData } = await supabase
                .from('app_appointments')
                .select('*')
                .eq('date_str', todayStr)
                .in('status', ['confirmed', 'pending', 'checked_in', 'completed'])
                .order('time_str', { ascending: true });

            if (apptData) {
                const activeAppts = apptData.filter((a: any) => a.status !== 'completed' && a.status !== 'cancelled');
                const completed = apptData.filter((a: any) => a.status === 'completed');
                setAppointments(activeAppts as Appointment[]);
                setStats({
                    servedToday: completed.length,
                    totalWaiting: activeAppts.length,
                    avgWaitTime: activeAppts.length * 15
                });

                // 轮询模式：检查是否有新的签到需要播报
                if (isPolling) {
                    const checkedInAppts = activeAppts.filter((a: any) => a.status === 'checked_in');
                    
                    // 按理发师分组，找出每个理发师第一个签到的顾客
                    const barberFirstCheckIn: Record<string, any> = {};
                    checkedInAppts.forEach((appt: any) => {
                        const barberName = appt.barber_name;
                        if (!barberFirstCheckIn[barberName]) {
                            barberFirstCheckIn[barberName] = appt;
                        } else {
                            // 比较创建时间，保留最早的签到
                            const existingTime = new Date(barberFirstCheckIn[barberName].created_at || 0).getTime();
                            const newTime = new Date(appt.created_at || 0).getTime();
                            if (newTime < existingTime) {
                                barberFirstCheckIn[barberName] = appt;
                            }
                        }
                    });
                    
                    // 更新当前服务状态（只更新第一个签到的）
                    Object.entries(barberFirstCheckIn).forEach(([barberName, appt]) => {
                        if (!currentServingRef.current[barberName] && !announcedIdsRef.current.has(appt.id)) {
                            currentServingRef.current[barberName] = appt;
                        }
                    });

                    // 找出未播报的签到
                    checkedInAppts.forEach((appt: any) => {
                        if (!announcedIdsRef.current.has(appt.id)) {
                            const barberName = appt.barber_name;
                            // 检查是否已加入队列
                            const inGlobalQueue = globalQueueRef.current.some(item => item.appt.id === appt.id);
                            const inPendingQueue = pendingQueueRef.current[barberName]?.some((a: any) => a.id === appt.id);
                            
                            if (!inGlobalQueue && !inPendingQueue) {
                                // 判断是否是该理发师的第一个签到顾客
                                const isFirstCheckIn = barberFirstCheckIn[barberName]?.id === appt.id;
                                
                                if (isFirstCheckIn) {
                                    addLog(`[轮询发现空闲叫号] ${barberName} - ${appt.customer_name}`);
                                    addToQueue(barberName, appt, 'idle_checkin');
                                } else {
                                    addLog(`[轮询发现排队] ${barberName} - ${appt.customer_name}`);
                                    if (!pendingQueueRef.current[barberName]) {
                                        pendingQueueRef.current[barberName] = [];
                                    }
                                    pendingQueueRef.current[barberName].push(appt);
                                }
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.error("WebMonitor Fetch Error", e);
        }
    };

    // 初始化音频
    const initAudio = async () => {
        try {
            // 初始化音频上下文
            await initAudioContext();
            
            addLog('🎙 正在测试讯飞语音合成...');
            
            // 测试讯飞TTS
            const testAudio = await generateXfyunSpeech('语音系统已就绪，聆小旋为您服务', XFYUN_VCN);
            
            if (testAudio && audioContextRef.current) {
                const decodedBuffer = await audioContextRef.current.decodeAudioData(testAudio.buffer);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = decodedBuffer;
                source.connect(audioContextRef.current.destination);
                source.start(0);
                addLog('✓ 讯飞语音测试成功');
                xfyunAvailableRef.current = true;
            }
            
            setAudioEnabled(true);
            audioEnabledRef.current = true;
            addLog(`✓ 语音系统开启成功 [发音人: 聆小旋]`);
        } catch (e: any) {
            console.error("Audio init failed:", e);
            addLog(`⚠ 讯飞语音测试失败，将使用浏览器语音`);
            
            // 标记讯飞不可用，使用浏览器TTS
            xfyunAvailableRef.current = false;
            
            // 测试浏览器TTS
            await speakWithNativeTTS('语音系统已就绪，使用浏览器语音合成');
            
            setAudioEnabled(true);
            audioEnabledRef.current = true;
            addLog(`✓ 语音系统开启成功 [浏览器语音]`);
        }
    };

    // 切换音频状态
    const toggleAudio = async () => {
        if (!audioEnabledRef.current) {
            await initAudio();
        } else {
            setAudioEnabled(false);
            audioEnabledRef.current = false;
            if (audioContextRef.current) {
                audioContextRef.current.suspend();
            }
            addLog("语音系统已关闭");
        }
    };

    // 主 effect - 设置实时订阅和广播监听
    useEffect(() => {
        fetchMonitorData();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        const polling = setInterval(() => fetchMonitorData(true), 5000);

        // 设置 Supabase 实时订阅
        const channel = supabase.channel('web_monitor_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_appointments' }, (payload) => {
                fetchMonitorData();
                const newRec = payload.new as Appointment;
                const oldRec = payload.old as Appointment;

                console.log('[Realtime] Status change:', oldRec.status, '->', newRec.status);

                // 顾客签到
                if (newRec.status === 'checked_in' && oldRec.status !== 'checked_in') {
                    console.log('[Realtime] 顾客签到:', newRec.customer_name, '理发师:', newRec.barber_name);
                    
                    const barberName = newRec.barber_name;
                    
                    // 检查该顾客是否已经在队列中（防止重复处理）
                    const isAlreadyInQueue = pendingQueueRef.current[barberName]?.some(a => a.id === newRec.id);
                    const isAlreadyAnnounced = announcedIdsRef.current.has(newRec.id);
                    const isInGlobalQueue = globalQueueRef.current.some(item => item.appt.id === newRec.id);
                    
                    if (isAlreadyAnnounced || isInGlobalQueue) {
                        addLog(`[跳过] ${newRec.customer_name} 已处理过`);
                        return;
                    }
                    
                    // 判断理发师是否正在服务
                    const isBarberIdle = !currentServingRef.current[barberName];
                    console.log('[Realtime] 理发师状态:', barberName, isBarberIdle ? '空闲' : '忙碌');
                    
                    // 如果理发师空闲，立即开始服务并播报（不加入私有队列）
                    if (isBarberIdle) {
                        currentServingRef.current[barberName] = newRec;
                        addLog(`[开始服务] ${barberName} 正在为 ${newRec.customer_name} 服务`);
                        addLog(`[空闲叫号] ${barberName} 空闲，立即播报 ${newRec.customer_name}`);
                        addToQueue(barberName, newRec, 'idle_checkin');
                    } else if (!isAlreadyInQueue) {
                        // 理发师忙碌，且顾客不在队列中，加入等待队列
                        if (!pendingQueueRef.current[barberName]) {
                            pendingQueueRef.current[barberName] = [];
                        }
                        pendingQueueRef.current[barberName].push(newRec);
                        addLog(`[排队等待] ${barberName} 忙碌，${newRec.customer_name} 进入待服务序列 (${pendingQueueRef.current[barberName].length}人等待)`);
                    }
                }
                
                // 理发师完成服务
                if (newRec.status === 'completed' && oldRec.status !== 'completed') {
                    const barberName = newRec.barber_name;
                    addLog(`[服务完成] ${barberName} 完成 ${newRec.customer_name} 的服务`);
                    console.log('[Realtime] 服务完成:', barberName);
                    
                    // 从当前服务中移除
                    if (currentServingRef.current[barberName]?.id === newRec.id) {
                        delete currentServingRef.current[barberName];
                        console.log('[Realtime] 已从当前服务中移除:', barberName);
                    }
                    
                    // 延迟2秒后，从待服务队列中叫下一位
                    setTimeout(() => {
                        console.log('[Realtime] 延迟后呼叫下一位:', barberName);
                        processBarberQueue(barberName, 'complete');
                    }, 2000);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    addLog("✓ 实时数据通道已连接");
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    addLog("⚠ 实时通道异常，使用轮询模式");
                }
            });
        
        channelRef.current = channel;

        // 设置广播监听
        const broadcastChannel = new BroadcastChannel('barberbook_call_next');
        broadcastChannel.onmessage = async (event) => {
            const { barberName, action, appointment } = event.data || {};
            console.log('[Broadcast] 收到广播:', barberName, action, event.data);
            
            if (!barberName) return;
            
            if (action === 'repeat' && appointment) {
                // 重新播报当前顾客（仅播报一次）
                addLog(`[广播] ${barberName} 重新播报 ${appointment.customer_name}（单次）`);
                addToQueue(barberName, appointment, 'repeat', true, true);
            } else {
                // 呼叫下一位
                addLog(`[广播] ${barberName} 呼叫下一位`);
                processBarberQueue(barberName, 'call_next');
            }
        };

        return () => {
            clearInterval(timer);
            clearInterval(polling);
            broadcastChannel.close();
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const barberQueues = useMemo(() => {
        const queues: Record<string, Appointment[]> = {};
        barbers.forEach(b => {
            queues[b.name] = appointments.filter(a => a.barber_name === b.name);
        });
        return queues;
    }, [barbers, appointments]);

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden flex flex-col">
            {/* Header */}
            <header className="flex-none h-20 bg-slate-950/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
                        <div className="absolute inset-0 barber-pole-bg animate-barber-scroll opacity-40"></div>
                        <span className="material-symbols-outlined text-2xl text-white relative z-10">content_cut</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">BarberBook Pro <span className="text-primary">Monitor</span></h1>
                        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
                            {audioEnabled ? '系统语音引擎已开启' : '实时服务叫号系统'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">

                    <div className="flex items-center gap-8">
                        <button
                            onClick={toggleAudio}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all ${audioEnabled
                                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(0,122,255,0.4)]'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {isPlaying ? (
                                <div className="flex gap-1 items-center h-4">
                                    <span className="w-1 h-3 bg-primary animate-pulse"></span>
                                    <span className="w-1 h-5 bg-primary animate-pulse delay-75"></span>
                                    <span className="w-1 h-3 bg-primary animate-pulse delay-150"></span>
                                </div>
                            ) : (
                                <span className="material-symbols-outlined text-lg">{audioEnabled ? 'record_voice_over' : 'voice_over_off'}</span>
                            )}
                            <span className="text-sm font-bold">{audioEnabled ? '系统播报中' : '点击开启系统叫号'}</span>
                        </button>


                        <div className="text-right">
                            <p className="text-3xl font-mono font-bold leading-none">{currentTime.toLocaleTimeString([], { hour12: false })}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{currentTime.toLocaleDateString()}</p>
                        </div>
                        <button
                            onClick={() => {
                                if (currentUser?.role === 'barber') {
                                    onNavigate('admin_workbench');
                                } else {
                                    onNavigate('home');
                                }
                            }}
                            className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors group"
                        >
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-white">close</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Bar */}
            <div className="flex-none grid grid-cols-4 gap-6 px-8 py-6">
                <StatItem
                    icon="groups"
                    label="当前等待人数"
                    value={stats.totalWaiting}
                    colorClass="bg-blue-500/10 text-blue-400"
                />
                <StatItem
                    icon="timer"
                    label="预计平均等待"
                    value={stats.avgWaitTime}
                    unit="MIN"
                    colorClass="bg-amber-500/10 text-amber-400"
                />
                <StatItem
                    icon="check_circle"
                    label="今日已服务"
                    value={stats.servedToday}
                    colorClass="bg-green-500/10 text-green-400"
                />
                <div className="barber-border-wrapper overflow-hidden">
                    <div className="bg-slate-900 rounded-[20px] h-full flex items-center justify-center relative overflow-hidden px-4">
                        <div className="absolute inset-0 bg-slate-900/60 pointer-events-none z-10"></div>
                        <h2 className="text-4xl font-artistic text-white tracking-widest relative z-20 drop-shadow-lg">欢迎光临</h2>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6 px-8 pb-8 overflow-hidden">
                <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-6 content-start pb-20">
                    {barbers.filter(b => b.status !== 'rest').map(barber => (
                        <BarberCard
                            key={barber.id}
                            barber={barber}
                            queue={barberQueues[barber.name] || []}
                        />
                    ))}
                </div>

                {/* Right: Sidebar */}
                <div className="w-80 flex-none flex flex-col gap-6">
                    <div className="bg-slate-800 rounded-3xl p-6 flex flex-col items-center text-center shadow-2xl">
                        <p className="text-white font-black text-xl mb-1">扫码极速预约</p>
                        <p className="text-slate-500 text-[10px] mb-5 font-bold uppercase tracking-widest">Instant Queueing</p>
                        <div className="bg-white p-3 rounded-[32px] mb-6 shadow-inner">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.origin}`}
                                className="w-40 h-40 mix-blend-multiply opacity-90"
                                alt="Booking QR"
                            />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700 uppercase tracking-widest">
                            <span className="material-symbols-outlined text-sm text-primary">touch_app</span>
                            扫码查看您的实时排位
                        </div>
                    </div>

                    <LogFeed logs={recentLogs} />
                </div>
            </div>
        </div>
    );
};
