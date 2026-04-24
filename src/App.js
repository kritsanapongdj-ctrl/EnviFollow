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
  setDoc 
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
  Share2
} from 'lucide-react';

// ----------------------------------------------------------------------
// 🔥 Firebase Configuration
// หากนำโค้ดไปรันข้างนอก (เช่น นำไปขึ้น Vercel) ให้นำค่าจาก Firebase ของคุณมาใส่ด้านล่างนี้
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

// Standard Criteria Constants
const STANDARDS = {
  ph: { min: 5.5, max: 9.0 },
  tds: { max: 1000 }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ staffNames: ['สมชาย ใจดี', 'วิชัย รักน้ำ'] });
  const [chartPeriod, setChartPeriod] = useState(6);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
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
        setSettings(snapshot.docs[0].data());
      }
    }, (err) => console.error("Firestore Error (Settings):", err));

    return () => {
      unsubLogs();
      unsubSettings();
    };
  }, [user]);

  // นำ URL ที่ได้จาก Google Apps Script มาใส่ตรงนี้ (ในเครื่องหมายคำพูด)
  const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbz8b9Dgr3VLY76VN5DnhdjiieO3N6w1J93Tj1gT7BNb6UTnxQG3Nup4HOGp5jDOT3x8IA/exec";

  const handleAddLog = async (formData) => {
    if (!user) return;
    try {
      // 1. บันทึกลงฐานข้อมูลของระบบ (Firebase)
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'Water_Quality_Logs'), {
        ...formData,
        timestamp: new Date().toISOString()
      });

      // 2. ส่งข้อมูลไปที่ Google Sheets ทันที (Auto-Sync)
      if (GOOGLE_SHEETS_WEBHOOK_URL && GOOGLE_SHEETS_WEBHOOK_URL !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        const isPassed = (parseFloat(formData.ph) >= STANDARDS.ph.min && parseFloat(formData.ph) <= STANDARDS.ph.max && parseFloat(formData.tds) <= STANDARDS.tds.max);
        
        try {
          await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors', // สำคัญ: ข้ามการตรวจจับ CORS ของ Google
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              date: formData.date,
              location: formData.location,
              ph: formData.ph,
              tds: formData.tds,
              color: formData.color,
              odor: formData.odor,
              recorder: formData.recorder,
              status: isPassed ? "ผ่าน" : "ไม่ผ่าน"
            })
          });
          console.log("Synced to Google Sheets successfully");
        } catch (fetchErr) {
          console.error("Error syncing to Google Sheets:", fetchErr);
        }
      }

      setActiveTab('dashboard');
    } catch (err) {
      console.error("Save error:", err);
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-72 bg-[#002D62] text-white flex flex-col shadow-xl sticky top-0 h-screen">
        <div className="p-8 border-b border-blue-900/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#002D62] font-black text-xl shadow-inner">LH</div>
            <h1 className="text-xl font-bold tracking-tight text-white">Water Quality</h1>
          </div>
          <p className="text-blue-300 text-[10px] uppercase tracking-widest font-semibold">Monitoring System</p>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<ClipboardList size={20} />} label="บันทึกผลการตรวจ" active={activeTab === 'form'} onClick={() => setActiveTab('form')} />
          <NavItem icon={<FileText size={20} />} label="รายงานรายเดือน" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          <NavItem icon={<SettingsIcon size={20} />} label="ตั้งค่าผู้ใช้งาน" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-6 bg-blue-950/40 text-[10px] text-blue-400 border-t border-blue-900/50 italic">
          UID: {user?.uid || 'Authenticating...'}
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto w-full">
        {activeTab === 'dashboard' && <Dashboard logs={logs} period={chartPeriod} setPeriod={setChartPeriod} />}
        {activeTab === 'form' && <EntryForm onSubmit={handleAddLog} staffNames={settings.staffNames} />}
        {activeTab === 'report' && <ReportView logs={logs} />}
        {activeTab === 'settings' && <SettingsView settings={settings} onUpdateStaff={updateStaff} />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all ${active ? 'bg-blue-700 text-white shadow-lg ring-1 ring-blue-500/50' : 'text-blue-100 hover:bg-blue-800/50'}`}
    >
      {icon}
      <span className="font-semibold text-base">{label}</span>
    </button>
  );
}

// --- Dashboard Component ---
function Dashboard({ logs, period, setPeriod }) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyLogs = logs.filter(l => {
      const d = new Date(l.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const passedTotal = logs.filter(l => 
      l.ph >= STANDARDS.ph.min && l.ph <= STANDARDS.ph.max && l.tds <= STANDARDS.tds.max
    ).length;

    const failedThisMonth = monthlyLogs.filter(l => 
      l.ph < STANDARDS.ph.min || l.ph > STANDARDS.ph.max || l.tds > STANDARDS.tds.max
    ).length;

    return { passedTotal, failedThisMonth, total: logs.length };
  }, [logs]);

  const chartData = useMemo(() => {
    return [...logs]
      .reverse()
      .slice(-10)
      .map(l => ({
        name: new Date(l.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
        ph: parseFloat(l.ph) || 0,
        tds: parseFloat(l.tds) || 0,
      }));
  }, [logs]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-[#002D62]">สรุปแนวโน้ม pH & TDS</h2>
        <div className="flex bg-white rounded-lg shadow-sm border p-1">
          {[3, 6].map(m => (
            <button key={m} onClick={() => setPeriod(m)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${period === m ? 'bg-[#002D62] text-white' : 'text-gray-500'}`}>
              {m} เดือน
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="ผ่านมาตรฐาน" value={stats.passedTotal} total={stats.total} icon={<CheckCircle2 className="text-green-500" />} />
        <StatCard title="ตกมาตรฐานเดือนนี้" value={stats.failedThisMonth} isAlert={stats.failedThisMonth > 0} icon={<AlertCircle className="text-red-500" />} />
        <StatCard title="สถานะระบบ" value={stats.failedThisMonth === 0 ? "ปกติ" : "ต้องเฝ้าระวัง"} icon={<LayoutDashboard className="text-[#002D62]" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <ChartBox 
          title="แนวโน้มค่า pH (เป้าหมาย 5.5 - 8.0)" 
          data={chartData} 
          dataKey="ph" 
          limits={[STANDARDS.ph.min, STANDARDS.ph.max]} 
          color="#002D62" 
          yDomain={[0, 14]}
        />
        <ChartBox 
          title="แนวโน้มค่า TDS (ไม่เกิน 1,000 mg/L)" 
          data={chartData} 
          dataKey="tds" 
          limits={[STANDARDS.tds.max]} 
          color="#B8904F" 
          yDomain={[0, 1500]}
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, total, isAlert, icon }) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-8 ${isAlert ? 'border-red-500' : 'border-[#002D62]'}`}>
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-black text-gray-800">{value}</span>
            {total !== undefined && <span className="text-gray-400 text-sm">/ {total}</span>}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl">{icon}</div>
      </div>
    </div>
  );
}

function ChartBox({ title, data, dataKey, limits, color, yDomain }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
        <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: color }}></div>
        {title}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
            <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px' }} domain={yDomain || ['auto', 'auto']} />
            <Tooltip />
            {limits.map((limit, idx) => (
              <ReferenceLine 
                key={idx} 
                y={limit} 
                stroke="#ef4444" 
                strokeDasharray="5 5" 
                label={{ position: 'right', value: `เกณฑ์ ${limit}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} 
              />
            ))}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={4} 
              dot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }} 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Report View Component ---
