// === إعدادات Supabase (ضع روابط مشروعك هنا) ===
const SUPABASE_URL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dnNmb3Ryc3B1cnB3bWpra2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzAyMjgsImV4cCI6MjEwODM0NjIyOH0.i3jTpvxKhmnPFSs9JaVCIMNjZq2Rj7eZIl0CDENT6dk';
const SUPABASE_KEY = 'sb_publishable_U5SMt6Om04Q2l9GK4C4SVA_koqepAWq';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const INITIAL_STATE = {
    startWeight: 110.0, targetWeight: 85.0, currentWeight: 107.0, bmr: 2120, waterCups: 6, waterGoalCups: 14, athkarCount: 33,
    dailyStats: { steps: 1648, activeCalories: 244, sleepHours: 8.3 },
    weighIns: [{ date: 'البداية', weight: 110.0 }]
};

const ATHKAR_LIST = [
    "سبحان الله وبحمده، سبحان الله العظيم",
    "اللهم صلِّ وسلِّم وبارك على نبينا محمد",
    "لا حول ولا قوة إلا بالله العلي العظيم",
    "أستغفر الله العظيم وأتوب إليه"
];

let state = { ...INITIAL_STATE };
let currentDhikrIndex = 0;
let currentVisualMode = 'matrix';

// === إدارة الواجهة والمؤثرات ===
function playChime(freq = 620) {
    try {
        if (navigator.vibrate) navigator.vibrate(18);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
}

function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    document.getElementById('toastMessage').textContent = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none'), 2600);
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('selected_theme_85', themeName);
}

function updateSyncBadge(statusText, isSyncing = false) {
    const txt = document.getElementById('syncStatusText');
    const badge = document.getElementById('syncStatusBadge');
    if (txt) txt.textContent = statusText;
    if (badge) {
        badge.className = isSyncing 
            ? "flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            : "flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20";
    }
}

function refreshAllUI() {
    // تحديث الأذكار
    const dhikrEl = document.getElementById('athkarText');
    if (dhikrEl) dhikrEl.textContent = `"${ATHKAR_LIST[currentDhikrIndex]}"`;
    const countEl = document.getElementById('athkarCounterDisplay');
    if (countEl) countEl.textContent = state.athkarCount;

    // تحديث الماء
    const waterPct = Math.min(100, Math.round((state.waterCups / state.waterGoalCups) * 100));
    const barEl = document.getElementById('waterLevelBar');
    if (barEl) barEl.style.height = `${Math.max(state.waterCups > 0 ? 12 : 0, waterPct)}%`;
    const litersEl = document.getElementById('waterLitersText');
    if (litersEl) litersEl.textContent = `${(state.waterCups * 0.25).toFixed(2)} L`;
}

// === إدارة البيانات مع Supabase ===
async function saveState() {
    localStorage.setItem('health_85_state', JSON.stringify(state));
    refreshAllUI();
    try {
        await supabase.from('user_tracker').upsert({ id: 'my_profile', data: state, updated_at: new Date() });
        updateSyncBadge('متزامن لحظياً ✓', true);
    } catch (e) {
        updateSyncBadge('خطأ في المزامنة');
    }
}

async function loadCloudData() {
    updateSyncBadge('جاري التحميل...');
    const { data, error } = await supabase.from('user_tracker').select('data').eq('id', 'my_profile').single();
    if (data && data.data) {
        state = { ...INITIAL_STATE, ...data.data };
        localStorage.setItem('health_85_state', JSON.stringify(state));
        refreshAllUI();
        updateSyncBadge('متزامن لحظياً ✓', true);
    }
}

function subscribeToChanges() {
    supabase.channel('public:user_tracker')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_tracker' }, payload => {
            if (payload.new && payload.new.data) {
                state = payload.new.data;
                localStorage.setItem('health_85_state', JSON.stringify(state));
                refreshAllUI();
            }
        }).subscribe();
}

// === ربط الأحداث (تم إصلاح خطأ الأقواس) ===
function setupEvents() {
    // أحداث الأذكار (تم إزالة التكرار)
    document.getElementById('dhikrClickBtn')?.addEventListener('click', () => {
        state.athkarCount++; saveState(); playChime(587);
    });
    document.getElementById('nextDhikrBtn')?.addEventListener('click', () => {
        currentDhikrIndex = (currentDhikrIndex + 1) % ATHKAR_LIST.length; refreshAllUI();
    });
    document.getElementById('resetDhikrBtn')?.addEventListener('click', () => {
        state.athkarCount = 0; saveState(); showToast('تم التصفير');
    });

    // أحداث الماء
    document.getElementById('stepperPlusBtn')?.addEventListener('click', () => {
        state.waterCups = Math.min(30, state.waterCups + 1); saveState(); playChime(700);
    });
    document.getElementById('stepperMinusBtn')?.addEventListener('click', () => {
        state.waterCups = Math.max(0, state.waterCups - 1); saveState();
    });
    document.getElementById('quickResetBtn')?.addEventListener('click', () => {
        state.waterCups = 0; saveState();
    });

    // أحداث النوافذ المنبثقة
    const weighModal = document.getElementById('weighInModal');
    document.getElementById('openWeighInBtn')?.addEventListener('click', () => {
        document.getElementById('newWeightInput').value = state.currentWeight;
        weighModal?.classList.remove('hidden');
    });
    document.getElementById('closeWeighInModal')?.addEventListener('click', () => weighModal?.classList.add('hidden'));
    
    document.getElementById('weighInForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newW = parseFloat(document.getElementById('newWeightInput').value);
        if (newW) {
            state.weighIns.push({ date: new Date().toLocaleDateString('ar-SA'), weight: newW });
            state.currentWeight = newW;
            saveState();
            weighModal?.classList.add('hidden');
            showToast('تم تحديث الوزن بنجاح 🚀');
        }
    });

    // أحداث التزامن اليدوي
    document.getElementById('forceSyncBtn')?.addEventListener('click', () => {
        loadCloudData(); showToast('تم سحب أحدث البيانات');
    });
}

// === التهيئة عند بدء التشغيل ===
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('selected_theme_85');
    if (savedTheme) setTheme(savedTheme);
    
    const local = localStorage.getItem('health_85_state');
    if (local) state = { ...INITIAL_STATE, ...JSON.parse(local) };
    
    refreshAllUI();
    setupEvents();
    loadCloudData();
    subscribeToChanges(); // تشغيل الاستماع اللحظي لقاعدة البيانات
});