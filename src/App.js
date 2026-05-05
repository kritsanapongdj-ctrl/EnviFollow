import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  LayoutDashboard, ClipboardList, Settings as SettingsIcon, PlusCircle, AlertCircle, CheckCircle2, 
  XCircle, User, FileText, Download, Share2, Menu, X, Printer, Lock, Loader2, Database, Upload, Info, RefreshCw, AlertTriangle
} from 'lucide-react';

// ----------------------------------------------------------------------
// 🔥 ตั้งค่า Google Sheets Webhook URL (นำ URL ใหม่มาใส่ที่นี่!)
// ----------------------------------------------------------------------
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbz8b9Dgr3VLY76VN5DnhdjiieO3N6w1J93Tj1gT7BNb6UTnxQG3Nup4HOGp5jDOT3x8IA/exec";
const GOOGLE_SHEETS_DIRECT_URL = "https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit";

const STANDARDS = {
  ph: { min: 5.5, max: 9.0 },
  tds: { max: 1000 },
  alert_ph_min: 5.0,
  alert_ph_max: 9.0,
  alert_tds: 1000,
  alert_email: "kritsanapong@lh.co.th"
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ staffNames: ['สมชาย ใจดี', 'วิชัย รักน้ำ'] });
  const [chartPeriod, setChartPeriod] = useState(6);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading'); // loading, success, error
  const [sheetError, setSheetError] = useState(null);
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);

  // ดึงข้อมูลทั้งหมดจาก Google Sheets
  const fetchLogsFromSheets = async () => {
    try {
      setIsLoading(true);
      setSyncStatus('loading');
      setSheetError(null);
      
      const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("ระบบถูกบล็อก: โปรดกลับไปหน้า Google Apps Script แล้ว Deploy แบบ 'New Deployment' และตั้งค่าผู้เข้าถึงเป็น 'ทุกคน (Anyone)'");
      }
      
      if (result && result.status === 'success') {
        if (result.data) {
          const sortedData = result.data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setLogs(sortedData);
          localStorage.setItem('waterQC_LogsCache', JSON.stringify(sortedData)); // สำรองกันเหนียว
        }
        if (result.settings && result.settings.staffNames) {
          setSettings({ staffNames: result.settings.staffNames });
          localStorage.setItem('waterQC_StaffCache', JSON.stringify({ staffNames: result.settings.staffNames }));
        }
        setSyncStatus('success');
      } else {
        throw new Error("รูปแบบข้อมูลจากตารางไม่ถูกต้อง");
      }
    } catch (error) {
      console.warn("Fetch Error:", error.message);
      setSyncStatus('error');
      setSheetError(error.message);
      
      // ดึงข้อมูลสำรองมาแสดง ถ้าเชื่อมต่อ Cloud ไม่ได้
      const cachedLogs = localStorage.getItem('waterQC_LogsCache');
      const cachedStaff = localStorage.getItem('waterQC_StaffCache');
      if (cachedLogs) setLogs(JSON.parse(cachedLogs));
      if (cachedStaff) setSettings(JSON.parse(cachedStaff));
      
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsFromSheets();
  }, []);

  // บันทึกผลตรวจ
  const handleAddLog = async (formData) => {
    const phVal = parseFloat(formData.ph);
    const tdsVal = parseFloat(formData.tds);
    const needsCriticalAlert = (phVal < STANDARDS.alert_ph_min || phVal > STANDARDS.alert_ph_max || tdsVal > STANDARDS.alert_tds);
    const isPassedNormal = (phVal >= STANDARDS.ph.min && phVal <= STANDARDS.ph.max && tdsVal <= STANDARDS.tds.max);

    const newLogEntry = {
      ...formData,
      status: isPassedNormal ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์",
      critical_alert: needsCriticalAlert,
    };

    // อัปเดตหน้าจอทันที ไม่ต้องรอโหลด
    const newLogs = [newLogEntry, ...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    setLogs(newLogs);
    localStorage.setItem('waterQC_LogsCache', JSON.stringify(newLogs));
    setActiveTab('dashboard');

    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', data: newLogEntry })
      });
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถอัปโหลดข้อมูลขึ้น Cloud ได้ ข้อมูลถูกบันทึกไว้ในเครื่องนี้แล้ว");
    }
  };

  // อัปเดตรายชื่อ
  const updateStaff = async (newStaffList) => {
    setSettings({ staffNames: newStaffList }); 
    localStorage.setItem('waterQC_StaffCache', JSON.stringify({ staffNames: newStaffList }));
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', data: { staffNames: newStaffList } })
      });
    } catch (err) {
      console.error(err);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-x-hidden">
      <header className="md:hidden bg-[#002D62] text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#002D62] font-black">LH</div>
          <span className="font-bold text-sm">Water Quality Monitoring</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

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
          <div className="flex justify-between items-center mb-1">
            <span className="flex items-center gap-1">
              <Database size={12}/> {syncStatus === 'success' ? 'ออนไลน์ (ข้อมูลแชร์กับทุกคน)' : syncStatus === 'error' ? 'ออฟไลน์ (เชื่อมต่อชีตไม่ได้)' : 'กำลังเชื่อมต่อ...'}
            </span>
            {isAuthorized && <button onClick={() => setIsAuthorized(false)} title="Admin Logout" className="hover:text-white transition-colors"><Lock size={12}/></button>}
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

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

      <main className="flex-1 p-4 md:p-10 w-full overflow-x-hidden print:p-0 print:bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
             <Loader2 size={40} className="animate-spin text-[#002D62] mb-4" />
             <p className="text-[#002D62] font-bold">กำลังดึงข้อมูลจาก Google Sheets...</p>
          </div>
        )}
        
        {sheetError && (
          <div className="max-w-7xl mx-auto mb-6 bg-red-50 border-l-4 border-red-500 p-4 sm:p-5 rounded-r-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
              <div>
                <h3 className="text-red-800 font-bold">การดึงข้อมูลจาก Cloud ล้มเหลว</h3>
                <p className="text-red-600 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl">{sheetError}</p>
                <p className="text-red-500 text-xs mt-2 font-bold italic">*ขณะนี้ระบบกำลังแสดงผลด้วยข้อมูลสำรองล่าสุดในเครื่องนี้เท่านั้น</p>
              </div>
            </div>
            <button onClick={fetchLogsFromSheets} className="shrink-0 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors w-full sm:w-auto justify-center">
              <RefreshCw size={16} /> ซิงค์ใหม่
            </button>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard logs={logs} period={chartPeriod} setPeriod={setChartPeriod} hasError={syncStatus === 'error'} />}
          {activeTab === 'form' && <EntryForm onSubmit={handleAddLog} staffNames={settings.staffNames} />}
          {activeTab === 'report' && <ReportView logs={logs} sheetUrl={GOOGLE_SHEETS_DIRECT_URL} />}
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
function Dashboard({ logs, period, setPeriod, hasError }) {
  const stats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period);
    
    // กรองข้อมูลตามระยะเวลาที่เลือก (3 หรือ 6 เดือน)
    const periodLogs = logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false;
      return d >= cutoffDate; 
    });
    
    // 1. จำนวนโครงการที่ตรวจ (โครงการที่ไม่ซ้ำกัน)
    const uniqueLocations = new Set(periodLogs.map(l => l.location ? l.location.trim() : "").filter(Boolean)).size;
    
    // 2. จำนวนบ่อบำบัดที่ตรวจ (นับรายการทั้งหมด)
    const totalInspections = periodLogs.length;

    // 3. จำนวนที่ไม่ผ่านเกณฑ์
    const failedCount = periodLogs.filter(l => 
      parseFloat(l.ph) < STANDARDS.ph.min || 
      parseFloat(l.ph) > STANDARDS.ph.max || 
      parseFloat(l.tds) > STANDARDS.tds.max
    ).length;
    
    return { uniqueLocations, totalInspections, failedCount };
  }, [logs, period]);

  const chartData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period);
    
    const periodLogs = logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false;
      return d >= cutoffDate; 
    });

    // นำข้อมูลมาพล็อตเรียงตามเวลา
    return periodLogs.sort((a, b) => new Date(a.date) - new Date(b.date)).map(l => ({ 
      name: new Date(l.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) === 'Invalid Date' ? l.date : new Date(l.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }), 
      ph: parseFloat(l.ph) || 0, 
      tds: parseFloat(l.tds) || 0 
    }));
  }, [logs, period]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-[#002D62]">ภาพรวมคุณภาพน้ำ</h2>
        <div className="flex bg-white rounded-lg shadow-sm border p-1 w-full sm:w-auto">
          {[3, 6].map(m => (<button key={m} onClick={() => setPeriod(m)} className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold ${period === m ? 'bg-[#002D62] text-white' : 'text-gray-500'}`}>{m} เดือน</button>))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="โครงการที่ตรวจ" value={stats.uniqueLocations} description={`ในช่วง ${period} เดือนย้อนหลัง`} icon={<LayoutDashboard className="text-[#002D62]" />} color="border-[#002D62]" />
        <StatCard title="บ่อบำบัดที่ตรวจ" value={stats.totalInspections} description={`จำนวนการบันทึกผลทั้งหมด`} icon={<ClipboardList className="text-blue-500" />} color="border-blue-500" />
        <StatCard title="ไม่ผ่านเกณฑ์" value={stats.failedCount} total={stats.totalInspections} description={`จำนวนที่ไม่ผ่านมาตรฐาน`} icon={<AlertCircle className="text-red-500" />} color="border-red-500" />
        <StatCard 
          title="เซิร์ฟเวอร์ (Sheets)" 
          value={hasError ? "ออฟไลน์" : "ออนไลน์"} 
          description={hasError ? "ใช้ข้อมูลในเครื่อง" : "ข้อมูลซิงค์เรียลไทม์"} 
          icon={hasError ? <XCircle className="text-red-500" /> : <Database className="text-[#16A34A]" />} 
          color={hasError ? "border-red-500" : "border-[#16A34A]"} 
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        <ChartBox title={`แนวโน้มค่า pH (${period} เดือน)`} data={chartData} dataKey="ph" limits={[STANDARDS.ph.min, STANDARDS.ph.max]} color="#002D62" yDomain={[0, 14]} />
        <ChartBox title={`แนวโน้มค่า TDS (${period} เดือน)`} data={chartData} dataKey="tds" limits={[STANDARDS.tds.max]} color="#B8904F" yDomain={[0, 1500]} />
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
          {data.length > 0 ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} />
              <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px' }} domain={yDomain} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              {limits.map((limit, idx) => (<ReferenceLine key={idx} y={limit} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'right', value: `เกณฑ์ ${limit}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />))}
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm italic">ไม่มีข้อมูลแสดงผล</div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Report View Component ---
function ReportView({ logs, sheetUrl }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const filteredLogs = useMemo(() => {
    return logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false; 
      return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear); 
    });
  }, [logs, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-[#002D62]">รายงานสรุปคุณภาพน้ำ</h2>
          <p className="text-sm text-gray-500">ข้อมูลจะบันทึกลงตาราง Google Sheets ทุกครั้งที่มีการกรอกผล</p>
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
        
        <button onClick={() => window.open(sheetUrl, '_blank')} className="flex items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 text-gray-600 p-4 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm">
          <Database size={20} className="text-[#002D62]" /> 
          <span>จัดการข้อมูลในชีต</span>
        </button>

        <button onClick={() => window.open(sheetUrl, '_blank')} className="flex items-center justify-center gap-3 bg-[#16A34A] text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-[#15803d] transition-all">
          <Share2 size={20} /> เปิดตารางตัวเต็ม
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
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-medium italic">ยังไม่มีข้อมูลในเดือนนี้</td></tr>
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

  useEffect(() => {
    if (staffNames.length > 0 && (!formData.recorder || !staffNames.includes(formData.recorder))) {
      setFormData(p => ({ ...p, recorder: staffNames[0] }));
    }
  }, [staffNames, formData.recorder]);

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

  const phVal = parseFloat(formData.ph);
  const tdsVal = parseFloat(formData.tds);
  const isCritical = (phVal < STANDARDS.alert_ph_min || phVal > STANDARDS.alert_ph_max || tdsVal > STANDARDS.alert_tds);

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-[#002D62] p-8 md:p-10 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3"><PlusCircle size={28} className="text-[#B8904F]" /> บันทึกผลการตรวจคุณภาพน้ำ</h2>
            <p className="text-blue-200 mt-1 opacity-80 text-xs md:text-sm">ข้อมูลบันทึกและแชร์ให้ทุกคนเห็นอัตโนมัติผ่าน Google Sheets</p>
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
                {staffNames.length > 0 ? staffNames.map(s => <option key={s} value={s}>{s}</option>) : <option value="">กำลังโหลด...</option>}
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
            <CheckCircle2 size={24} /> ยืนยันบันทึกผลไปยังระบบ Cloud
          </button>
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-red-500">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner"><AlertCircle size={32} /></div>
            <h3 className="text-xl font-bold text-center text-gray-800 mb-2">ตรวจพบค่าที่ตกเกณฑ์</h3>
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