function ReportView({ logs }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const d = new Date(l.date);
      return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
    });
  }, [logs, selectedMonth, selectedYear]);

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["วันที่", "โครงการ/ตำแหน่ง", "pH", "TDS", "สี", "กลิ่น", "ผู้บันทึก", "สถานะ"];
    const rows = filteredLogs.map(l => {
      const isPassed = (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max);
      return [
        l.date,
        l.location,
        l.ph,
        l.tds,
        l.color,
        l.odor,
        l.recorder,
        isPassed ? "ผ่าน" : "ไม่ผ่าน"
      ];
    });

    let csvContent = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Water_Quality_Report_${selectedYear}_${parseInt(selectedMonth) + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-[#002D62]">รายงานสรุปรายเดือน</h2>
          <p className="text-sm text-gray-500">เลือกช่วงเวลาเพื่อสรุปข้อมูลและส่งออก</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="flex-1 md:flex-none p-2.5 rounded-xl border-gray-200 bg-gray-50 border text-sm font-semibold"
          >
            {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)}
            className="flex-1 md:flex-none p-2.5 rounded-xl border-gray-200 bg-gray-50 border text-sm font-semibold"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={exportToCSV}
          disabled={filteredLogs.length === 0}
          className="flex items-center justify-center gap-3 bg-[#B8904F] hover:bg-[#a67d3e] text-white p-4 rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50"
        >
          <Download size={20} /> ดาวน์โหลดรายงาน (CSV)
        </button>
        <button 
          onClick={() => window.open('https://docs.google.com/spreadsheets/', '_blank')}
          className="flex items-center justify-center gap-3 bg-[#16A34A] hover:bg-[#15803d] text-white p-4 rounded-2xl font-bold shadow-lg transition-all"
        >
          <Share2 size={20} /> เปิด Google Sheets
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">วันที่</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">โครงการ</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">pH</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">TDS</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-gray-400 font-medium">ไม่พบข้อมูลในเดือนนี้</td>
                </tr>
              ) : (
                filteredLogs.map((l, i) => {
                  const isPassed = (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max);
                  return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 text-sm font-semibold text-gray-700">{l.date}</td>
                      <td className="p-4 text-sm text-gray-600">{l.location}</td>
                      <td className="p-4 text-sm text-center font-mono">{l.ph}</td>
                      <td className="p-4 text-sm text-center font-mono">{l.tds}</td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isPassed ? 'Passed' : 'Failed'}
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
    if (name === 'ph' && (num < STANDARDS.ph.min || num > STANDARDS.ph.max)) msg = `อยู่นอกเกณฑ์มาตรฐาน (${STANDARDS.ph.min} - ${STANDARDS.ph.max})`;
    if (name === 'tds' && num > STANDARDS.tds.max) msg = `เกินเกณฑ์มาตรฐาน (ไม่เกิน ${STANDARDS.tds.max})`;
    setAlerts(prev => ({ ...prev, [name]: msg }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (['ph', 'tds'].includes(name)) validate(name, value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (alerts.ph || alerts.tds) {
      setShowConfirmModal(true);
      return;
    }
    onSubmit(formData);
  };

  const confirmSubmit = () => {
    setShowConfirmModal(false);
    onSubmit(formData);
  };

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-[#002D62] p-10 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <PlusCircle size={28} className="text-[#B8904F]" /> บันทึกผลคุณภาพน้ำ
            </h2>
            <p className="text-blue-200 mt-1 opacity-80 text-sm italic">Focus: pH, TDS, Color, Odor Only</p>
          </div>
          <ClipboardList size={48} className="opacity-20" />
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          {/* Section 1: Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="วันที่ตรวจสอบ">
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-3 rounded-xl border-gray-200 bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none" required />
            </FormField>
            <FormField label="ชื่อโครงการ / จุดเก็บ">
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="ระบุตำแหน่งที่เก็บน้ำ" className="w-full p-3 rounded-xl border-gray-200 bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none" required />
            </FormField>
            <FormField label="ผู้ตรวจบันทึก">
              <select name="recorder" value={formData.recorder} onChange={handleChange} className="w-full p-3 rounded-xl border-gray-200 bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none font-semibold">
                {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          {/* Section 2: Core Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-blue-50/30 p-8 rounded-3xl border border-blue-100">
            <FormField label={`ค่า pH (${STANDARDS.ph.min} - ${STANDARDS.ph.max})`} alert={alerts.ph}>
              <input 
                type="number" 
                step="0.1" 
                name="ph" 
                value={formData.ph} 
                onChange={handleChange} 
                className={`w-full p-4 rounded-2xl border transition-all text-lg font-bold shadow-sm ${alerts.ph ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} 
                required 
              />
            </FormField>
            <FormField label={`ค่า TDS (ไม่เกิน ${STANDARDS.tds.max} mg/L)`} alert={alerts.tds}>
              <input 
                type="number" 
                name="tds" 
                value={formData.tds} 
                onChange={handleChange} 
                className={`w-full p-4 rounded-2xl border transition-all text-lg font-bold shadow-sm ${alerts.tds ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} 
                required 
              />
            </FormField>
          </div>

          {/* Section 3: Physical Observations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <RadioBox label="ลักษณะสี" name="color" options={['ใส', 'ขุ่นเล็กน้อย', 'ขุ่น']} value={formData.color} onChange={handleChange} />
            <RadioBox label="กลิ่น" name="odor" options={['ไม่มีกลิ่น', 'มีกลิ่นเล็กน้อย', 'มีกลิ่น']} value={formData.odor} onChange={handleChange} />
          </div>

          <button type="submit" className="w-full bg-[#002D62] hover:bg-[#003d82] text-white py-6 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3">
            <CheckCircle2 size={26} /> บันทึกข้อมูลคุณภาพน้ำ
          </button>
        </form>
      </div>

      {/* ป็อปอัปแจ้งเตือนแบบกำหนดเอง */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-2">ยืนยันการบันทึกข้อมูล</h3>
            <p className="text-center text-gray-600 mb-8 leading-relaxed">
              ตรวจพบว่าค่าคุณภาพน้ำ <strong className="text-red-500">ไม่เป็นไปตามเกณฑ์</strong><br/>
              คุณต้องการบันทึกข้อมูลตามจริงนี้ลงระบบใช่หรือไม่?
            </p>
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                กลับไปแก้ไข
              </button>
              <button 
                type="button"
                onClick={confirmSubmit}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-colors"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, alert }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
      {alert && <p className="text-red-500 text-[10px] font-bold flex items-center gap-1.5 animate-pulse"><AlertCircle size={12}/> {alert}</p>}
    </div>
  );
}

function RadioBox({ label, name, options, value, onChange }) {
  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className={`flex-1 min-w-[100px] flex items-center justify-center p-3 rounded-2xl border-2 cursor-pointer transition-all ${value === opt ? 'bg-[#002D62] border-[#002D62] text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-400'}`}>
            <input type="radio" name={name} value={opt} checked={value === opt} onChange={onChange} className="hidden" />
            <span className="text-sm font-bold">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// --- Settings View Component ---
function SettingsView({ settings, onUpdateStaff }) {
  const [name, setName] = useState('');
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold text-[#002D62] mb-8 flex items-center gap-3">
          <User size={32} className="text-[#B8904F]" /> จัดการรายชื่อเจ้าหน้าที่
        </h2>
        <div className="flex gap-3 mb-8">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ระบุชื่อ-นามสกุล..." className="flex-1 p-4 rounded-xl border-gray-200 bg-gray-50 border focus:ring-2 focus:ring-blue-500 outline-none" />
          <button 
            onClick={() => { if(name.trim()) { onUpdateStaff([...settings.staffNames, name.trim()]); setName(''); }}}
            className="bg-[#B8904F] text-white px-8 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
          >เพิ่ม</button>
        </div>
        <div className="space-y-3">
          {settings.staffNames.map((n, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all">
              <span className="font-bold text-gray-700">{n}</span>
              <button onClick={() => onUpdateStaff(settings.staffNames.filter(x => x !== n))} className="text-red-300 hover:text-red-500 transition-colors p-2"><XCircle size={24}/></button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-[#002D62] text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#B8904F]">
            <AlertCircle size={20}/> มาตรฐานน้ำทิ้ง
          </h3>
          <p className="text-blue-100 text-xs opacity-90 leading-relaxed">
            ระบบปัจจุบันเน้นการบันทึกค่าพารามิเตอร์หลักคือ pH (5.5-9.0) และ TDS (ไม่เกิน 1,000 mg/L) รวมถึงลักษณะทางกายภาพตามประกาศปี 2564
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-5">
          <SettingsIcon size={180} />
        </div>
      </div>
    </div>
  );
}