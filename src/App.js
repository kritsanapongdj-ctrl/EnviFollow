/* eslint-disable no-undef */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Settings as SettingsIcon, 
  PlusCircle, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  User,
  FileText,
  Download,
  Share2,
  Menu,
  X,
  Printer,
  Lock,
  Loader2,
  Upload
} from 'lucide-react';

// ----------------------------------------------------------------------
// 🔥 Firebase Configuration
// ----------------------------------------------------------------------
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyAkyc7Y9lWUEcbx7qFXYf5TkXv9ZN2BNaA",
      authDomain: "watertestqc.firebaseapp.com",
      projectId: "watertestqc",
      storageBucket: "watertestqc.firebasestorage.app",
      messagingSenderId: "252336496800",
      appId: "1:252336496800:web:25b6406fee8fee4eb4e9c5",
      measurementId: "G-ZSDZW78FVK"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wastewater-v1';

// มาตรฐานที่ใช้ตรวจสอบ
const STANDARDS = {
  ph: { min: 5.5, max: 9.0 },
  tds: { max: 1000 },
  alert_ph_min: 5.0,
  alert_ph_max: 9.0,
  alert_tds: 1000,
  alert_email: "kritsanapong@lh.co.th"
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ staffNames: ['สมชาย ใจดี', 'วิชัย รักน้ำ'] });
  const [chartPeriod, setChartPeriod] = useState(6);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // State สำหรับระบบ Lock
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setAuthError(null);
      } catch (err) {
        console.error("Auth error:", err);
        setAuthError(err.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'Water_Quality_Logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => console.error("Firestore Error (Logs):", err));

    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'Settings');
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (!snapshot.empty) {
        const globalSet = snapshot.docs.find(d => d.id === 'global_settings');
        if (globalSet) setSettings(globalSet.data());
      }
    }, (err) => console.error("Firestore Error (Settings):", err));

    return () => { unsubLogs(); unsubSettings(); };
  }, [user]);

  const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbz8b9Dgr3VLY76VN5DnhdjiieO3N6w1J93Tj1gT7BNb6UTnxQG3Nup4HOGp5jDOT3x8IA/exec";

  // ฟังก์ชันบันทึกข้อมูลเดี่ยว + แจ้งเตือนวิกฤต
  const handleAddLog = async (formData) => {
    if (!user) return;
    try {
      const phVal = parseFloat(formData.ph);
      const tdsVal = parseFloat(formData.tds);
      
      const needsCriticalAlert = (phVal < STANDARDS.alert_ph_min || phVal > STANDARDS.alert_ph_max || tdsVal > STANDARDS.alert_tds);
      const isPassedNormal = (phVal >= STANDARDS.ph.min && phVal <= STANDARDS.ph.max && tdsVal <= STANDARDS.tds.max);

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'Water_Quality_Logs'), {
        ...formData,
        timestamp: new Date().toISOString()
      });

      if (GOOGLE_SHEETS_WEBHOOK_URL && GOOGLE_SHEETS_WEBHOOK_URL !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        try {
          await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              status: isPassedNormal ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์",
              critical_alert: needsCriticalAlert,
              alert_recipient: needsCriticalAlert ? STANDARDS.alert_email : null,
              system_link: window.location.href
            })
          });
        } catch (fetchErr) {
          console.error("Webhook Error:", fetchErr);
        }
      }
      setActiveTab('dashboard');
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  // ฟังก์ชันนำเข้าข้อมูลจำนวนมาก (Batch Import - แบบแบ่งชุด)
  const handleImportData = async (importedLogs) => {
    if (!user || importedLogs.length === 0) return false;
    try {
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'Water_Quality_Logs');
      
      // Firebase เขียนรวดเดียวได้สูงสุด 500 รายการ เราจะแบ่งชุดละ 400 เพื่อความปลอดภัย
      const CHUNK_SIZE = 400; 
      
      for (let i = 0; i < importedLogs.length; i += CHUNK_SIZE) {
        const chunk = importedLogs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(log => {
          const newDocRef = doc(logsRef);
          batch.set(newDocRef, {
            ...log,
            timestamp: new Date().toISOString()
          });
        });

        // รอให้เขียนเสร็จทีละชุด
        await batch.commit();
      }
      
      return true;
    } catch (err) {
      console.error("Import error:", err);
      return false;
    }
  };

  const handleTabChange = (tabId) => {
    if ((tabId === 'report' || tabId === 'settings') && !isAuthorized) {
      setPendingTab(tabId);
      setShowPasswordInput(true);
      setIsSidebarOpen(false);
    } else {
      setActiveTab(tabId);
      setIsSidebarOpen(false);
    }
  };

  const checkPassword = (e) => {
    e.preventDefault();
    if (password === '1312') {
      setIsAuthorized(true);
      setShowPasswordInput(false);
      setActiveTab(pendingTab);
      setPassword('');
      setPassError(false);
    } else {
      setPassError(true);
      setPassword('');
    }
  };

  const updateStaff = async (newStaffList) => {
    if (!user) return;
    try {
      const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'Settings', 'global_settings');
      await setDoc(settingsDocRef, { staffNames: newStaffList });
    } catch (err) {
      console.error("Settings update error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-x-hidden">
      {/* Mobile Header */}
      <header className="md:hidden bg-[#002D62] text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#002D62] font-black">LH</div>
          <span className="font-bold text-sm">Water Quality Monitoring</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#002D62] text-white flex flex-col shadow-xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:h-screen print:hidden`}>
        <div className="p-8 border-b border-blue-900/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#002D62] font-black text-xl shadow-inner">LH</div>
            <h1 className="text-xl font-bold tracking-tight text-white">Water Quality</h1>
          </div>
          <p className="text-blue-300 text-[10px] uppercase tracking-widest font-semibold">Monitoring System</p>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <NavItem icon={<ClipboardList size={20} />} label="บันทึกผลการตรวจ" active={activeTab === 'form'} onClick={() => handleTabChange('form')} />
          <NavItem icon={<FileText size={20} />} label="รายงานรายเดือน" active={activeTab === 'report'} onClick={() => handleTabChange('report')} isLocked={!isAuthorized} />
          <NavItem icon={<SettingsIcon size={20} />} label="ตั้งค่าผู้ใช้งาน" active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} isLocked={!isAuthorized} />
        </nav>
        <div className="p-6 bg-blue-950/40 text-[10px] text-blue-400 border-t border-blue-900/50 italic flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span>UID: {user?.uid ? user.uid.substring(0, 8) + '...' : 'รอการเชื่อมต่อ...'}</span>
            {isAuthorized && <button onClick={() => setIsAuthorized(false)} title="Admin Logout" className="hover:text-white transition-colors"><Lock size={12}/></button>}
          </div>
          {authError && <span className="text-red-400 font-bold">⚠️ {authError.includes('auth/operation-not-allowed') ? 'กรุณาเปิด Anonymous Auth ใน Firebase' : 'การเชื่อมต่อผิดพลาด'}</span>}
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* Password Modal */}
      {showPasswordInput && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-blue-50 text-[#002D62] rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner"><Lock size={32} /></div>
            <h3 className="text-xl font-bold text-center text-gray-800 mb-2">พื้นที่ส่วนบุคคล</h3>
            <p className="text-center text-gray-500 text-sm mb-6">กรุณากรอกรหัสผ่านเพื่อเข้าถึงหน้านี้</p>
            <form onSubmit={checkPassword} className="space-y-4">
              <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ระบุรหัสผ่าน" className={`w-full p-4 text-center text-2xl tracking-[1em] rounded-2xl border-2 outline-none transition-all ${passError ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 focus:border-[#002D62]'}`} />
              {passError && <p className="text-red-500 text-xs text-center font-bold">รหัสผ่านไม่ถูกต้อง</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordInput(false)} className="flex-1 py-3 text-sm font-bold text-gray-400">ยกเลิก</button>
                <button type="submit" className="flex-1 py-3 bg-[#002D62] text-white rounded-xl font-bold shadow-lg">ยืนยัน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 w-full overflow-x-hidden print:p-0 print:bg-white">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard logs={logs} period={chartPeriod} setPeriod={setChartPeriod} user={user} authError={authError} />}
          {activeTab === 'form' && <EntryForm onSubmit={handleAddLog} staffNames={settings.staffNames} />}
          {activeTab === 'report' && <ReportView logs={logs} onImport={handleImportData} />}
          {activeTab === 'settings' && <SettingsView settings={settings} onUpdateStaff={updateStaff} />}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { body { background: white !important; } .print-hidden { display: none !important; } .print-only { display: block !important; } @page { margin: 1cm; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #002D62; border-radius: 10px; }
      `}} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, isLocked }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-4 px-5 py-3 rounded-xl transition-all ${active ? 'bg-blue-700 text-white shadow-lg ring-1 ring-blue-500/50' : 'text-blue-100 hover:bg-blue-800/50'}`}>
      <div className="flex items-center gap-4">{icon}<span className="font-semibold text-base">{label}</span></div>
      {isLocked && <Lock size={14} className="opacity-40" />}
    </button>
  );
}

// --- Dashboard Component ---
function Dashboard({ logs, period, setPeriod, user, authError }) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyLogs = logs.filter(l => { const d = new Date(l.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
    const passedTotal = logs.filter(l => l.ph >= STANDARDS.ph.min && l.ph <= STANDARDS.ph.max && l.tds <= STANDARDS.tds.max).length;
    const failedThisMonth = monthlyLogs.filter(l => l.ph < STANDARDS.ph.min || l.ph > STANDARDS.ph.max || l.tds > STANDARDS.tds.max).length;
    return { passedTotal, failedThisMonth, total: logs.length };
  }, [logs]);

  const chartData = useMemo(() => {
    return [...logs].reverse().slice(-10).map(l => ({ name: new Date(l.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }), ph: parseFloat(l.ph) || 0, tds: parseFloat(l.tds) || 0 }));
  }, [logs]);

  let connectionStatus = "กำลังเชื่อมต่อ...", statusIcon = <Loader2 className="text-amber-500 animate-spin" />, statusColor = "border-amber-500";
  if (user) { connectionStatus = "พร้อมใช้งาน"; statusIcon = <CheckCircle2 className="text-green-500" />; statusColor = "border-green-500"; }
  else if (authError) { connectionStatus = "เชื่อมต่อไม่สำเร็จ"; statusIcon = <XCircle className="text-red-500" />; statusColor = "border-red-500"; }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-[#002D62]">ภาพรวมคุณภาพน้ำ</h2>
        <div className="flex bg-white rounded-lg shadow-sm border p-1 w-full sm:w-auto">
          {[3, 6].map(m => (<button key={m} onClick={() => setPeriod(m)} className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold ${period === m ? 'bg-[#002D62] text-white' : 'text-gray-500'}`}>{m} เดือน</button>))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatCard title="ผ่านมาตรฐานทั้งหมด" value={stats.passedTotal} total={stats.total} icon={<CheckCircle2 className="text-green-500" />} color="border-[#002D62]" />
        <StatCard title="ตกเกณฑ์ในเดือนนี้" value={stats.failedThisMonth} isAlert={stats.failedThisMonth > 0} icon={<AlertCircle className="text-red-500" />} color="border-red-500" />
        <StatCard title="ความพร้อมใช้งาน" value={connectionStatus} description="สถานะการเชื่อมต่อฐานข้อมูล Cloud" icon={statusIcon} color={statusColor} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        <ChartBox title="แนวโน้มค่า pH (เป้าหมาย 5.5 - 9.0)" data={chartData} dataKey="ph" limits={[STANDARDS.ph.min, STANDARDS.ph.max]} color="#002D62" yDomain={[0, 14]} />
        <ChartBox title="แนวโน้มค่า TDS (ไม่เกิน 1,000 mg/L)" data={chartData} dataKey="tds" limits={[STANDARDS.tds.max]} color="#B8904F" yDomain={[0, 1500]} />
      </div>
    </div>
  );
}

function StatCard({ title, value, total, icon, color, description }) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-8 ${color}`}>
      <div className="flex justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-2"><span className="text-3xl md:text-4xl font-black text-gray-800 leading-none">{value}</span>{total !== undefined && <span className="text-gray-400 text-sm">/ {total}</span>}</div>
          {description && <p className="text-[10px] text-gray-400 mt-2 italic leading-tight">{description}</p>}
        </div>
        <div className="bg-slate-50 p-3 rounded-xl h-fit">{icon}</div>
      </div>
    </div>
  );
}

function ChartBox({ title, data, dataKey, limits, color, yDomain }) {
  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2 text-sm sm:text-base"><div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: color }}></div>{title}</h3>
      <div className="h-64 sm:h-80 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} />
            <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px' }} domain={yDomain} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            {limits.map((limit, idx) => (<ReferenceLine key={idx} y={limit} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'right', value: `เกณฑ์ ${limit}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />))}
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Report View Component ---
function ReportView({ logs, onImport }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isImporting, setIsImporting] = useState(false);
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const filteredLogs = useMemo(() => {
    return logs.filter(l => { const d = new Date(l.date); return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear); });
  }, [logs, selectedMonth, selectedYear]);

  // ฟังก์ชันนำเข้าไฟล์ CSV
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        // รองรับการแบ่งบรรทัดทั้ง \n และ \r\n
        const lines = text.split(/\r?\n/);
        const results = [];
        
        // ข้ามบรรทัดหัวข้อ (Header)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(',');
          // คาดหวังรูปแบบ: วันที่, โครงการ, บ่อที่, pH, TDS, สี, กลิ่น, ผู้บันทึก
          if (cols.length >= 8) {
            results.push({
              date: cols[0].replace(/['"]/g, '').trim(),
              location: cols[1].replace(/['"]/g, '').trim(),
              poolNo: cols[2].replace(/['"]/g, '').trim() || '1',
              ph: cols[3].replace(/['"]/g, '').trim(),
              tds: cols[4].replace(/['"]/g, '').trim(),
              color: cols[5].replace(/['"]/g, '').trim(),
              odor: cols[6].replace(/['"]/g, '').trim(),
              recorder: cols[7].replace(/['"]/g, '').trim(),
            });
          }
        }

        const success = await onImport(results);
        if (success) {
          alert(`นำเข้าข้อมูล ${results.length} รายการ สำเร็จ!`);
        } else {
          alert("ไม่สามารถนำเข้าข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อ");
        }
      } catch (err) {
        alert("รูปแบบไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ .csv ที่จัดเรียงคอลัมน์ถูกต้อง");
      } finally {
        setIsImporting(false);
        e.target.value = null; // รีเซ็ต input
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-[#002D62]">รายงานสรุปคุณภาพน้ำ</h2>
          <p className="text-sm text-gray-500">กรองข้อมูล อัปโหลด หรือส่งออกรายการตรวจ</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="flex-1 p-2.5 rounded-xl border-gray-200 bg-slate-50 border text-sm font-semibold outline-none focus:border-[#002D62]">
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="flex-1 p-2.5 rounded-xl border-gray-200 bg-slate-50 border text-sm font-semibold outline-none focus:border-[#002D62]">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="hidden print:block text-center space-y-2 mb-8 border-b-2 border-[#002D62] pb-6">
        <h1 className="text-3xl font-bold text-[#002D62]">รายงานผลการตรวจคุณภาพน้ำเสีย</h1>
        <p className="text-xl font-semibold">ประจำเดือน {months[selectedMonth]} ปี พ.ศ. {parseInt(selectedYear) + 543}</p>
        <p className="text-sm text-gray-500">พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <button onClick={() => window.print()} className="flex items-center justify-center gap-3 bg-[#002D62] text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-[#003d82] transition-all">
          <Printer size={20} /> พิมพ์ (PDF)
        </button>
        <button onClick={() => {
          const headers = ["วันที่", "โครงการ", "บ่อที่", "pH", "TDS", "สี", "กลิ่น", "ผู้บันทึก", "สถานะ"];
          const rows = filteredLogs.map(l => [l.date, l.location, l.poolNo || '1', l.ph, l.tds, l.color, l.odor, l.recorder, (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max) ? "ผ่าน" : "ไม่ผ่าน"]);
          const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = `Report_${months[selectedMonth]}_${selectedYear}.csv`; link.click();
        }} className="flex items-center justify-center gap-3 bg-[#B8904F] text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-[#a67d3e] transition-all">
          <Download size={20} /> ส่งออก (CSV)
        </button>
        
        {/* ปุ่มนำเข้าข้อมูล */}
        <label className="flex items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 text-gray-600 p-4 rounded-2xl font-bold hover:bg-gray-50 cursor-pointer transition-all shadow-sm">
          {isImporting ? <Loader2 size={20} className="animate-spin text-[#002D62]" /> : <Upload size={20} className="text-[#B8904F]" />} 
          <span>{isImporting ? 'กำลังนำเข้า...' : 'อัปโหลด .CSV'}</span>
          <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" disabled={isImporting} />
        </label>

        <button onClick={() => window.open('https://docs.google.com/spreadsheets/', '_blank')} className="flex items-center justify-center gap-3 bg-[#16A34A] text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-[#15803d] transition-all">
          <Share2 size={20} /> เปิดชีต
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 print:bg-gray-100 print:border-gray-300">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase print:text-black">วันที่</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase print:text-black">โครงการ / บ่อจุดที่</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center print:text-black">pH</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center print:text-black">TDS</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center print:text-black">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 print:divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-medium italic">ไม่มีข้อมูลการบันทึกในเดือนนี้</td></tr>
              ) : (
                filteredLogs.map((l, i) => {
                  const isPassed = (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max);
                  return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors print:hover:bg-transparent">
                      <td className="p-4 text-sm font-semibold text-gray-700 print:text-black whitespace-nowrap">{l.date}</td>
                      <td className="p-4 text-sm text-gray-600 print:text-black">
                        <span className="font-bold">{l.location}</span> 
                        {l.poolNo && <span className="ml-2 text-xs font-bold text-[#B8904F] bg-amber-50 px-2 py-0.5 rounded border border-amber-100">บ่อที่ {l.poolNo}</span>}
                      </td>
                      <td className="p-4 text-sm text-center font-mono print:text-black">{l.ph}</td>
                      <td className="p-4 text-sm text-center font-mono print:text-black">{l.tds}</td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isPassed ? 'bg-green-100 text-green-700 print:bg-transparent print:text-green-600' : 'bg-red-100 text-red-700 print:bg-transparent print:text-red-600'}`}>
                          {isPassed ? 'ผ่าน' : 'ตกเกณฑ์'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Entry Form Component ---
function EntryForm({ onSubmit, staffNames }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    location: '',
    poolNo: '1',
    ph: '',
    tds: '',
    color: 'ใส',
    odor: 'ไม่มีกลิ่น',
    recorder: staffNames[0] || ''
  });
  const [alerts, setAlerts] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const validate = (name, val) => {
    let msg = "";
    const num = parseFloat(val);
    if (name === 'ph' && (num < STANDARDS.ph.min || num > STANDARDS.ph.max)) msg = `ไม่อยู่ในเกณฑ์ (5.5 - 9.0)`;
    if (name === 'tds' && num > STANDARDS.tds.max) msg = `เกินเกณฑ์ (1,000 mg/L)`;
    setAlerts(prev => ({ ...prev, [name]: msg }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (['ph', 'tds'].includes(name)) validate(name, value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (alerts.ph || alerts.tds) { setShowConfirmModal(true); return; }
    onSubmit(formData);
  };

  // ตรวจสอบว่าเข้าข่ายวิกฤตหรือไม่ สำหรับโชว์ข้อความเตือนก่อนบันทึก
  const phVal = parseFloat(formData.ph);
  const tdsVal = parseFloat(formData.tds);
  const isCritical = (phVal < STANDARDS.alert_ph_min || phVal > STANDARDS.alert_ph_max || tdsVal > STANDARDS.alert_tds);

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-[#002D62] p-8 md:p-10 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3"><PlusCircle size={28} className="text-[#B8904F]" /> บันทึกผลการตรวจคุณภาพน้ำ</h2>
            <p className="text-blue-200 mt-1 opacity-80 text-xs md:text-sm">ตรวจสอบเกณฑ์อัตโนมัติและส่งแจ้งเตือนพิเศษทางอีเมล</p>
          </div>
          <ClipboardList size={48} className="opacity-20 hidden sm:block" />
        </div>
        <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8 md:space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormField label="วันที่ตรวจสอบ">
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium" required />
            </FormField>
            
            <FormField label="โครงการ">
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="ระบุชื่อโครงการ" className="w-full p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium" required />
            </FormField>
            
            <FormField label="บ่อบำบัดจุดที่">
              <select name="poolNo" value={formData.poolNo} onChange={handleChange} className="w-full p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-bold text-center">
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
            
            <FormField label="เจ้าหน้าที่ผู้ตรวจ">
              <select name="recorder" value={formData.recorder} onChange={handleChange} className="w-full p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-bold">
                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-blue-50/40 p-6 md:p-8 rounded-3xl border border-blue-100 shadow-inner">
            <FormField label={`ค่า pH (เกณฑ์ 5.5 - 9.0)`} alert={alerts.ph}>
              <input type="number" step="0.1" name="ph" value={formData.ph} onChange={handleChange} className={`w-full p-4 rounded-2xl border transition-all text-xl font-black shadow-sm ${alerts.ph ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} required />
            </FormField>
            <FormField label={`ค่า TDS (เกณฑ์ไม่เกิน 1,000 mg/L)`} alert={alerts.tds}>
              <input type="number" name="tds" value={formData.tds} onChange={handleChange} className={`w-full p-4 rounded-2xl border transition-all text-xl font-black shadow-sm ${alerts.tds ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} required />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <RadioBox label="ลักษณะสี" name="color" options={['ใส', 'ขุ่นเล็กน้อย', 'ขุ่น']} value={formData.color} onChange={handleChange} />
            <RadioBox label="กลิ่น" name="odor" options={['ไม่มีกลิ่น', 'มีกลิ่นเล็กน้อย', 'มีกลิ่น']} value={formData.odor} onChange={handleChange} />
          </div>

          <button type="submit" className="w-full bg-[#002D62] hover:bg-[#003d82] text-white py-5 rounded-2xl font-black text-lg md:text-xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3">
            <CheckCircle2 size={24} /> ยืนยันการบันทึก
          </button>
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-red-500">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner"><AlertCircle size={32} /></div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-2">ตรวจพบค่าที่ตกเกณฑ์</h3>
            <p className="text-center text-gray-600 mb-8 leading-relaxed">
              ค่าคุณภาพน้ำที่ระบุ <strong className="text-red-500">อยู่นอกเกณฑ์มาตรฐาน</strong>
              <br/>
              {isCritical && <span className="text-xs text-[#B8904F] mt-2 block bg-amber-50 p-2 rounded-lg font-bold">⚠️ จะมีการส่งอีเมลแจ้งเตือนวิกฤตไปที่ {STANDARDS.alert_email}</span>}
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 border">ยกเลิก</button>
              <button onClick={() => { setShowConfirmModal(false); onSubmit(formData); }} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all">ยืนยันบันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, alert }) { return (<div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>{children}{alert && <p className="text-red-500 text-[10px] font-bold flex items-center gap-1.5 animate-pulse italic"><AlertCircle size={12}/> {alert}</p>}</div>); }
function RadioBox({ label, name, options, value, onChange }) { return (<div className="space-y-4"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label><div className="grid grid-cols-3 gap-2">{options.map(opt => (<label key={opt} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 cursor-pointer transition-all ${value === opt ? 'bg-[#002D62] border-[#002D62] text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-500'}`}><input type="radio" name={name} value={opt} checked={value === opt} onChange={onChange} className="hidden" /><span className="text-[11px] md:text-sm font-bold text-center leading-tight">{opt}</span></label>))}</div></div>); }

// --- Settings View Component ---
function SettingsView({ settings, onUpdateStaff }) {
  const [name, setName] = useState('');
  return (
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100">
        <h2 className="text-xl md:text-2xl font-bold text-[#002D62] mb-8 flex items-center gap-3"><User size={32} className="text-[#B8904F]" /> จัดการรายชื่อเจ้าหน้าที่</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-8"><input value={name} onChange={e => setName(e.target.value)} placeholder="ระบุชื่อ-นามสกุล..." className="flex-1 p-4 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium" /><button onClick={() => { if(name.trim()) { onUpdateStaff([...settings.staffNames, name.trim()]); setName(''); }}} className="bg-[#B8904F] text-white px-8 py-4 sm:py-0 rounded-xl font-black hover:shadow-lg transition-all">เพิ่มรายชื่อ</button></div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {settings.staffNames.length === 0 ? (<p className="text-center text-gray-400 py-10 italic">ยังไม่มีรายชื่อเจ้าหน้าที่</p>) : (
            settings.staffNames.map((n, i) => (<div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all"><span className="font-bold text-gray-700">{n}</span><button onClick={() => onUpdateStaff(settings.staffNames.filter(x => x !== n))} className="text-red-300 hover:text-red-500 transition-colors p-2"><XCircle size={24}/></button></div>))
          )}
        </div>
      </div>
      <div className="bg-[#002D62] text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#B8904F]"><AlertCircle size={20}/> ระบบแจ้งเตือนพิเศษ</h3>
          <p className="text-blue-100 text-xs md:text-sm opacity-90 leading-relaxed">
            หากค่า pH {'<'} 5 หรือ {'>'} 9 หรือ TDS {'>'} 1,000 <br className="hidden md:block"/>
            ระบบจะส่งแจ้งเตือนไปที่: <span className="font-bold underline text-white">kritsanapong@lh.co.th</span> ทันที
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-5"><SettingsIcon size={180} /></div>
      </div>
    </div>
  );
}