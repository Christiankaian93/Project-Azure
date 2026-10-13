import React, { useState, useRef } from 'react';
import { ModuleType } from '../types';

interface Props {
  onSelect: (m: ModuleType, tab?: any) => void;
  isAdmin?: boolean;
  onToggleFS?: () => void;
  onOpenLogisticsInput?: () => void;
}

interface DashboardCard {
  type: ModuleType;
  label: string;
  icon: string;
  color: string;
  desc: string;
  category: 'REVENUE' | 'EXPENSE' | 'OPERASIONAL' | 'CUSTOMER' | 'SDM';
}

const Dashboard: React.FC<Props> = ({ onSelect, isAdmin, onToggleFS, onOpenLogisticsInput }) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'slide' | 'grid'>('slide');
  const sliderRef = useRef<HTMLDivElement>(null);

  const cards: DashboardCard[] = [
    { type: ModuleType.SALES, label: 'Daily Revenue', icon: 'fa-cash-register', color: 'from-emerald-600 to-teal-800', desc: 'Revenue, Covers & Avg Check', category: 'REVENUE' },
    { type: ModuleType.RECEIVING_SHEET, label: 'Receiving Sheet', icon: 'fa-file-invoice-dollar', color: 'from-amber-500 to-yellow-600', desc: 'Laporan Belanja & Cost Supplier Harian', category: 'EXPENSE' },
    { type: ModuleType.PATTY_CASH_EXPENSE, label: 'Patty Cash Expense', icon: 'fa-wallet', color: 'from-amber-500 to-orange-600', desc: 'Belanja Patty Cash & Matrix Detail Item', category: 'EXPENSE' },
    { type: ModuleType.ENERGY_COST, label: 'Energy Cost', icon: 'fa-bolt', color: 'from-amber-400 to-yellow-600', desc: 'Listrik, Air PDAM, Gas & Monitoring KWh', category: 'OPERASIONAL' },
    { type: ModuleType.CHEMICAL, label: 'Chemical', icon: 'fa-flask', color: 'from-cyan-500 to-teal-600', desc: 'Belanja Chemical Floor & Matrix Requisition', category: 'EXPENSE' },
    { type: ModuleType.MAIN_STORE_KITCHEN, label: 'Main Store & Kitchen', icon: 'fa-warehouse', color: 'from-blue-600 to-indigo-700', desc: 'Belanja Main Store/Kitchen & Matrix Detail', category: 'EXPENSE' },
    { type: ModuleType.SUPPLIER_EXPENSE, label: 'Supplier Expense', icon: 'fa-truck-loading', color: 'from-rose-600 to-red-700', desc: 'Belanja Supplier Rekanan & Purchasing Matrix', category: 'EXPENSE' },
    { type: ModuleType.CITY_LEDGER, label: 'City Ledger', icon: 'fa-building', color: 'from-blue-600 to-cyan-700', desc: 'Bill City Ledger & Matrix Detail Piutang', category: 'CUSTOMER' },
    { type: ModuleType.GUEST_SATISFACTION, label: 'Guest Satisfaction', icon: 'fa-face-smile', color: 'from-emerald-600 to-teal-700', desc: 'Customer Care & Matrix Detail Recovery', category: 'CUSTOMER' },
    { type: ModuleType.COMPLIMENTARY, label: 'Complimentary', icon: 'fa-gift', color: 'from-purple-600 to-pink-700', desc: 'Bill Complimentary & Matrix Detail Promo', category: 'CUSTOMER' },
    { type: ModuleType.STRATEGI, label: 'Menu Strategi', icon: 'fa-bullseye', color: 'from-amber-500 to-orange-600', desc: 'Target & Actual Penyeimbang & Percepatan Lunch/Dinner', category: 'REVENUE' },
    { type: ModuleType.WEEKLY_OVERTIME, label: 'Input Weekly Overtime', icon: 'fa-business-time', color: 'from-indigo-600 to-purple-800', desc: 'Total Staff, Total Overtime & Average Overtime', category: 'SDM' },
    { type: ModuleType.COGS, label: 'COGS & Forecast Rev', icon: 'fa-calculator', color: 'from-emerald-600 to-teal-700', desc: 'HPP COGS, Forecast Revenue Weekday & Weekend', category: 'REVENUE' },
    { type: ModuleType.REKAPAN, label: 'Rekapan Harian', icon: 'fa-file-invoice', color: 'from-indigo-600 to-purple-800', desc: 'Summary Performa Harian', category: 'REVENUE' },
    { type: ModuleType.LOGISTICS, label: 'Rekapan Logistik', icon: 'fa-boxes', color: 'from-amber-500 to-orange-600', desc: 'Inventory & Peminjaman Barang', category: 'OPERASIONAL' },
    { type: ModuleType.EXTERNAL_AUDIT, label: 'Third Party & Gas', icon: 'fa-gas-pump', color: 'from-amber-600 to-orange-700', desc: 'Penginputan & Rekapan Belanja Third Party & Gas', category: 'OPERASIONAL' },
    { type: ModuleType.TUTORIAL, label: 'Tutorial & SOP', icon: 'fa-graduation-cap', color: 'from-blue-600 to-indigo-800', desc: 'Panduan Operasional Leader, Cashier & Store Keeper', category: 'SDM' },
  ];

  if (isAdmin) {
    cards.push({ type: ModuleType.ADMIN, label: 'Admin Panel', icon: 'fa-user-shield', color: 'from-slate-700 to-slate-900', desc: 'Master Configuration Center', category: 'SDM' });
  }

  const categories = [
    { id: 'ALL', label: 'Semua Fitur', icon: 'fa-th-large' },
    { id: 'REVENUE', label: 'Revenue & Target', icon: 'fa-chart-line' },
    { id: 'EXPENSE', label: 'Belanja & Biaya', icon: 'fa-receipt' },
    { id: 'OPERASIONAL', label: 'Operasional & Gas', icon: 'fa-cogs' },
    { id: 'CUSTOMER', label: 'Customer & Ledger', icon: 'fa-users' },
    { id: 'SDM', label: 'SDM & Admin', icon: 'fa-user-tie' },
  ];

  const filteredCards = activeCategory === 'ALL' 
    ? cards 
    : cards.filter(c => c.category === activeCategory);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full touch-pan-all">
      {/* Action Header & Fullscreen buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={onToggleFS}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.12em] text-[10px] shadow-lg shadow-indigo-900/30 transition-all active:scale-95 flex items-center gap-2 border border-indigo-400/30 cursor-pointer"
          >
            <i className="fas fa-expand text-xs"></i>
            Full Screen
          </button>
          {onOpenLogisticsInput && (
            <button 
              onClick={onOpenLogisticsInput}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black uppercase tracking-[0.12em] text-[10px] shadow-lg shadow-orange-950/30 transition-all active:scale-95 flex items-center gap-2 border border-orange-400/30 cursor-pointer animate-pulse-subtle"
            >
              <i className="fas fa-boxes text-xs"></i>
              Input Logistik
            </button>
          )}
        </div>

        {/* View Mode Toggle: Slide vs Grid */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setViewMode('slide')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              viewMode === 'slide' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mode Slide Horizontal untuk Mobile & Tablet"
          >
            <i className="fas fa-arrows-left-right text-[10px]"></i>
            Mode Slide
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              viewMode === 'grid' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mode Grid Kotak"
          >
            <i className="fas fa-grip text-[10px]"></i>
            Mode Grid
          </button>
        </div>
      </div>

      {/* Touch Screen Mobile Instruction Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/20 rounded-2xl p-2.5 px-4 flex items-center justify-between gap-3 text-indigo-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 animate-pulse">
            <i className="fas fa-hand-pointer text-xs"></i>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              Touchscreen Slide Aktif
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </span>
            <p className="text-[9px] font-bold text-slate-300">
              Layar HP & Tablet dapat digeser horizontal & vertikal untuk melihat semua fitur
            </p>
          </div>
        </div>

        {viewMode === 'slide' && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scrollSlider('left')}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
              title="Geser Kiri"
            >
              <i className="fas fa-chevron-left text-[10px]"></i>
            </button>
            <button
              onClick={() => scrollSlider('right')}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
              title="Geser Kanan"
            >
              <i className="fas fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        )}
      </div>

      {/* Slidable Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 touch-pan-x">
        {categories.map((cat) => {
          const count = cat.id === 'ALL' ? cards.length : cards.filter(c => c.category === cat.id).length;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-950/40 border border-indigo-400/40 scale-102'
                  : 'bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <i className={`fas ${cat.icon} text-[10px]`}></i>
              {cat.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* MAIN CARDS CONTAINER: Mode Slide or Mode Grid */}
      {viewMode === 'slide' ? (
        <div className="space-y-3">
          {/* Horizontal Slide Track */}
          <div
            ref={sliderRef}
            className="flex gap-3 md:gap-4 overflow-x-auto overflow-y-hidden pb-4 pt-1 px-1 custom-scrollbar touch-pan-x"
            style={{
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y pinch-zoom'
            }}
          >
            {filteredCards.map((card, idx) => (
              <div
                key={card.type + idx}
                onClick={() => onSelect(card.type)}
                style={{ scrollSnapAlign: 'start' }}
                className="group relative w-[240px] sm:w-[280px] md:w-[300px] h-44 sm:h-48 md:h-52 shrink-0 rounded-2xl overflow-hidden glass-card border border-white/10 hover:border-white/40 transition-all duration-300 hover:-translate-y-1 active:scale-95 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-xl select-none"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-10 group-hover:opacity-25 transition-opacity duration-300`}></div>
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/5 group-hover:text-white/15 transition-all duration-300 transform group-hover:scale-110">
                  <i className={`fas ${card.icon} text-5xl sm:text-6xl md:text-7xl`}></i>
                </div>
                
                <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col justify-between items-start z-10">
                  <div className="flex items-center justify-between w-full">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg group-hover:shadow-2xl transition-all`}>
                      <i className={`fas ${card.icon} text-base sm:text-lg md:text-2xl`}></i>
                    </div>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/5">
                      #{idx + 1}
                    </span>
                  </div>
                  
                  <div className="pointer-events-none w-full">
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-white mb-1 uppercase tracking-tight group-hover:text-purple-300 transition-colors line-clamp-1">
                      {card.label}
                    </h3>
                    <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-2">
                      {card.desc}
                    </p>
                  </div>

                  <div className="w-full flex items-center justify-between pt-1 border-t border-white/5 text-[8px] font-bold text-indigo-400 group-hover:text-indigo-300 uppercase tracking-widest">
                    <span>Buka Fitur</span>
                    <i className="fas fa-arrow-right text-[8px] transform group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Slide Navigation Dots / Helper */}
          <div className="flex items-center justify-between px-2 pt-1 text-[9px] text-slate-400 font-bold uppercase">
            <span className="flex items-center gap-1.5">
              <i className="fas fa-arrows-left-right text-indigo-400"></i>
              Menampilkan {filteredCards.length} Fitur (Geser Layar ke Kiri / Kanan)
            </span>
            <span className="text-slate-500">
              Sentuh Kartu Untuk Membuka
            </span>
          </div>
        </div>
      ) : (
        /* Mode Grid: Responsive Grid with Two-Axis Touch Scroll */
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 animate-fade-in no-blur p-1 pb-20 touch-pan-all"
        >
          {filteredCards.map((card, idx) => (
            <div
              key={card.type + idx}
              onClick={() => onSelect(card.type)}
              className="group relative h-40 sm:h-44 md:h-52 rounded-2xl overflow-hidden glass-card border border-white/10 hover:border-white/40 transition-all duration-300 hover:-translate-y-1 active:scale-95 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-xl select-none"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-10 group-hover:opacity-25 transition-opacity duration-300`}></div>
              <div className="absolute top-4 right-4 md:top-6 md:right-6 text-white/5 group-hover:text-white/15 transition-all duration-300 transform group-hover:scale-110">
                <i className={`fas ${card.icon} text-5xl md:text-7xl`}></i>
              </div>
              <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col justify-between items-start z-10">
                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg group-hover:shadow-2xl transition-all`}>
                  <i className={`fas ${card.icon} text-lg md:text-2xl`}></i>
                </div>
                
                <div className="pointer-events-none w-full">
                  <h3 className="text-sm sm:text-base md:text-xl font-black text-white mb-1 uppercase tracking-tight group-hover:text-purple-300 transition-colors">
                    {card.label}
                  </h3>
                  <p className="text-[9px] md:text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
                    {card.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;