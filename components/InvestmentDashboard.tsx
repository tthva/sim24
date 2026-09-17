'use client';

import { useState } from 'react';
import { 
  Wallet, Calendar, TrendingUp, Plus, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, Clock, Shield,
  Sparkles, Target, FileText, RefreshCw, Bell
} from 'lucide-react';

// داده‌های فرضی (Mock Data)
const mockInvestmentData = {
  totalAmount: 500000000,
  contractDate: "۱۴۰۲/۰۸/۱۲",
  renewalDate: "۱۴۰۳/۱۲/۲۹",
  daysUntilRenewal: 127,
  status: "فعال",
  contractType: "سرمایه‌گذاری ثابت",
  interestRate: "۲۳.۵٪",
  deposits: [
    { 
      id: 1, 
      date: "۱۴۰۲/۰۸/۱۲", 
      time: "۱۰:۳۰",
      amount: 200000000, 
      type: "واریز اولیه قرارداد", 
      reference: "TRX-۹۲۳۸۷",
      status: "completed" 
    },
    { 
      id: 2, 
      date: "۱۴۰۲/۱۱/۰۵", 
      time: "۱۴:۱۵",
      amount: 100000000, 
      type: "افزایش سرمایه مرحله اول", 
      reference: "TRX-۹۴۵۱۲",
      status: "completed" 
    },
    { 
      id: 3, 
      date: "۱۴۰۳/۰۲/۲۰", 
      time: "۰۹:۴۵",
      amount: 150000000, 
      type: "افزایش سرمایه مرحله دوم", 
      reference: "TRX-۹۶۷۸۱",
      status: "completed" 
    },
    { 
      id: 4, 
      date: "۱۴۰۳/۰۵/۱۰", 
      time: "۱۶:۲۰",
      amount: 50000000, 
      type: "واریز عادی", 
      reference: "TRX-۹۸۹۲۳",
      status: "completed" 
    },
  ]
};

// فرمت کردن اعداد به فارسی
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('fa-IR').format(num);
};

