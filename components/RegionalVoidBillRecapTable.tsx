import React, { useState, useMemo } from 'react';
import { AppState, VoidBillRecord, Outlet } from '../types';
import { getActiveOutletNames, getAreaForOutlet, getActiveRegionalAreas, getDeletedOutletNames } from '../constants';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Props {
  allOutletsData: Record<string, any>;
  data?: AppState;
  selectedMonth: number;
  selectedYear: number;
  selectedArea?: string;
  selectedOutlet?: string;
  onSelectOutlet?: (outlet: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const RegionalVoidBillRecapTable: React.FC<Props> = ({
  allOutletsData,
  data,
  selectedMonth,
  selectedYear,
  selectedArea = 'ALL',
  selectedOutlet = '',
  onSelectOutlet,
  showToast
}) => {
  const [internalMonth, setInternalMonth] = useState<number>(selectedMonth);
  const [internalYear, setInternalYear] = useState<number>(selectedYear);
  const [internalArea, setInternalArea] = useState<string>(selectedArea || 'ALL');
  const [internalOutlet, setInternalOutlet] = useState<string>(selectedOutlet || 'ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'SUMMARY_OUTLET' | 'REKAPAN_STAFF_REASON' | 'DETAIL_TRANSAKSI'>('SUMMARY_OUTLET');

  // Filter out any deleted outlets strictly!
  const deletedSet = useMemo(() => new Set(getDeletedOutletNames()), []);
  const activeOutletsList = useMemo(() => {
    return getActiveOutletNames().filter(name => !deletedSet.has(name) && !allOutletsData?.[name]?.isDeleted);
  }, [allOutletsData, deletedSet]);

  const activeAreas = useMemo(() => {
    return getActiveRegionalAreas(activeOutletsList);
  }, [activeOutletsList]);

  // Target outlets based on Area & Outlet filter
  const displayedOutlets = useMemo(() => {
    let list = [...activeOutletsList];
    if (internalArea !== 'ALL' && activeAreas[internalArea]) {
      list = list.filter(o => activeAreas[internalArea].includes(o as Outlet));
    }
    if (internalOutlet && internalOutlet !== 'ALL') {
      list = list.filter(o => o === internalOutlet);
    }
    return list;
  }, [activeOutletsList, internalArea, internalOutlet, activeAreas]);

  // Extract void bills per outlet strictly from that outlet's own documents!
  // NO CROSS-OUTLET LEAKAGE: Empty outlets yield empty array []!
  const outletVoidDataMap = useMemo(() => {
    const map: Record<string, { outlet: string; records: VoidBillRecord[]; totalAmount: number; count: number; hasInput: boolean }> = {};
    const monthPrefix = `${internalYear}-${String(internalMonth + 1).padStart(2, '0')}`;

    activeOutletsList.forEach(outName => {
      const records: VoidBillRecord[] = [];
      const outDoc = allOutletsData?.[outName] || {};
      const mDoc = outDoc[String(internalMonth)] || outDoc[internalMonth] || outDoc.monthlyData?.[String(internalMonth)] || {};

      // Check dailyVoidBills in month doc first, then root doc
      const dailySource = mDoc.dailyVoidBills || outDoc.dailyVoidBills || null;

      if (dailySource && typeof dailySource === 'object') {
        Object.entries(dailySource).forEach(([dStr, list]: [string, any]) => {
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
                  outlet: outName,
                  notes: item.notes || '',
                  createdAt: item.createdAt || ''
                });
              }
            });
          }
        });
      }

      // If user is currently editing THIS outlet and has local state
      if (data && data.outlet === outName && data.dailyVoidBills) {
        Object.entries(data.dailyVoidBills).forEach(([dStr, list]) => {
          if (dStr.startsWith(monthPrefix) && Array.isArray(list)) {
            list.forEach((item: any) => {
              if (item && !records.some(r => r.id === item.id)) {
                records.push({
                  id: item.id || `${dStr}_${Math.random()}`,
                  date: item.date || dStr,
                  staffName: item.staffName || 'Tidak Diketahui',
                  picName: item.picName || '-',
                  amount: Number(item.amount) || 0,
                  reason: item.reason || 'Lainnya',
                  billNumber: item.billNumber || '-',
                  outlet: outName,
                  notes: item.notes || '',
                  createdAt: item.createdAt || ''
                });
              }
            });
          }
        });
      }

      const totalAmount = records.reduce((acc, c) => acc + (c.amount || 0), 0);
      map[outName] = {
        outlet: outName,
        records: records.sort((a, b) => b.date.localeCompare(a.date)),
        totalAmount,
        count: records.length,
        hasInput: records.length > 0
      };
    });

    return map;
  }, [activeOutletsList, allOutletsData, data, internalYear, internalMonth]);

  // Aggregate all records for filtered displayed outlets
  const allFilteredRecords = useMemo(() => {
    const list: VoidBillRecord[] = [];
    displayedOutlets.forEach(outName => {
      const info = outletVoidDataMap[outName];
      if (info && info.records) {
        list.push(...info.records);
      }
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return list.filter(r => {
        return (
          (r.outlet || '').toLowerCase().includes(q) ||
          (r.staffName || '').toLowerCase().includes(q) ||
          (r.picName || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q) ||
          (r.billNumber || '').toLowerCase().includes(q)
        );
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [displayedOutlets, outletVoidDataMap, searchTerm]);

  // Regional Statistics
  const grandTotalNominal = useMemo(() => {
    return displayedOutlets.reduce((acc, o) => acc + (outletVoidDataMap[o]?.totalAmount || 0), 0);
  }, [displayedOutlets, outletVoidDataMap]);

  const grandTotalCount = useMemo(() => {
    return displayedOutlets.reduce((acc, o) => acc + (outletVoidDataMap[o]?.count || 0), 0);
  }, [displayedOutlets, outletVoidDataMap]);

  const topOutlet = useMemo(() => {
    let max = 0;
    let top = '-';
    displayedOutlets.forEach(o => {
      const amt = outletVoidDataMap[o]?.totalAmount || 0;
      if (amt > max) {
        max = amt;
        top = `${o} (Rp ${amt.toLocaleString('id-ID')})`;
      }
    });
    return top;
  }, [displayedOutlets, outletVoidDataMap]);

  const topReason = useMemo(() => {
    const counts: Record<string, number> = {};
    allFilteredRecords.forEach(r => {
      counts[r.reason] = (counts[r.reason] || 0) + 1;
    });
    let max = 0;
    let top = '-';
    Object.entries(counts).forEach(([rs, cnt]) => {
      if (cnt > max) {
        max = cnt;
        top = `${rs} (${cnt}x)`;
      }
    });
    return top;
  }, [allFilteredRecords]);

  // Staff & Reason Breakdown: Grouped by Outlet + Staff + Reason
  const staffReasonRekapan = useMemo(() => {
    const map: Record<string, {
      outlet: string;
      staffName: string;
      picName: string;
      totalAmount: number;
      count: number;
      reasons: Record<string, number>;
    }> = {};

    allFilteredRecords.forEach(r => {
      const key = `${r.outlet}__${r.staffName}`;
      if (!map[key]) {
        map[key] = {
          outlet: r.outlet || '-',
          staffName: r.staffName,
          picName: r.picName || '-',
          totalAmount: 0,
          count: 0,
          reasons: {}
        };
      }
      map[key].totalAmount += r.amount;
      map[key].count += 1;
      map[key].reasons[r.reason] = (map[key].reasons[r.reason] || 0) + 1;
      if (r.picName && !map[key].picName.includes(r.picName)) {
        map[key].picName += `, ${r.picName}`;
      }
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allFilteredRecords]);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const monthTitle = `${MONTH_NAMES[internalMonth]} ${internalYear}`;

      // Sheet 1: Summary Outlet
      const wsOutlet = wb.addWorksheet('Summary Per Outlet');
      wsOutlet.addRow(['LAPORAN REKAPAN VOID BILL REGIONAL']);
      wsOutlet.addRow([`Periode: ${monthTitle}`]);
      wsOutlet.addRow([`Grand Total: Rp ${grandTotalNominal.toLocaleString('id-ID')} | Total Transaksi: ${grandTotalCount}`]);
      wsOutlet.addRow([]);
      wsOutlet.addRow(['NO', 'AREA', 'NAMA OUTLET', 'TOTAL TRANSAKSI', 'TOTAL NOMINAL VOID (RP)', 'STATUS PENGINPUTAN']);

      displayedOutlets.forEach((outName, idx) => {
        const info = outletVoidDataMap[outName];
        const area = getAreaForOutlet(outName);
        wsOutlet.addRow([
          idx + 1,
          area,
          outName,
          info?.count || 0,
          info?.totalAmount || 0,
          info?.hasInput ? 'Ada Transaksi Void' : 'Nol / Belum Ada Input'
        ]);
      });

      // Sheet 2: Rekapan Staff & Reason
      const wsStaff = wb.addWorksheet('Rekapan Staff & Reason');
      wsStaff.addRow(['REKAPAN VOID BILL PER NAMA STAFF DAN ALASAN (REASON)']);
      wsStaff.addRow([`Periode: ${monthTitle}`]);
      wsStaff.addRow([]);
      wsStaff.addRow(['NO', 'NAMA OUTLET', 'NAMA STAFF', 'NAMA PIC', 'TOTAL TRANSAKSI', 'TOTAL NOMINAL VOID', 'REKAPAN REASON']);

      staffReasonRekapan.forEach((row, idx) => {
        const reasonStr = Object.entries(row.reasons).map(([rs, c]) => `${rs} (${c}x)`).join(', ');
        wsStaff.addRow([
          idx + 1,
          row.outlet,
          row.staffName,
          row.picName,
          row.count,
          row.totalAmount,
          reasonStr
        ]);
      });

      // Sheet 3: Detail Transaksi
      const wsDetail = wb.addWorksheet('Detail Semua Transaksi');
      wsDetail.addRow(['DETAIL SELURUH TRANSAKSI VOID BILL']);
      wsDetail.addRow([`Periode: ${monthTitle}`]);
      wsDetail.addRow([]);
      wsDetail.addRow(['NO', 'NAMA OUTLET', 'TANGGAL', 'NO. BILL', 'NAMA STAFF', 'NAMA PIC', 'NOMINAL TRANSAKSI', 'REASON', 'CATATAN']);

      allFilteredRecords.forEach((r, idx) => {
        wsDetail.addRow([
          idx + 1,
          r.outlet,
          r.date,
          r.billNumber || '-',
          r.staffName,
          r.picName,
          r.amount,
          r.reason,
          r.notes || '-'
        ]);
      });

      [wsOutlet, wsStaff, wsDetail].forEach(ws => {
        ws.columns.forEach(col => { col.width = 20; });
      });

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekapan_Regional_Void_Bill_${internalYear}_${internalMonth + 1}.xlsx`);
      showToast?.('File Excel Rekapan Void Bill Regional berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast?.('Gagal mengekspor file Excel.', 'error');
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shadow-inner">
              <i className="fa-solid fa-ban text-2xl"></i>
            </span>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                Rekapan Void Bill Regional
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Regional Multi-Outlet
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Monitoring transaksi void bill di seluruh outlet, nama staff, PIC penanggung jawab, total nominal, dan rekapan breakdown per alasan void.
              </p>
            </div>
          </div>

          {/* Filters & Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Periode */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs">
              <i className="fa-solid fa-calendar text-rose-400"></i>
              <select
                value={internalMonth}
                onChange={(e) => setInternalMonth(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx} className="bg-slate-800 text-white">
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={internalYear}
                onChange={(e) => setInternalYear(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer ml-1"
              >
                {[internalYear - 1, internalYear, internalYear + 1].map(yr => (
                  <option key={yr} value={yr} className="bg-slate-800 text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Area */}
            <select
              value={internalArea}
              onChange={(e) => {
                setInternalArea(e.target.value);
                setInternalOutlet('ALL');
              }}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Area</option>
              {Object.keys(activeAreas).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Filter Outlet */}
            <select
              value={internalOutlet}
              onChange={(e) => setInternalOutlet(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Outlet</option>
              {(internalArea !== 'ALL' ? (activeAreas[internalArea] || []) : activeOutletsList).map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Regional Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Grand Total Void Regional</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <i className="fa-solid fa-money-bill-wave text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            Rp {grandTotalNominal.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-rose-400/80 mt-1">
            Bulan {MONTH_NAMES[internalMonth]} {internalYear}
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
            {grandTotalCount} <span className="text-sm font-normal text-slate-400">Transaksi</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dari {displayedOutlets.length} outlet yang dipantau
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Outlet Tertinggi Void</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <i className="fa-solid fa-store text-sm"></i>
            </div>
          </div>
          <div className="text-base font-bold text-indigo-300 truncate tracking-tight" title={topOutlet}>
            {topOutlet}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Berdasarkan akumulasi nominal
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Alasan Regional</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
            </div>
          </div>
          <div className="text-base font-bold text-purple-300 truncate tracking-tight" title={topReason}>
            {topReason}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Alasan paling sering terjadi
          </p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs font-medium">
            <button
              onClick={() => setActiveTab('SUMMARY_OUTLET')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'SUMMARY_OUTLET'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-table-list"></i>
              <span>Ringkasan Per Outlet ({displayedOutlets.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('REKAPAN_STAFF_REASON')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'REKAPAN_STAFF_REASON'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-users"></i>
              <span>Rekapan Staff & Reason ({staffReasonRekapan.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('DETAIL_TRANSAKSI')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'DETAIL_TRANSAKSI'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-list-check"></i>
              <span>Detail Transaksi ({allFilteredRecords.length})</span>
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari Outlet / Staff / PIC / Reason..."
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
        </div>
      </div>

      {/* Tab 1: Ringkasan Per Outlet */}
      {activeTab === 'SUMMARY_OUTLET' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4">AREA</th>
                  <th className="py-3.5 px-4">NAMA OUTLET</th>
                  <th className="py-3.5 px-4 text-center">TOTAL TRANSAKSI</th>
                  <th className="py-3.5 px-4 text-right">TOTAL NOMINAL VOID</th>
                  <th className="py-3.5 px-4 text-center">STATUS PENGINPUTAN</th>
                  <th className="py-3.5 px-4 text-center w-28">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {displayedOutlets.map((outName, idx) => {
                  const info = outletVoidDataMap[outName];
                  const area = getAreaForOutlet(outName);
                  const hasVoid = (info?.count || 0) > 0;

                  return (
                    <tr
                      key={outName}
                      className="hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-300">
                          {area}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        {outName}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {hasVoid ? (
                          <span className="text-amber-400 font-mono text-sm">{info.count} Transaksi</span>
                        ) : (
                          <span className="text-slate-500 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm">
                        {hasVoid ? (
                          <span className="text-rose-400">Rp {info.totalAmount.toLocaleString('id-ID')}</span>
                        ) : (
                          <span className="text-slate-500">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasVoid ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            Ada {info.count} Void
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-700/40 text-slate-400 border border-slate-600/30 text-[11px] font-medium inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            Nol / Kosong
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {onSelectOutlet && (
                          <button
                            onClick={() => onSelectOutlet(outName)}
                            className="px-2.5 py-1 rounded-lg bg-slate-700/60 hover:bg-rose-600/60 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
                          >
                            Buka Outlet
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                  <td colSpan={3} className="py-3.5 px-4 text-right text-slate-300 uppercase tracking-wider">
                    GRAND TOTAL REGIONAL ({displayedOutlets.length} Outlet):
                  </td>
                  <td className="py-3.5 px-4 text-center text-amber-400 font-mono text-sm">
                    {grandTotalCount} Transaksi
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-400 font-mono text-base">
                    Rp {grandTotalNominal.toLocaleString('id-ID')}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rekapan Staff & Reason */}
      {activeTab === 'REKAPAN_STAFF_REASON' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-users text-rose-400"></i>
              Rekapan Total Void Bill Dari Masing-Masing Nama Staff dan Reason
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Total {staffReasonRekapan.length} Data Staff Tercatat
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4">NAMA OUTLET</th>
                  <th className="py-3.5 px-4">NAMA STAFF (MANPOWER)</th>
                  <th className="py-3.5 px-4">NAMA PIC</th>
                  <th className="py-3.5 px-4 text-center">TOTAL TRANSAKSI</th>
                  <th className="py-3.5 px-4 text-right">TOTAL NOMINAL TRANSAKSI</th>
                  <th className="py-3.5 px-4">RINCIAN ALASAN VOID (REASON)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {staffReasonRekapan.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Belum ada data rekapan staff void pada outlet yang dipilih untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  staffReasonRekapan.map((row, idx) => (
                    <tr key={`${row.outlet}_${row.staffName}`} className="hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px]">
                          {row.outlet}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                          {row.staffName.charAt(0).toUpperCase()}
                        </div>
                        {row.staffName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                          {row.picName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-amber-400 font-mono text-sm">
                        {row.count}x
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-400 font-mono text-sm">
                        Rp {row.totalAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(row.reasons).map(([rs, c]) => (
                            <span key={rs} className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300">
                              {rs} <b className="text-amber-400">({c}x)</b>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {staffReasonRekapan.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <td colSpan={4} className="py-3.5 px-4 text-right text-slate-300 uppercase">
                      GRAND TOTAL REKAPAN:
                    </td>
                    <td className="py-3.5 px-4 text-center text-amber-400 font-mono text-sm">
                      {staffReasonRekapan.reduce((acc, c) => acc + c.count, 0)}x
                    </td>
                    <td className="py-3.5 px-4 text-right text-rose-400 font-mono text-base">
                      Rp {staffReasonRekapan.reduce((acc, c) => acc + c.totalAmount, 0).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Detail Transaksi */}
      {activeTab === 'DETAIL_TRANSAKSI' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-list-check text-rose-400"></i>
              Daftar Detail Transaksi Void Bill Regional
            </h3>
            <span className="text-xs text-slate-400">
              Total {allFilteredRecords.length} Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4">OUTLET</th>
                  <th className="py-3.5 px-4">TANGGAL</th>
                  <th className="py-3.5 px-4">NO. BILL</th>
                  <th className="py-3.5 px-4">NAMA STAFF</th>
                  <th className="py-3.5 px-4">NAMA PIC</th>
                  <th className="py-3.5 px-4 text-right">TOTAL TRANSAKSI (RP)</th>
                  <th className="py-3.5 px-4">REASON</th>
                  <th className="py-3.5 px-4">CATATAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {allFilteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Tidak ada transaksi void bill yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  allFilteredRecords.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px]">
                          {r.outlet}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{r.date}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-[11px] font-bold text-slate-300">
                          {r.billNumber || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">{r.staffName}</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                          {r.picName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-400 font-mono text-sm">
                        Rp {r.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px]">
                          {r.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs max-w-xs truncate" title={r.notes}>
                        {r.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {allFilteredRecords.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <td colSpan={6} className="py-3.5 px-4 text-right text-slate-300 uppercase">
                      TOTAL DARI {allFilteredRecords.length} TRANSAKSI:
                    </td>
                    <td className="py-3.5 px-4 text-right text-rose-400 font-mono text-base">
                      Rp {allFilteredRecords.reduce((acc, c) => acc + c.amount, 0).toLocaleString('id-ID')}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
