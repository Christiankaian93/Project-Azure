import React, { useState, useMemo } from 'react';
import { AppState, VoidBillRecord, Staff } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'motion/react';
import ShareActions from './ShareActions';

interface Props {
  data: AppState;
  onUpdate?: ((updater: (prev: AppState) => AppState) => void) | ((key: keyof AppState, val: any) => void);
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  allMonthlyData?: Record<string, any>;
  filters?: { month?: string | number; year?: string | number; startDate?: string; endDate?: string; outlet?: string };
  selectedOutlet?: string;
  isRegionalView?: boolean;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const STANDARD_REASONS = [
  "Salah Input Menu / Item",
  "Tamu Batal Pesan (Cancel Order)",
  "Salah Meja / Salah Tagihan",
  "Double Input / Double Print",
  "Payment Error / Gagal Transaksi",
  "Discount Terlewat / Koreksi Promo",
  "Menu Habis / Void Kitchen",
  "Tamu Complain / Return Item",
  "Salah Ketik Harga / Qty",
  "Lainnya (Tulis Manual)"
];

const STANDARD_PICS = [
  "Cashier Shift 1",
  "Cashier Shift 2",
  "Supervisor on Duty",
  "MOD (Manager on Duty)",
  "Branch Manager",
  "Captain Service",
  "Head Waiter"
];

export const VoidBillModule: React.FC<Props> = ({
  data,
  onUpdate,
  showToast,
  allMonthlyData,
  filters,
  selectedOutlet,
  isRegionalView = false
}) => {
  const currentDate = new Date();
  const initialYear = filters?.year ? Number(filters.year) : currentDate.getFullYear();
  const initialMonth = filters?.month !== undefined ? Number(filters.month) : currentDate.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'LIST' | 'REKAPAN_STAFF' | 'REKAPAN_REASON'>('LIST');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<VoidBillRecord | null>(null);

  // Form Fields
  const [inputDate, setInputDate] = useState<string>(() => {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [inputStaffName, setInputStaffName] = useState<string>('');
  const [customStaffName, setCustomStaffName] = useState<string>('');
  const [inputPicName, setInputPicName] = useState<string>('');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputReason, setInputReason] = useState<string>(STANDARD_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [inputBillNumber, setInputBillNumber] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');

  // Delete Confirmation Modal
  const [recordToDelete, setRecordToDelete] = useState<VoidBillRecord | null>(null);

  // Resolve staff list strictly from manpower / staffList of this outlet
  const staffOptions = useMemo(() => {
    const names = new Set<string>();
    if (data.staffList && Array.isArray(data.staffList)) {
      data.staffList.forEach((s: Staff) => {
        if (s && s.name && s.name.trim()) names.add(s.name.trim());
      });
    }
    // Also include staff from manpowerData if available
    if (data.manpowerData && typeof data.manpowerData === 'object') {
      Object.values(data.manpowerData).forEach((mp: any) => {
        if (mp?.staffList && Array.isArray(mp.staffList)) {
          mp.staffList.forEach((s: any) => {
            if (s?.name && s.name.trim()) names.add(s.name.trim());
          });
        }
      });
    }
    return Array.from(names).sort();
  }, [data.staffList, data.manpowerData]);

  // Resolve monthly void records strictly for this outlet
  // ZERO leakage: only take records entered in this outlet
  const rawVoidBills = useMemo(() => {
    const targetDaily = data.dailyVoidBills || {};
    const records: VoidBillRecord[] = [];
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    Object.entries(targetDaily).forEach(([dStr, list]) => {
      if (dStr.startsWith(monthPrefix) && Array.isArray(list)) {
        list.forEach((item: any) => {
          if (item && typeof item === 'object') {
            records.push({
              id: item.id || `${dStr}_${Math.random()}`,
              date: item.date || dStr,
              staffName: item.staffName || 'Tidak Diketahui',
              picName: item.picName || '-',
              amount: Number(item.amount) || 0,
              reason: item.reason || 'Lainnya',
              billNumber: item.billNumber || '-',
              outlet: item.outlet || selectedOutlet || data.outlet || '',
              notes: item.notes || '',
              createdAt: item.createdAt || ''
            });
          }
        });
      }
    });

    return records.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.dailyVoidBills, selectedYear, selectedMonth, selectedOutlet, data.outlet]);

  // Filtered void bills based on search & reason filter
  const filteredVoidBills = useMemo(() => {
    return rawVoidBills.filter(rec => {
      if (selectedReasonFilter !== 'ALL' && rec.reason !== selectedReasonFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const staff = (rec.staffName || '').toLowerCase();
        const pic = (rec.picName || '').toLowerCase();
        const reason = (rec.reason || '').toLowerCase();
        const bill = (rec.billNumber || '').toLowerCase();
        const notes = (rec.notes || '').toLowerCase();
        return staff.includes(q) || pic.includes(q) || reason.includes(q) || bill.includes(q) || notes.includes(q);
      }
      return true;
    });
  }, [rawVoidBills, searchTerm, selectedReasonFilter]);

  // Statistics
  const totalVoidNominal = useMemo(() => {
    return rawVoidBills.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [rawVoidBills]);

  const totalVoidCount = rawVoidBills.length;

  const topReason = useMemo(() => {
    if (rawVoidBills.length === 0) return '-';
    const counts: Record<string, number> = {};
    rawVoidBills.forEach(r => {
      counts[r.reason] = (counts[r.reason] || 0) + 1;
    });
    let max = 0;
    let top = '-';
    Object.entries(counts).forEach(([rs, cnt]) => {
      if (cnt > max) {
        max = cnt;
        top = rs;
      }
    });
    return `${top} (${max}x)`;
  }, [rawVoidBills]);

  const topStaff = useMemo(() => {
    if (rawVoidBills.length === 0) return '-';
    const amounts: Record<string, { total: number; count: number }> = {};
    rawVoidBills.forEach(r => {
      if (!amounts[r.staffName]) amounts[r.staffName] = { total: 0, count: 0 };
      amounts[r.staffName].total += r.amount;
      amounts[r.staffName].count += 1;
    });
    let maxTot = 0;
    let topName = '-';
    Object.entries(amounts).forEach(([name, val]) => {
      if (val.total > maxTot) {
        maxTot = val.total;
        topName = `${name} (Rp ${val.total.toLocaleString('id-ID')})`;
      }
    });
    return topName;
  }, [rawVoidBills]);

  // Breakdown per staff
  const staffSummary = useMemo(() => {
    const map: Record<string, { staffName: string; totalAmount: number; count: number; reasons: Record<string, number> }> = {};
    rawVoidBills.forEach(r => {
      if (!map[r.staffName]) {
        map[r.staffName] = { staffName: r.staffName, totalAmount: 0, count: 0, reasons: {} };
      }
      map[r.staffName].totalAmount += r.amount;
      map[r.staffName].count += 1;
      map[r.staffName].reasons[r.reason] = (map[r.staffName].reasons[r.reason] || 0) + 1;
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawVoidBills]);

  // Breakdown per reason
  const reasonSummary = useMemo(() => {
    const map: Record<string, { reason: string; totalAmount: number; count: number }> = {};
    rawVoidBills.forEach(r => {
      if (!map[r.reason]) {
        map[r.reason] = { reason: r.reason, totalAmount: 0, count: 0 };
      }
      map[r.reason].totalAmount += r.amount;
      map[r.reason].count += 1;
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawVoidBills]);

  // Form Handlers
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setInputDate(() => {
      const yyyy = selectedYear;
      const mm = String(selectedMonth + 1).padStart(2, '0');
      const dd = String(new Date().getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });
    setInputStaffName(staffOptions[0] || '');
    setCustomStaffName('');
    setInputPicName('');
    setInputAmount('');
    setInputReason(STANDARD_REASONS[0]);
    setCustomReason('');
    setInputBillNumber('');
    setInputNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: VoidBillRecord) => {
    setEditingRecord(rec);
    setInputDate(rec.date);
    if (staffOptions.includes(rec.staffName)) {
      setInputStaffName(rec.staffName);
      setCustomStaffName('');
    } else {
      setInputStaffName('__CUSTOM__');
      setCustomStaffName(rec.staffName);
    }
    setInputPicName(rec.picName || '');
    setInputAmount(String(rec.amount || ''));
    if (STANDARD_REASONS.includes(rec.reason)) {
      setInputReason(rec.reason);
      setCustomReason('');
    } else {
      setInputReason('Lainnya (Tulis Manual)');
      setCustomReason(rec.reason);
    }
    setInputBillNumber(rec.billNumber && rec.billNumber !== '-' ? rec.billNumber : '');
    setInputNotes(rec.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveVoidRecord = (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedStaff = inputStaffName === '__CUSTOM__' ? customStaffName.trim() : inputStaffName.trim();
    if (!resolvedStaff) {
      showToast?.('Pilih atau masukkan Nama Staff terlebih dahulu!', 'error');
      return;
    }

    if (!inputPicName.trim()) {
      showToast?.('Nama PIC wajib diisi!', 'error');
      return;
    }

    const amountNum = parseFloat(inputAmount.replace(/[^0-9]/g, '')) || 0;
    if (amountNum <= 0) {
      showToast?.('Nominal transaksi void harus lebih dari 0!', 'error');
      return;
    }

    const resolvedReason = inputReason === 'Lainnya (Tulis Manual)'
      ? (customReason.trim() || 'Lainnya')
      : inputReason;

    const newRecord: VoidBillRecord = {
      id: editingRecord ? editingRecord.id : `void_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: inputDate,
      staffName: resolvedStaff,
      picName: inputPicName.trim(),
      amount: amountNum,
      reason: resolvedReason,
      billNumber: inputBillNumber.trim() || '-',
      outlet: selectedOutlet || data.outlet || '',
      notes: inputNotes.trim(),
      createdAt: editingRecord ? editingRecord.createdAt : new Date().toISOString()
    };

    // Update dailyVoidBills in data
    const currentDaily = { ...(data.dailyVoidBills || {}) };
    
    // If editing and date changed, remove from old date
    if (editingRecord && editingRecord.date !== inputDate) {
      if (currentDaily[editingRecord.date]) {
        currentDaily[editingRecord.date] = currentDaily[editingRecord.date].filter(r => r.id !== editingRecord.id);
        if (currentDaily[editingRecord.date].length === 0) {
          delete currentDaily[editingRecord.date];
        }
      }
    }

    const targetList = [...(currentDaily[inputDate] || [])];
    const existingIdx = targetList.findIndex(r => r.id === newRecord.id);
    if (existingIdx >= 0) {
      targetList[existingIdx] = newRecord;
    } else {
      targetList.unshift(newRecord);
    }
    currentDaily[inputDate] = targetList;

    // Apply update to AppState
    if (typeof onUpdate === 'function') {
      try {
        (onUpdate as any)('dailyVoidBills', currentDaily);
      } catch {
        (onUpdate as any)((prev: AppState) => ({
          ...prev,
          dailyVoidBills: currentDaily
        }));
      }
    }

    showToast?.(editingRecord ? 'Catatan Void Bill berhasil diperbarui!' : 'Catatan Void Bill berhasil ditambahkan!', 'success');
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleConfirmDelete = () => {
    if (!recordToDelete) return;
    const currentDaily = { ...(data.dailyVoidBills || {}) };
    if (currentDaily[recordToDelete.date]) {
      currentDaily[recordToDelete.date] = currentDaily[recordToDelete.date].filter(r => r.id !== recordToDelete.id);
      if (currentDaily[recordToDelete.date].length === 0) {
        delete currentDaily[recordToDelete.date];
      }
    }

    if (typeof onUpdate === 'function') {
      try {
        (onUpdate as any)('dailyVoidBills', currentDaily);
      } catch {
        (onUpdate as any)((prev: AppState) => ({
          ...prev,
          dailyVoidBills: currentDaily
        }));
      }
    }

    showToast?.('Catatan Void Bill berhasil dihapus!', 'info');
    setRecordToDelete(null);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (rawVoidBills.length === 0) {
      showToast?.('Tidak ada data void bill untuk diekspor pada periode ini.', 'error');
      return;
    }

    try {
      const wb = new ExcelJS.Workbook();
      const monthTitle = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
      const outletTitle = selectedOutlet || data.outlet || 'OUTLET';

      // Sheet 1: Detail Transaksi
      const wsDetail = wb.addWorksheet('Detail Void Bill');
      wsDetail.addRow([`LAPORAN CATATAN VOID BILL - ${outletTitle}`]);
      wsDetail.addRow([`Periode: ${monthTitle}`]);
      wsDetail.addRow([`Total Nominal: Rp ${totalVoidNominal.toLocaleString('id-ID')} | Total Transaksi: ${totalVoidCount}`]);
      wsDetail.addRow([]);

      wsDetail.addRow(['NO', 'TANGGAL', 'NO. BILL', 'NAMA STAFF', 'NAMA PIC', 'NOMINAL TRANSAKSI', 'REASON', 'CATATAN TAMBAHAN']);
      
      filteredVoidBills.forEach((r, idx) => {
        wsDetail.addRow([
          idx + 1,
          r.date,
          r.billNumber || '-',
          r.staffName,
          r.picName,
          r.amount,
          r.reason,
          r.notes || '-'
        ]);
      });

      // Sheet 2: Rekapan Per Staff
      const wsStaff = wb.addWorksheet('Rekapan Per Staff');
      wsStaff.addRow([`REKAPAN VOID BILL PER STAFF - ${outletTitle}`]);
      wsStaff.addRow([`Periode: ${monthTitle}`]);
      wsStaff.addRow([]);
      wsStaff.addRow(['NO', 'NAMA STAFF', 'TOTAL TRANSAKSI', 'TOTAL NOMINAL VOID', 'RINCIAN ALASAN']);
      
      staffSummary.forEach((s, idx) => {
        const reasonsStr = Object.entries(s.reasons).map(([rs, c]) => `${rs} (${c}x)`).join(', ');
        wsStaff.addRow([
          idx + 1,
          s.staffName,
          s.count,
          s.totalAmount,
          reasonsStr
        ]);
      });

      // Sheet 3: Rekapan Per Reason
      const wsReason = wb.addWorksheet('Rekapan Per Reason');
      wsReason.addRow([`REKAPAN VOID BILL PER REASON - ${outletTitle}`]);
      wsReason.addRow([`Periode: ${monthTitle}`]);
      wsReason.addRow([]);
      wsReason.addRow(['NO', 'ALASAN VOID (REASON)', 'FREKUENSI', 'TOTAL NOMINAL VOID']);
      
      reasonSummary.forEach((r, idx) => {
        wsReason.addRow([
          idx + 1,
          r.reason,
          r.count,
          r.totalAmount
        ]);
      });

      // Style Header
      [wsDetail, wsStaff, wsReason].forEach(ws => {
        ws.columns.forEach(col => {
          col.width = 20;
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Void_Bill_${outletTitle.replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth + 1}.xlsx`);
      showToast?.('File Excel Laporan Void Bill berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast?.('Gagal mengekspor file Excel.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shadow-inner">
                <i className="fa-solid fa-ban text-2xl"></i>
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                  Catatan Void Bill
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {selectedOutlet || data.outlet || 'OUTLET'}
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Pencatatan data void transaksi outlet, nama staff manpower, PIC penanggung jawab, nominal transaksi dan alasan void.
                </p>
              </div>
            </div>
          </div>

          {/* Period Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm">
              <i className="fa-solid fa-calendar text-rose-400 text-xs"></i>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx} className="bg-slate-800 text-white">
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer ml-1"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(yr => (
                  <option key={yr} value={yr} className="bg-slate-800 text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span>Excel</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-900/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <i className="fa-solid fa-plus-circle text-sm"></i>
              <span>Catat Void Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Nominal Void</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <i className="fa-solid fa-money-bill-wave text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            Rp {totalVoidNominal.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-rose-400/80 mt-1 flex items-center gap-1">
            <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
            Bulan {MONTH_NAMES[selectedMonth]} {selectedYear}
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transaksi Void</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <i className="fa-solid fa-receipt text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            {totalVoidCount} <span className="text-sm font-normal text-slate-400">Transaksi</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Rata-rata: Rp {totalVoidCount > 0 ? Math.round(totalVoidNominal / totalVoidCount).toLocaleString('id-ID') : '0'} / void
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Alasan (Reason)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
            </div>
          </div>
          <div className="text-base font-bold text-indigo-300 truncate tracking-tight" title={topReason}>
            {topReason}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Frekuensi void tertinggi
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Nominal Tertinggi</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <i className="fa-solid fa-user-xmark text-sm"></i>
            </div>
          </div>
          <div className="text-base font-bold text-purple-300 truncate tracking-tight" title={topStaff}>
            {topStaff}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Berdasarkan nominal transaksi
          </p>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sub Tabs */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs font-medium">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'LIST'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-list"></i>
              <span>Daftar Transaksi ({filteredVoidBills.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('REKAPAN_STAFF')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'REKAPAN_STAFF'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-users"></i>
              <span>Rekapan Staff ({staffSummary.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('REKAPAN_REASON')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'REKAPAN_REASON'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-chart-pie"></i>
              <span>Rekapan Reason ({reasonSummary.length})</span>
            </button>
          </div>

          {/* Search & Filter Reason */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari Staff / PIC / Bill / Reason..."
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <select
              value={selectedReasonFilter}
              onChange={(e) => setSelectedReasonFilter(e.target.value)}
              className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Alasan (Reason)</option>
              {STANDARD_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Table based on Active Tab */}
      {activeTab === 'LIST' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4">TANGGAL</th>
                  <th className="py-3.5 px-4">NO. BILL</th>
                  <th className="py-3.5 px-4">NAMA STAFF (MANPOWER)</th>
                  <th className="py-3.5 px-4">NAMA PIC</th>
                  <th className="py-3.5 px-4 text-right">NOMINAL TRANSAKSI</th>
                  <th className="py-3.5 px-4">REASON (ALASAN VOID)</th>
                  <th className="py-3.5 px-4">CATATAN</th>
                  <th className="py-3.5 px-4 text-center w-24">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {filteredVoidBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-slate-700/40 flex items-center justify-center text-slate-500 text-2xl">
                          <i className="fa-solid fa-receipt"></i>
                        </div>
                        <p className="font-semibold text-sm text-slate-300">Belum ada catatan void bill</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Klik tombol &quot;Catat Void Baru&quot; di atas untuk mencatat data void bill transaksi outlet pada bulan {MONTH_NAMES[selectedMonth]} {selectedYear}.
                        </p>
                        <button
                          onClick={handleOpenAddModal}
                          className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
                        >
                          + Catat Void Baru
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVoidBills.map((rec, idx) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                        {rec.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-[11px] font-bold text-slate-300">
                          {rec.billNumber || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                            {rec.staffName.charAt(0).toUpperCase()}
                          </div>
                          <span>{rec.staffName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                          {rec.picName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-400 font-mono text-sm">
                        Rp {rec.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 text-[11px] font-medium inline-block">
                          {rec.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs max-w-xs truncate" title={rec.notes}>
                        {rec.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(rec)}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-indigo-600/60 text-slate-300 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                          <button
                            onClick={() => setRecordToDelete(rec)}
                            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-600/60 text-slate-300 hover:text-rose-200 transition-colors"
                            title="Hapus"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredVoidBills.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <td colSpan={5} className="py-3 px-4 text-right text-slate-300 uppercase tracking-wider">
                      TOTAL NOMINAL VOID ({filteredVoidBills.length} Transaksi):
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 font-mono text-base">
                      Rp {filteredVoidBills.reduce((acc, c) => acc + c.amount, 0).toLocaleString('id-ID')}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab: Rekapan Per Staff */}
      {activeTab === 'REKAPAN_STAFF' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-users text-rose-400"></i>
              Rekapan Void Bill Per Nama Staff Manpower
            </h3>
            <span className="text-xs text-slate-400">
              Total {staffSummary.length} Staff Tercatat
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">NO</th>
                  <th className="py-3 px-4">NAMA STAFF</th>
                  <th className="py-3 px-4 text-center">JUMLAH TRANSAKSI</th>
                  <th className="py-3 px-4 text-right">TOTAL NOMINAL VOID</th>
                  <th className="py-3 px-4">DETAIL REASON & FREKUENSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {staffSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Tidak ada rekapan staff untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  staffSummary.map((st, idx) => (
                    <tr key={st.staffName} className="hover:bg-slate-700/40 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                          {st.staffName.charAt(0).toUpperCase()}
                        </div>
                        {st.staffName}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-400">
                        {st.count}x
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-400 font-mono text-sm">
                        Rp {st.totalAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(st.reasons).map(([rs, c]) => (
                            <span key={rs} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300">
                              {rs} <b className="text-amber-400">({c})</b>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {staffSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <td colSpan={2} className="py-3 px-4 text-right text-slate-300 uppercase">
                      GRAND TOTAL:
                    </td>
                    <td className="py-3 px-4 text-center text-amber-400">
                      {staffSummary.reduce((acc, c) => acc + c.count, 0)}x
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 font-mono text-base">
                      Rp {staffSummary.reduce((acc, c) => acc + c.totalAmount, 0).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab: Rekapan Per Reason */}
      {activeTab === 'REKAPAN_REASON' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-chart-pie text-indigo-400"></i>
              Rekapan Void Bill Per Alasan (Reason)
            </h3>
            <span className="text-xs text-slate-400">
              Total {reasonSummary.length} Kategori Alasan
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">NO</th>
                  <th className="py-3 px-4">ALASAN (REASON)</th>
                  <th className="py-3 px-4 text-center">JUMLAH TRANSAKSI</th>
                  <th className="py-3 px-4 text-right">TOTAL NOMINAL VOID</th>
                  <th className="py-3 px-4 text-right">PERSENTASE (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {reasonSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Tidak ada rekapan alasan untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  reasonSummary.map((rs, idx) => {
                    const pct = totalVoidNominal > 0 ? ((rs.totalAmount / totalVoidNominal) * 100).toFixed(1) : '0';
                    return (
                      <tr key={rs.reason} className="hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200">
                            {rs.reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-400">
                          {rs.count}x
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-400 font-mono text-sm">
                          Rp {rs.totalAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-300">
                          <div className="flex items-center justify-end gap-2">
                            <span>{pct}%</span>
                            <div className="w-16 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-rose-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Number(pct))}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {reasonSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <td colSpan={2} className="py-3 px-4 text-right text-slate-300 uppercase">
                      GRAND TOTAL:
                    </td>
                    <td className="py-3 px-4 text-center text-amber-400">
                      {reasonSummary.reduce((acc, c) => acc + c.count, 0)}x
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 font-mono text-base">
                      Rp {reasonSummary.reduce((acc, c) => acc + c.totalAmount, 0).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Catatan Void */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-rose-950/60 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <i className="fa-solid fa-ban text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {editingRecord ? 'Edit Catatan Void Bill' : 'Catat Void Bill Baru'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedOutlet || data.outlet || 'OUTLET'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <form onSubmit={handleSaveVoidRecord} className="p-6 space-y-4 text-xs">
                {/* Tanggal & No Bill */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Tanggal Transaksi <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={inputDate}
                      onChange={(e) => setInputDate(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      No. Bill / Transaksi (Opsional)
                    </label>
                    <input
                      type="text"
                      value={inputBillNumber}
                      onChange={(e) => setInputBillNumber(e.target.value)}
                      placeholder="Contoh: #B-10492"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                </div>

                {/* Nama Staff (Manpower) */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Nama Staff (Diambil Dari Manpower) <span className="text-rose-400">*</span></span>
                    {staffOptions.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        {staffOptions.length} staff tersedia
                      </span>
                    )}
                  </label>
                  <select
                    value={inputStaffName}
                    onChange={(e) => setInputStaffName(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="" disabled>-- Pilih Nama Staff Manpower --</option>
                    {staffOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__CUSTOM__">+ Tulis Nama Staff Manual</option>
                  </select>

                  {inputStaffName === '__CUSTOM__' && (
                    <input
                      type="text"
                      value={customStaffName}
                      onChange={(e) => setCustomStaffName(e.target.value)}
                      placeholder="Masukkan nama staff manual..."
                      required
                      className="mt-2 w-full bg-slate-800 border border-rose-500/50 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  )}
                </div>

                {/* Nama PIC */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nama PIC (Penanggung Jawab Shift) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={inputPicName}
                    onChange={(e) => setInputPicName(e.target.value)}
                    placeholder="Contoh: MOD / Cashier 1 / Spv Budi"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {STANDARD_PICS.map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setInputPicName(p)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-300 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nominal Transaksi */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nominal Transaksi (Rp) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={inputAmount ? Number(inputAmount.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setInputAmount(raw);
                      }}
                      placeholder="0"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-white font-mono text-sm font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[50000, 100000, 250000, 500000, 1000000].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setInputAmount(String(amt))}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-300 font-mono transition-colors"
                      >
                        +{amt.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason (Alasan Void) */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Alasan Void (Reason) <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={inputReason}
                    onChange={(e) => setInputReason(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    {STANDARD_REASONS.map(rs => (
                      <option key={rs} value={rs}>{rs}</option>
                    ))}
                  </select>

                  {inputReason === 'Lainnya (Tulis Manual)' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Tulis alasan spesifik..."
                      required
                      className="mt-2 w-full bg-slate-800 border border-rose-500/50 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  )}
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Keterangan Tambahan / Detail Kronologi (Opsional)
                  </label>
                  <textarea
                    value={inputNotes}
                    onChange={(e) => setInputNotes(e.target.value)}
                    rows={2}
                    placeholder="Contoh: Tamu meja 12 cancel 1 porsi steak karena kelamaan..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  ></textarea>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-rose-900/40 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-floppy-disk"></i>
                    <span>{editingRecord ? 'Simpan Perubahan' : 'Simpan Catatan'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl p-6 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-2xl border border-rose-500/30 mb-4">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Hapus Catatan Void?</h3>
              <p className="text-xs text-slate-300 mb-4">
                Apakah Anda yakin ingin menghapus catatan void transaksi sebesar{' '}
                <b className="text-rose-400">Rp {recordToDelete.amount.toLocaleString('id-ID')}</b> dari staff{' '}
                <b className="text-white">{recordToDelete.staffName}</b>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setRecordToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-900/40 transition-all"
                >
                  Ya, Hapus Catatan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