export default function InvestmentDashboard() {
  const [capitalAmount, setCapitalAmount] = useState("");
  const [capitalDesc, setCapitalDesc] = useState("");

  const amountValid = capitalAmount.length > 3;
  const profitAmount = 25400000;
  const profitPercentage = ((profitAmount / mockInvestmentData.totalAmount) * 100).toFixed(1);

  return (
    <main className="pb min-h-screen">
      {/* هدر پیشرفته */}
      <header className="nb px-6 py-5 flex justify-between items-center relative z-10 border-b border-green-500/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-green-500/20">
            ر.م
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">رضا محمدی</h1>
              <Shield size={14} className="text-green-400" />
            </div>
            <p className="text-xs text-gray-400">پنل مدیریت سرمایه‌گذاری</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="relative w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
            <Bell size={16} className="text-white" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </button>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs font-bold">قرارداد فعال</span>
          </div>
          <button
            onClick={async () => {
              try {
                await fetch("/api/operator/auth", { method: "DELETE", credentials: "include" });
              } finally {
                window.location.href = "/login";
              }
            }}
            className="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition text-xs font-bold"
          >
            خروج
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-7xl py-8 relative z-10">
        
        {/* خلاصه قرارداد - بنر */}
        <div className="gc p-6 mb-8 afu d1 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 flex items-center justify-center">
              <FileText className="text-green-400" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-green-400" />
                <h3 className="text-white font-bold text-lg">قرارداد سرمایه‌گذاری شما</h3>
              </div>
              <p className="text-gray-400 text-sm">
                {mockInvestmentData.contractType} • شروع از {mockInvestmentData.contractDate}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 relative z-10 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-blue-400" />
              <div>
                <p className="text-xs text-gray-400">نرخ سود سالانه</p>
                <p className="text-white font-bold text-sm">{mockInvestmentData.interestRate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              <div>
                <p className="text-xs text-gray-400">مانده تا تمدید</p>
                <p className="text-white font-bold text-sm">{mockInvestmentData.daysUntilRenewal} روز</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-green-400" />
              <div>
                <p className="text-xs text-gray-400">وضعیت تمدید</p>
                <p className="text-green-400 font-bold text-sm">آماده</p>
              </div>
            </div>
          </div>
        </div>

        {/* کارت‌های آماری با نمودارهای داخلی */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* کارت سرمایه کل */}
          <div className="gc p-6 afu d2 group">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Wallet className="text-green-400" size={16} />
                  </div>
                  <span className="text-gray-400 text-xs font-medium">کل سرمایه</span>
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  {formatNumber(mockInvestmentData.totalAmount)}
                  <span className="text-sm font-normal text-gray-400 mr-2">تومان</span>
                </p>
                <div className="flex items-center gap-1 text-green-400 text-xs font-bold">
                  <ArrowUpRight size={12} />
                  <span>۱۲٪ نسبت به ماه قبل</span>
                </div>
              </div>
              {/* Mini Chart */}
              <svg className="w-20 h-16 opacity-70 group-hover:opacity-100 transition" viewBox="0 0 80 64" fill="none">
                <path 
                  d="M2 52 L12 44 L22 48 L32 36 L42 40 L52 24 L62 28 L72 16 L78 20" 
                  stroke="#88ffa4" 
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path 
                  d="M2 52 L12 44 L22 48 L32 36 L42 40 L52 24 L62 28 L72 16 L78 20 L78 62 L2 62 Z" 
                  fill="url(#grad1)" 
                  opacity="0.3"
                />
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#88ffa4" />
                    <stop offset="100%" stopColor="#88ffa4" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* کارت سود */}
          <div className="gc p-6 afu d3 group">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="text-purple-400" size={16} />
                  </div>
                  <span className="text-gray-400 text-xs font-medium">سود کسب شده</span>
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  {formatNumber(profitAmount)}
                  <span className="text-sm font-normal text-gray-400 mr-2">تومان</span>
                </p>
                <div className="flex items-center gap-1 text-purple-400 text-xs font-bold">
                  <span>{profitPercentage}٪ از کل سرمایه</span>
                </div>
              </div>
              {/* Progress Ring */}
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle 
                  cx="18" cy="18" r="15" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.1)" 
                  strokeWidth="3"
                />
                <circle 
                  cx="18" cy="18" r="15" 
                  fill="none" 
                  stroke="#a78bfa" 
                  strokeWidth="3"
                  strokeDasharray="94"
                  strokeDashoffset="75"
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <text 
                  x="18" y="20" 
                  textAnchor="middle" 
                  className="text-[8px] fill-white font-bold rotate-90 origin-center"
                  transform="rotate(90 18 18)"
                >
                  {profitPercentage}%
                </text>
              </svg>
            </div>
          </div>

          {/* کارت واریزها */}
          <div className="gc p-6 afu d4 group">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="text-blue-400" size={16} />
                  </div>
                  <span className="text-gray-400 text-xs font-medium">آخرین واریز</span>
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  {formatNumber(mockInvestmentData.deposits[0].amount)}
                  <span className="text-sm font-normal text-gray-400 mr-2">تومان</span>
                </p>
                <div className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                  <ArrowDownRight size={12} className="text-green-400" />
                  <span>{mockInvestmentData.deposits[0].date}</span>
                </div>
              </div>
              {/* Bar Chart */}
              <div className="flex items-end gap-1 h-16 w-20">
                {[40, 65, 45, 80, 60, 95, 70].map((h, i) => (
                  <div 
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-500/40 to-blue-400 rounded-t transition-all group-hover:scale-110"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* گرید اصلی: تایم‌لاین و افزایش سرمایه */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          
          {/* تایم‌لاین واریزها - ۳ ستون */}
          <div className="lg:col-span-3 afu d5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-white">تاریخچه واریزها</h2>
              </div>
              <button className="text-green-400 text-xs font-bold hover:text-green-300 transition">
                مشاهده همه →
              </button>
            </div>
            
            <div className="gc p-6">
              <div className="relative z-10">
                {mockInvestmentData.deposits.map((dep, index) => (
                  <div 
                    key={dep.id} 
                    className="flex gap-4 group relative pb-8 last:pb-0"
                  >
                    {/* خط اتصال عمودی */}
                    {index < mockInvestmentData.deposits.length - 1 && (
                      <div className="absolute top-8 right-[15px] w-0.5 h-[calc(100%-16px)] bg-gradient-to-b from-green-500/40 to-green-500/10"></div>
                    )}
                    
                    {/* نقطه روی تایم‌لاین */}
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <div className="absolute inset-0 rounded-full bg-green-400 blur-md opacity-40 -z-10"></div>
                    </div>

                    {/* محتوا */}
                    <div className="flex-1 pb-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                        <div>
                          <p className="text-white font-bold text-sm mb-0.5 group-hover:text-green-400 transition">
                            {dep.type}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{dep.date}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                            <span>{dep.time}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                            <span className="font-mono">{dep.reference}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-bold text-lg">
                            +{formatNumber(dep.amount)}
                          </span>
                          <span className="text-xs text-gray-500">تومان</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar کوچک */}
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                          style={{ width: `${(dep.amount / mockInvestmentData.totalAmount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* بخش تمدید قرارداد */}
        <div className="gc p-6 afu d7 relative overflow-hidden">
          {/* بک‌گراند دیکوراتیو */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <RefreshCw className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg mb-1">تمدید قرارداد</h3>
                <p className="text-gray-400 text-sm mb-2">
                  قرارداد شما در تاریخ <span className="text-white font-bold">{mockInvestmentData.renewalDate}</span> منقضی می‌شود
                </p>
                
                {/* تایمر شمارش معکوس */}
                <div className="flex gap-2">
                  {[
                    { label: 'روز', value: '۱۲۷' },
                    { label: 'ساعت', value: '۱۴' },
                    { label: 'دقیقه', value: '۲۳' },
                  ].map((item, i) => (
                    <div key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-white font-bold text-sm">{item.value}</span>
                      <span className="text-gray-400 text-xs mr-1">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition">
                تنظیم یادآوری
              </button>
              <button className="ba w-full sm:w-auto min-w-[180px] gap-2">
                <RefreshCw size={16} />
                تمدید خودکار
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}