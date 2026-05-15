/* eslint-disable no-undef */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  LayoutDashboard, ClipboardList, Settings as SettingsIcon, PlusCircle, AlertCircle, CheckCircle2, 
  XCircle, User, FileText, Download, Share2, Menu, X, Printer, Lock, Loader2, Database, Upload, Info, RefreshCw, AlertTriangle, Pencil, Trash2
} from 'lucide-react';

// ----------------------------------------------------------------------
// 🔥 ตั้งค่า Google Sheets Webhook URL (นำ URL ใหม่มาใส่ที่นี่!)
// ----------------------------------------------------------------------
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyBJbccynt4MhK62bW6x-aygqQRBdyWLDix9Ll_ab4L2rRC9dlpEUVzzajD-1Ad5kR_NA/exec";
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
  const [syncStatus, setSyncStatus] = useState('loading');
  const [sheetError, setSheetError] = useState(null);
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);

  const fetchLogsFromSheets = async () => {
    try {
      setIsLoading(true);
      setSyncStatus('loading');
      setSheetError(null);
      
      const urlWithTimestamp = `${GOOGLE_SHEETS_WEBHOOK_URL}?t=${new Date().getTime()}`;
      const response = await fetch(urlWithTimestamp);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("การเชื่อมต่อถูกบล็อก: URL หมดอายุ หรือไม่ได้ตั้งค่าสิทธิ์ให้ 'ทุกคน (Anyone)' เข้าถึง Web App");
      }
      
      if (result && result.status === 'success') {
        if (result.data) {
          const sortedData = result.data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setLogs(sortedData);
          localStorage.setItem('waterQC_LogsCache', JSON.stringify(sortedData)); 
        }
        if (result.settings && result.settings.staffNames) {
          setSettings({ staffNames: result.settings.staffNames });
          localStorage.setItem('waterQC_StaffCache', JSON.stringify({ staffNames: result.settings.staffNames }));
        }
        setSyncStatus('success');
      } else {
        throw new Error(result.message || "รูปแบบข้อมูลจากตารางไม่ถูกต้อง");
      }
    } catch (error) {
      console.warn("Fetch Error:", error.message);
      setSyncStatus('error');
      setSheetError(error.message);
      
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

    const newLogs = [newLogEntry, ...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    setLogs(newLogs);
    localStorage.setItem('waterQC_LogsCache', JSON.stringify(newLogs));
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST', mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', data: newLogEntry })
      });
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถอัปโหลดข้อมูลขึ้น Cloud ได้ ข้อมูลถูกบันทึกไว้ในเครื่องนี้แล้ว");
    }
  };

  const handleEditLog = async (originalLog, newLogData) => {
    const phVal = parseFloat(newLogData.ph);
    const tdsVal = parseFloat(newLogData.tds);
    const isPassedNormal = (phVal >= STANDARDS.ph.min && phVal <= STANDARDS.ph.max && tdsVal <= STANDARDS.tds.max);
    
    const updatedLogEntry = {
      ...newLogData,
      status: isPassedNormal ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์",
    };

    setLogs(prev => {
      const newLogs = [...prev];
      const idx = newLogs.findIndex(l => l.date === originalLog.date && l.location === originalLog.location && l.poolNo === originalLog.poolNo && l.ph === originalLog.ph && l.tds === originalLog.tds);
      if(idx !== -1) newLogs[idx] = updatedLogEntry;
      return newLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'edit', originalData: originalLog, data: updatedLogEntry })
      });
      setTimeout(() => fetchLogsFromSheets(), 2000);
    } catch(e) { console.error(e); }
  };

  const handleDeleteLog = async (logToDelete) => {
    setLogs(prev => prev.filter(l => !(l.date === logToDelete.date && l.location === logToDelete.location && l.poolNo === logToDelete.poolNo && l.ph === logToDelete.ph && l.tds === logToDelete.tds)));
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'delete', originalData: logToDelete })
      });
      setTimeout(() => fetchLogsFromSheets(), 2000);
    } catch(e) { console.error(e); }
  };

  const updateStaff = async (newStaffList) => {
    setSettings({ staffNames: newStaffList }); 
    localStorage.setItem('waterQC_StaffCache', JSON.stringify({ staffNames: newStaffList }));
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', data: { staffNames: newStaffList } })
      });
    } catch (err) { console.error(err); }
  };

  const handleImportData = async (importedLogs, onProgress) => {
    try {
      if (onProgress) onProgress(0, importedLogs.length);
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'batch_add', data: importedLogs })
      });
      if (onProgress) onProgress(importedLogs.length, importedLogs.length);
      setTimeout(() => fetchLogsFromSheets(), 2000); 
      return true;
    } catch (err) { return false; }
  };

  const handleTabChange = (tabId) => {
    if ((tabId === 'report' || tabId === 'settings') && !isAuthorized) {
      setPendingTab(tabId);
      setShowPasswordInput(true);
      setIsSidebarOpen(false);
    } else {
      setActiveTab(tabId);
      setIsSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      {/* Mobile Header (Sticky & Responsive) */}
      <header className="md:hidden bg-[#002D62] text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#002D62] font-black text-sm">LH</div>
          <span className="font-bold text-sm tracking-wide">Water Quality</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -mr-2 active:scale-90 transition-transform">
          {isSidebarOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </header>

      {/* Sidebar (Responsive Overlay on Mobile) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-[#002D62] text-white flex flex-col shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:h-screen print:hidden`}>
        <div className="p-6 md:p-8 border-b border-blue-900/50 mt-14 md:mt-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#002D62] font-black text-xl shadow-inner">LH</div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">Water Quality</h1>
          </div>
          <p className="text-blue-300 text-[10px] md:text-xs uppercase tracking-widest font-semibold">Monitoring System</p>
        </div>
        <nav className="flex-1 p-4 md:p-6 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <NavItem icon={<ClipboardList size={20} />} label="บันทึกผลการตรวจ" active={activeTab === 'form'} onClick={() => handleTabChange('form')} />
          <NavItem icon={<FileText size={20} />} label="รายงานรายเดือน" active={activeTab === 'report'} onClick={() => handleTabChange('report')} isLocked={!isAuthorized} />
          <NavItem icon={<SettingsIcon size={20} />} label="ตั้งค่าผู้ใช้งาน" active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} isLocked={!isAuthorized} />
        </nav>
        <div className="p-4 md:p-6 bg-blue-950/40 text-[10px] text-blue-400 border-t border-blue-900/50 italic flex flex-col gap-1">
          <div className="flex justify-between items-center mb-1">
            <span className="flex items-center gap-1.5 truncate">
              <Database size={12}/> {syncStatus === 'success' ? 'ซิงค์ข้อมูลแล้ว' : syncStatus === 'error' ? 'เชื่อมต่อล้มเหลว' : 'กำลังเชื่อมต่อ...'}
            </span>
            {isAuthorized && <button onClick={() => setIsAuthorized(false)} title="Admin Logout" className="p-1 hover:text-white transition-colors bg-blue-900/50 rounded"><Lock size={12}/></button>}
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* Password Modal (Responsive) */}
      {showPasswordInput && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-50 text-[#002D62] rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto shadow-inner"><Lock size={28} /></div>
            <h3 className="text-lg md:text-xl font-bold text-center text-gray-800 mb-2">พื้นที่ส่วนบุคคล</h3>
            <p className="text-center text-gray-500 text-xs md:text-sm mb-6">กรุณากรอกรหัสผ่านเพื่อเข้าถึงหน้านี้</p>
            <form onSubmit={checkPassword} className="space-y-4">
              <input type="password" inputMode="numeric" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ระบุรหัสผ่าน" className={`w-full p-3 md:p-4 text-center text-xl md:text-2xl tracking-[1em] rounded-2xl border-2 outline-none transition-all ${passError ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 focus:border-[#002D62]'}`} />
              {passError && <p className="text-red-500 text-xs text-center font-bold">รหัสผ่านไม่ถูกต้อง</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordInput(false)} className="flex-1 py-3 text-sm font-bold text-gray-400 active:scale-95 transition-transform">ยกเลิก</button>
                <button type="submit" className="flex-1 py-3 bg-[#002D62] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">ยืนยัน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area (Fluid & Responsive) */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 w-full overflow-x-hidden print:p-0 print:bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
             <Loader2 size={40} className="animate-spin text-[#002D62] mb-4" />
             <p className="text-[#002D62] font-bold text-sm">กำลังดึงข้อมูล...</p>
          </div>
        )}
        
        {/* Error Banner */}
        {sheetError && (
          <div className="max-w-7xl mx-auto mb-4 md:mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="text-red-800 font-bold text-sm">การดึงข้อมูลจาก Cloud ล้มเหลว</h3>
                <p className="text-red-600 text-[11px] sm:text-xs mt-1 leading-relaxed max-w-3xl line-clamp-2">{sheetError}</p>
              </div>
            </div>
            <button onClick={fetchLogsFromSheets} className="shrink-0 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors w-full sm:w-auto justify-center active:scale-95">
              <RefreshCw size={14} /> ลองใหม่
            </button>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard logs={logs} period={chartPeriod} setPeriod={setChartPeriod} hasError={syncStatus === 'error'} />}
          {activeTab === 'form' && <EntryForm onSubmit={handleAddLog} staffNames={settings.staffNames} />}
          {activeTab === 'report' && <ReportView logs={logs} sheetUrl={GOOGLE_SHEETS_DIRECT_URL} staffNames={settings.staffNames} onImport={handleImportData} onEdit={handleEditLog} onDelete={handleDeleteLog} />}
          {activeTab === 'settings' && <SettingsView settings={settings} onUpdateStaff={updateStaff} />}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { body { background: white !important; } .print-hidden { display: none !important; } .print-only { display: block !important; } @page { margin: 1cm; } }
        /* Custom Scrollbar for better mobile/desktop feel */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px;} 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #002D62; }
      `}} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, isLocked }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 px-4 py-3 md:px-5 rounded-xl transition-all ${active ? 'bg-blue-700 text-white shadow-md ring-1 ring-blue-500/50' : 'text-blue-100 hover:bg-blue-800/50 active:bg-blue-800'}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-semibold text-sm md:text-base">{label}</span>
      </div>
      {isLocked && <Lock size={14} className="opacity-40" />}
    </button>
  );
}

function Dashboard({ logs, period, setPeriod, hasError }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const stats = useMemo(() => {
    const monthlyLogs = logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false;
      return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear); 
    });
    
    const uniqueLocations = new Set(monthlyLogs.map(l => l.location ? l.location.trim() : "").filter(Boolean)).size;
    const totalInspections = monthlyLogs.length;

    const failedLogs = monthlyLogs.filter(l => 
      parseFloat(l.ph) < STANDARDS.ph.min || parseFloat(l.ph) > STANDARDS.ph.max || parseFloat(l.tds) > STANDARDS.tds.max
    );
    const uniqueFailedLocations = new Set(failedLogs.map(l => l.location ? l.location.trim() : "").filter(Boolean)).size;
    
    return { uniqueLocations, totalInspections, failedCount: uniqueFailedLocations };
  }, [logs, selectedMonth, selectedYear]);

  const chartData = useMemo(() => {
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0, 23, 59, 59);
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - period + 1, 1);
    
    const periodLogs = logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false;
      return d >= startDate && d <= endDate; 
    });

    const groupedData = {};
    periodLogs.forEach(l => {
      const d = new Date(l.date);
      const monthYear = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      const sortKey = `${d.getFullYear()}${String(d.getMonth()).padStart(2, '0')}`;
      
      if (!groupedData[monthYear]) {
        groupedData[monthYear] = { name: monthYear, sortKey: sortKey, phSum: 0, tdsSum: 0, count: 0 };
      }
      groupedData[monthYear].phSum += parseFloat(l.ph) || 0;
      groupedData[monthYear].tdsSum += parseFloat(l.tds) || 0;
      groupedData[monthYear].count += 1;
    });

    return Object.values(groupedData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(item => ({
        name: item.name,
        ph: Number((item.phSum / item.count).toFixed(2)),
        tds: Number((item.tdsSum / item.count).toFixed(0))
      }));
  }, [logs, period, selectedMonth, selectedYear]);

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#002D62]">ภาพรวมคุณภาพน้ำ</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full xl:w-auto">
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="flex-1 sm:flex-none p-2 sm:p-2.5 rounded-lg border-gray-200 bg-white border text-sm font-semibold outline-none focus:border-[#002D62] shadow-sm">
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="flex-1 sm:flex-none p-2 sm:p-2.5 rounded-lg border-gray-200 bg-white border text-sm font-semibold outline-none focus:border-[#002D62] shadow-sm">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex bg-white rounded-lg shadow-sm border p-1 w-full sm:w-auto">
            {[3, 6].map(m => (
              <button key={m} onClick={() => setPeriod(m)} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold transition-colors ${period === m ? 'bg-[#002D62] text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                กราฟ {m} เดือน
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        <StatCard title={`โครงการที่ตรวจ (${months[selectedMonth]})`} value={stats.uniqueLocations} description={`นับตามจำนวนโครงการ`} icon={<LayoutDashboard className="text-[#002D62] w-5 h-5 md:w-6 md:h-6" />} color="border-[#002D62]" />
        <StatCard title={`บ่อบำบัดที่ตรวจ (${months[selectedMonth]})`} value={stats.totalInspections} description={`จำนวนครั้งที่บันทึกผล`} icon={<ClipboardList className="text-blue-500 w-5 h-5 md:w-6 md:h-6" />} color="border-blue-500" />
        <StatCard title={`โครงการที่ไม่ผ่าน (${months[selectedMonth]})`} value={stats.failedCount} total={stats.uniqueLocations} description={`นับตามจำนวนโครงการ`} icon={<AlertCircle className="text-red-500 w-5 h-5 md:w-6 md:h-6" />} color="border-red-500" />
        <StatCard 
          title="เซิร์ฟเวอร์ (Sheets)" 
          value={hasError ? "ออฟไลน์" : "ออนไลน์"} 
          description={hasError ? "ใช้ข้อมูลในเครื่อง" : "ข้อมูลซิงค์เรียลไทม์"} 
          icon={hasError ? <XCircle className="text-red-500 w-5 h-5 md:w-6 md:h-6" /> : <Database className="text-[#16A34A] w-5 h-5 md:w-6 md:h-6" />} 
          color={hasError ? "border-red-500" : "border-[#16A34A]"} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        <ChartBox title={`แนวโน้มค่าเฉลี่ย pH (${period} เดือน)`} data={chartData} dataKey="ph" limits={[STANDARDS.ph.min, STANDARDS.ph.max]} color="#002D62" yDomain={[0, 14]} />
        <ChartBox title={`แนวโน้มค่าเฉลี่ย TDS (${period} เดือน)`} data={chartData} dataKey="tds" limits={[STANDARDS.tds.max]} color="#B8904F" yDomain={[0, 1500]} />
      </div>
    </div>
  );
}

function StatCard({ title, value, total, icon, color, description }) {
  return (
    <div className={`bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border-l-[6px] md:border-l-8 ${color}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-2">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider leading-tight">{title}</p>
          <div className="flex items-baseline gap-1.5 md:gap-2 mt-1 md:mt-2">
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 leading-none">{value}</span>
            {total !== undefined && <span className="text-gray-400 text-xs md:text-sm font-medium">/ {total}</span>}
          </div>
          {description && <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 md:mt-2 italic leading-tight truncate">{description}</p>}
        </div>
        <div className="bg-slate-50 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function ChartBox({ title, data, dataKey, limits, color, yDomain }) {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-700 mb-4 md:mb-6 flex items-center gap-2 text-xs sm:text-sm md:text-base">
        <div className="w-1 md:w-1.5 h-3 md:h-4 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
        <span className="truncate">{title}</span>
      </h3>
      <div className="h-48 sm:h-56 md:h-64 lg:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {data.length > 0 ? (
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} domain={yDomain} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} 
                formatter={(value) => [value, `ค่าเฉลี่ย ${dataKey.toUpperCase()}`]}
              />
              {limits.map((limit, idx) => (
                <ReferenceLine key={idx} y={limit} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'insideTopRight', value: `เกณฑ์ ${limit}`, fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} />
              ))}
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
            </LineChart>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs md:text-sm italic">ไม่มีข้อมูลสำหรับช่วงเวลานี้</div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReportView({ logs, sheetUrl, onImport, staffNames, onEdit, onDelete }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  
  const [editingLog, setEditingLog] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [deletingLog, setDeletingLog] = useState(null);

  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const filteredLogs = useMemo(() => {
    return logs.filter(l => { 
      const d = new Date(l.date); 
      if(isNaN(d.getTime())) return false; 
      return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear); 
    });
  }, [logs, selectedMonth, selectedYear]);

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    setImportMessage('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        const results = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',');
          if (cols.length >= 5) {
            results.push({
              date: (cols[0] || '').replace(/['"]/g, '').trim(),
              location: (cols[1] || '').replace(/['"]/g, '').trim(),
              poolNo: (cols[2] || '').replace(/['"]/g, '').trim() || '1',
              ph: (cols[3] || '').replace(/['"]/g, '').trim(),
              tds: (cols[4] || '').replace(/['"]/g, '').trim(),
              color: (cols[5] || 'ใส').replace(/['"]/g, '').trim(),
              odor: (cols[6] || 'ไม่มีกลิ่น').replace(/['"]/g, '').trim(),
              recorder: (cols[7] || '').replace(/['"]/g, '').trim(),
            });
          }
        }
        if (results.length === 0) {
          setImportMessage("ไม่พบข้อมูลที่ถูกต้องในไฟล์");
          setIsImporting(false);
          return;
        }
        const success = await onImport(results, null);
        if (success) setImportMessage(`นำเข้าข้อมูลสำเร็จ ${results.length} รายการ!`);
      } catch (err) {
        setImportMessage("เกิดข้อผิดพลาดในการนำเข้า กรุณาตรวจสอบไฟล์ CSV");
      } finally {
        setIsImporting(false);
        e.target.value = null; 
      }
    };
    reader.readAsText(file);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    onEdit(editingLog, editFormData);
    setEditingLog(null);
  };

  const handleDeleteConfirm = () => {
    onDelete(deletingLog);
    setDeletingLog(null);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 relative">
      {importMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-50 text-[#002D62] rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto"><Info size={28} /></div>
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2 md:mb-4">แจ้งเตือนระบบ</h3>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 leading-relaxed">{importMessage}</p>
            <button onClick={() => setImportMessage('')} className="w-full py-3 bg-[#002D62] hover:bg-[#003d82] text-white rounded-xl font-bold shadow-lg transition-all active:scale-95">ตกลง</button>
          </div>
        </div>
      )}

      {/* Edit Modal (Responsive) */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-2 sm:p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#002D62] p-4 md:p-6 text-white flex justify-between items-center shrink-0">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2"><Pencil size={18} className="text-[#B8904F]"/> แก้ไขข้อมูล</h3>
              <button type="button" onClick={() => setEditingLog(null)} className="p-1 hover:bg-blue-800 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-4 md:p-6">
              <form id="editForm" onSubmit={handleEditSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">วันที่</label><input type="date" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm" required /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">โครงการ</label><input type="text" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm" required /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">บ่อที่</label>
                    <select value={editFormData.poolNo} onChange={e => setEditFormData({...editFormData, poolNo: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm">
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">ผู้บันทึก</label>
                    <select value={editFormData.recorder} onChange={e => setEditFormData({...editFormData, recorder: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm">
                      {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">pH</label><input type="number" step="0.1" value={editFormData.ph} onChange={e => setEditFormData({...editFormData, ph: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 font-bold text-sm" required /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">TDS</label><input type="number" value={editFormData.tds} onChange={e => setEditFormData({...editFormData, tds: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 font-bold text-sm" required /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">ลักษณะสี</label>
                    <select value={editFormData.color || 'ใส'} onChange={e => setEditFormData({...editFormData, color: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm">
                      {['ใส', 'ขุ่นเล็กน้อย', 'ขุ่น'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">กลิ่น</label>
                    <select value={editFormData.odor || 'ไม่มีกลิ่น'} onChange={e => setEditFormData({...editFormData, odor: e.target.value})} className="w-full p-2.5 md:p-3 rounded-xl border bg-gray-50 outline-none focus:border-blue-500 text-sm">
                      {['ไม่มีกลิ่น', 'มีกลิ่นเล็กน้อย', 'มีกลิ่น'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex gap-3 p-4 md:p-6 border-t shrink-0 bg-gray-50">
              <button type="button" onClick={() => setEditingLog(null)} className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-gray-600 bg-white border shadow-sm hover:bg-gray-50 transition-colors active:scale-95">ยกเลิก</button>
              <button type="submit" form="editForm" className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-white bg-[#002D62] hover:bg-[#003d82] shadow-md transition-colors active:scale-95">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal (Responsive) */}
      {deletingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-sm md:max-w-md w-full shadow-2xl animate-in zoom-in-95 text-center border-t-[6px] md:border-t-8 border-red-500">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto"><Trash2 size={28} /></div>
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">ยืนยันการลบ</h3>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 leading-relaxed">ต้องการลบข้อมูลของ <strong>{deletingLog.location} (บ่อที่ {deletingLog.poolNo})</strong><br className="hidden md:block"/> วันที่ {deletingLog.date} ใช่หรือไม่?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingLog(null)} className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95">ยกเลิก</button>
              <button type="button" onClick={handleDeleteConfirm} className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-white bg-red-600 hover:bg-red-700 shadow-lg transition-colors active:scale-95">ลบถาวร</button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#002D62]">รายงานสรุปคุณภาพน้ำ</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">กรอง จัดการ และส่งออกข้อมูล</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="flex-1 min-w-[120px] p-2 md:p-2.5 rounded-lg border-gray-200 bg-slate-50 border text-xs sm:text-sm font-semibold outline-none focus:border-[#002D62]">
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="flex-1 min-w-[100px] p-2 md:p-2.5 rounded-lg border-gray-200 bg-slate-50 border text-xs sm:text-sm font-semibold outline-none focus:border-[#002D62]">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="hidden print:block text-center space-y-2 mb-8 border-b-2 border-[#002D62] pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#002D62]">รายงานผลการตรวจคุณภาพน้ำเสีย</h1>
        <p className="text-lg sm:text-xl font-semibold">ประจำเดือน {months[selectedMonth]} ปี พ.ศ. {parseInt(selectedYear) + 543}</p>
        <p className="text-xs sm:text-sm text-gray-500">พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}</p>
      </div>

      {/* Action Buttons (Responsive Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 print:hidden">
        <button onClick={() => window.print()} className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-[#002D62] text-white p-3 md:p-4 rounded-xl md:rounded-2xl font-bold shadow-md hover:bg-[#003d82] transition-colors active:scale-95 text-xs sm:text-sm">
          <Printer size={18} /> <span className="hidden sm:inline">พิมพ์ (PDF)</span><span className="sm:hidden">พิมพ์ PDF</span>
        </button>
        <button onClick={() => {
          const headers = ["วันที่", "โครงการ", "บ่อที่", "pH", "TDS", "สี", "กลิ่น", "ผู้บันทึก", "สถานะ"];
          const rows = filteredLogs.map(l => [l.date, l.location, l.poolNo || '1', l.ph, l.tds, l.color, l.odor, l.recorder, (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max) ? "ผ่าน" : "ไม่ผ่าน"]);
          const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = `Report_${months[selectedMonth]}_${selectedYear}.csv`; link.click();
        }} className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-[#B8904F] text-white p-3 md:p-4 rounded-xl md:rounded-2xl font-bold shadow-md hover:bg-[#a67d3e] transition-colors active:scale-95 text-xs sm:text-sm">
          <Download size={18} /> <span className="hidden sm:inline">ส่งออก (CSV)</span><span className="sm:hidden">CSV</span>
        </button>
        
        <label className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 text-gray-600 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold hover:bg-gray-50 cursor-pointer transition-colors shadow-sm relative overflow-hidden text-xs sm:text-sm active:scale-95">
          {isImporting ? (
            <>
              <Loader2 size={18} className="animate-spin text-[#002D62] relative z-10" /> 
              <span className="relative z-10 text-[#002D62]">รอสักครู่...</span>
            </>
          ) : (
            <>
              <Upload size={18} className="text-[#B8904F]" />
              <span className="hidden sm:inline">อัปโหลด (CSV)</span><span className="sm:hidden">นำเข้า</span>
              <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" disabled={isImporting} />
            </>
          )}
        </label>

        <button onClick={() => window.open(sheetUrl, '_blank')} className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-[#16A34A] text-white p-3 md:p-4 rounded-xl md:rounded-2xl font-bold shadow-md hover:bg-[#15803d] transition-colors active:scale-95 text-xs sm:text-sm">
          <Share2 size={18} /> <span className="hidden sm:inline">เปิดชีต (Sheets)</span><span className="sm:hidden">เปิดชีต</span>
        </button>
      </div>

      {/* Table (Responsive Scroll) */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm overflow-hidden border border-gray-100 print:shadow-none print:border-none">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 print:bg-gray-100 print:border-gray-300">
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase whitespace-nowrap">วันที่</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase whitespace-nowrap">โครงการ / บ่อ</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center">pH</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center">TDS</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center hidden sm:table-cell">สี</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center hidden sm:table-cell">กลิ่น</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center">สถานะ</th>
                <th className="p-3 md:p-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase text-center print:hidden">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 print:divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr><td colSpan="8" className="p-8 md:p-10 text-center text-gray-400 text-sm font-medium italic">ไม่มีข้อมูลในเดือนนี้</td></tr>
              ) : (
                filteredLogs.map((l, i) => {
                  const isPassed = (parseFloat(l.ph) >= STANDARDS.ph.min && parseFloat(l.ph) <= STANDARDS.ph.max && parseFloat(l.tds) <= STANDARDS.tds.max);
                  return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors print:hover:bg-transparent group">
                      <td className="p-3 md:p-4 text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">{l.date}</td>
                      <td className="p-3 md:p-4 text-xs sm:text-sm text-gray-600 max-w-[200px] truncate">
                        <span className="font-bold">{l.location}</span> 
                        {l.poolNo && <span className="ml-1.5 sm:ml-2 text-[10px] font-bold text-[#B8904F] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 whitespace-nowrap">บ่อ {l.poolNo}</span>}
                      </td>
                      <td className="p-3 md:p-4 text-xs sm:text-sm text-center font-mono">{l.ph}</td>
                      <td className="p-3 md:p-4 text-xs sm:text-sm text-center font-mono">{l.tds}</td>
                      <td className="p-3 md:p-4 text-xs sm:text-sm text-center hidden sm:table-cell">{l.color || '-'}</td>
                      <td className="p-3 md:p-4 text-xs sm:text-sm text-center hidden sm:table-cell">{l.odor || '-'}</td>
                      <td className="p-3 md:p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap ${isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isPassed ? 'ผ่าน' : 'ตกเกณฑ์'}
                        </span>
                      </td>
                      <td className="p-3 md:p-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1 sm:gap-2 lg:opacity-30 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditFormData(l); setEditingLog(l); }} className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors active:scale-95" title="แก้ไข">
                            <Pencil size={14} className="sm:w-4 sm:h-4" />
                          </button>
                          <button onClick={() => setDeletingLog(l)} className="p-1.5 sm:p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors active:scale-95" title="ลบข้อมูล">
                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
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
    if (name === 'ph' && (num < STANDARDS.ph.min || num > STANDARDS.ph.max)) msg = `อยู่นอกเกณฑ์ (${STANDARDS.ph.min} - ${STANDARDS.ph.max})`;
    if (name === 'tds' && num > STANDARDS.tds.max) msg = `เกินเกณฑ์ (1,000)`;
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
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-md overflow-hidden border border-gray-100">
        <div className="bg-[#002D62] p-6 md:p-10 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2 md:gap-3"><PlusCircle className="text-[#B8904F] w-6 h-6 md:w-7 md:h-7" /> บันทึกผลตรวจ</h2>
            <p className="text-blue-200 mt-1 opacity-90 text-[10px] sm:text-xs md:text-sm">ซิงค์อัตโนมัติผ่าน Google Sheets</p>
          </div>
          <ClipboardList className="opacity-20 hidden sm:block w-10 h-10 md:w-12 md:h-12" />
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <FormField label="วันที่ตรวจสอบ">
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-3 md:p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium text-sm md:text-base" required />
            </FormField>
            
            <FormField label="โครงการ">
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="ระบุชื่อโครงการ" className="w-full p-3 md:p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium text-sm md:text-base" required />
            </FormField>
            
            <FormField label="บ่อบำบัดจุดที่">
              <select name="poolNo" value={formData.poolNo} onChange={handleChange} className="w-full p-3 md:p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-bold text-center text-sm md:text-base">
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
            
            <FormField label="เจ้าหน้าที่ผู้ตรวจ">
              <select name="recorder" value={formData.recorder} onChange={handleChange} className="w-full p-3 md:p-3.5 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-bold text-sm md:text-base">
                {staffNames.length > 0 ? staffNames.map(s => <option key={s} value={s}>{s}</option>) : <option value="">กำลังโหลด...</option>}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 bg-blue-50/40 p-4 md:p-8 rounded-2xl md:rounded-3xl border border-blue-100 shadow-inner">
            <FormField label={`ค่า pH (เกณฑ์ ${STANDARDS.ph.min} - ${STANDARDS.ph.max})`} alert={alerts.ph}>
              <input type="number" step="0.1" name="ph" value={formData.ph} onChange={handleChange} className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all text-lg md:text-xl font-black shadow-sm ${alerts.ph ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} required />
            </FormField>
            <FormField label={`ค่า TDS (เกณฑ์ < 1,000)`} alert={alerts.tds}>
              <input type="number" name="tds" value={formData.tds} onChange={handleChange} className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all text-lg md:text-xl font-black shadow-sm ${alerts.tds ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white focus:ring-2 focus:ring-[#002D62]'}`} required />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-8">
            <RadioBox label="ลักษณะสี" name="color" options={['ใส', 'ขุ่นเล็กน้อย', 'ขุ่น']} value={formData.color} onChange={handleChange} />
            <RadioBox label="กลิ่น" name="odor" options={['ไม่มีกลิ่น', 'มีกลิ่นเล็กน้อย', 'มีกลิ่น']} value={formData.odor} onChange={handleChange} />
          </div>

          <button type="submit" className="w-full bg-[#002D62] hover:bg-[#003d82] text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-base md:text-lg shadow-lg md:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-3">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" /> ยืนยันบันทึกผล
          </button>
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-sm md:max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border-t-[6px] md:border-t-8 border-red-500">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto shadow-inner"><AlertCircle size={28} /></div>
            <h3 className="text-lg md:text-xl font-bold text-center text-gray-800 mb-2">ตรวจพบค่าที่ตกเกณฑ์</h3>
            <p className="text-sm md:text-base text-center text-gray-600 mb-6 md:mb-8 leading-relaxed">
              ค่าคุณภาพน้ำที่ระบุ <strong className="text-red-500">อยู่นอกเกณฑ์มาตรฐาน</strong>
              <br/>
              {isCritical && <span className="text-[10px] md:text-xs text-[#B8904F] mt-2 block bg-amber-50 p-2 rounded-lg font-bold">⚠️ จะมีการส่งอีเมลแจ้งเตือนวิกฤตไปที่ {STANDARDS.alert_email}</span>}
            </p>
            <div className="flex gap-3 md:gap-4">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-gray-500 bg-gray-100 hover:bg-gray-200 border transition-colors active:scale-95">ยกเลิก</button>
              <button onClick={() => { setShowConfirmModal(false); onSubmit(formData); }} className="flex-1 py-3 rounded-xl font-bold text-sm md:text-base text-white bg-red-600 hover:bg-red-700 shadow-md transition-all active:scale-95">ยืนยันบันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, alert }) { 
  return (
    <div className="space-y-1.5 md:space-y-2">
      <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      {children}
      {alert && <p className="text-red-500 text-[9px] md:text-[10px] font-bold flex items-center gap-1.5 animate-pulse italic"><AlertCircle size={10} className="md:w-3 md:h-3"/> {alert}</p>}
    </div>
  ); 
}

function RadioBox({ label, name, options, value, onChange }) { 
  return (
    <div className="space-y-3 md:space-y-4">
      <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="grid grid-cols-3 gap-1.5 md:gap-2">
        {options.map(opt => (
          <label key={opt} className={`flex flex-col items-center justify-center p-2.5 md:p-3 rounded-xl md:rounded-2xl border-2 cursor-pointer transition-all ${value === opt ? 'bg-[#002D62] border-[#002D62] text-white shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-500'}`}>
            <input type="radio" name={name} value={opt} checked={value === opt} onChange={onChange} className="hidden" />
            <span className="text-[10px] md:text-sm font-bold text-center leading-tight whitespace-nowrap">{opt}</span>
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
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-10 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-lg md:text-2xl font-bold text-[#002D62] mb-6 md:mb-8 flex items-center gap-2 md:gap-3"><User className="text-[#B8904F] w-6 h-6 md:w-8 md:h-8" /> จัดการรายชื่อเจ้าหน้าที่</h2>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mb-6 md:mb-8">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ระบุชื่อ-นามสกุล..." className="flex-1 p-3 md:p-4 rounded-xl border-gray-200 bg-slate-50 border focus:ring-2 focus:ring-[#002D62] outline-none font-medium text-sm md:text-base" />
          <button onClick={() => { if(name.trim()) { onUpdateStaff([...settings.staffNames, name.trim()]); setName(''); }}} className="bg-[#B8904F] text-white px-6 md:px-8 py-3 md:py-0 rounded-xl font-bold hover:shadow-md transition-all active:scale-95 text-sm md:text-base">เพิ่ม</button>
        </div>
        <div className="space-y-2 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
          {settings.staffNames.length === 0 ? (<p className="text-center text-gray-400 py-8 md:py-10 italic text-sm">ยังไม่มีรายชื่อเจ้าหน้าที่</p>) : (
            settings.staffNames.map((n, i) => (
              <div key={i} className="flex justify-between items-center p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-sm transition-all">
                <span className="font-semibold md:font-bold text-gray-700 text-sm md:text-base">{n}</span>
                <button onClick={() => onUpdateStaff(settings.staffNames.filter(x => x !== n))} className="text-red-300 hover:text-red-500 transition-colors p-1.5 md:p-2 active:scale-90"><XCircle size={20} className="md:w-6 md:h-6" /></button>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="bg-[#002D62] text-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-base md:text-lg font-bold mb-2 md:mb-3 flex items-center gap-2 text-[#B8904F]"><AlertCircle size={18} className="md:w-5 md:h-5"/> ระบบแจ้งเตือนพิเศษ</h3>
          <p className="text-blue-100 text-[11px] md:text-sm opacity-90 leading-relaxed">
            หากค่า pH {'<'} {STANDARDS.alert_ph_min} หรือ {'>'} {STANDARDS.alert_ph_max} หรือ TDS {'>'} {STANDARDS.alert_tds} <br className="hidden md:block"/>
            ระบบจะส่งแจ้งเตือนไปที่: <span className="font-bold underline text-white break-all">{STANDARDS.alert_email}</span> ทันที
          </p>
        </div>
        <div className="absolute -bottom-8 -right-8 md:-bottom-10 md:-right-10 opacity-5"><SettingsIcon size={120} className="md:w-44 md:h-44" /></div>
      </div>
    </div>
  );
}