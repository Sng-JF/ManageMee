import React, { useState, useEffect } from 'react';
import { TrendingUp, CloudRain, ChevronDown, ChevronUp, Zap, Receipt, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { todaySalesData } from '../data/mockData';
import { prepRecommendations, historicalData } from '../data/forecastData';
import { recentSales } from '../data/salesData';
import { analyticsData, performanceData, financesData } from '../data/analyticsData';
import DailyPrepForecast from './DailyPrepForecast';
import SalesPrediction from './SalesPrediction';

interface DashboardProps {
  onNavigateToWorkMode: () => void;
  onNavigateToRestock: () => void;
  onNavigateToPriceTracking: () => void;
}

export default function Dashboard({ onNavigateToWorkMode, onNavigateToPriceTracking }: DashboardProps) {
  const [forecastData, setForecastData] = useState<any>(null);
  const [showSalesPrediction, setShowSalesPrediction] = useState(false);
  const [isPrepGuideExpanded, setIsPrepGuideExpanded] = useState(true);
  const [isTodaysSalesExpanded, setIsTodaysSalesExpanded] = useState(true);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(true);
  const [chartMode, setChartMode] = useState<'sales' | 'finances'>('sales');
  const [showChartModeDropdown, setShowChartModeDropdown] = useState(false);

  // Get top 5 recent sales
  const topFiveSales = recentSales.slice(0, 5);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/forecast/today');
        const data = await response.json();
        setForecastData(data);
      } catch (error) {
        console.error("Failed to fetch forecast:", error);
      }
    };
    fetchForecast();
  }, []);

  if (showSalesPrediction) {
    return <SalesPrediction 
             onClose={() => setShowSalesPrediction(false)} 
             forecastData={forecastData} 
           />;
  }

  return (
    <div className="p-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-orange-500 rounded-lg p-4 mb-4">
            <h1 className="text-3xl font-bold text-white">Home</h1>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <span className="font-semibold">Tuesday, 24 Feb 2026</span>
            <span className="font-semibold">•</span>
            <div className="flex items-center gap-1">
              <CloudRain size={18} strokeWidth={2.5} />
              <span className="font-semibold">Rainy</span>
            </div>
          </div>
        </div>

        {/* Daily Prep Forecast Widget */}
        <div className="mb-6">
          <DailyPrepForecast 
            onViewDetails={() => setShowSalesPrediction(true)} 
            recommendations={forecastData?.prepRecommendations} 
          />
        </div>

        {/* Sticky Action Buttons */}
        <div className="sticky bottom-4 z-10 flex gap-3 mb-6">
          <button
            onClick={onNavigateToWorkMode}
            className="flex-1 bg-orange-500 text-green-600 rounded-xl p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-600 transition-colors shadow-lg border-2 border-green-600"
          >
            <Zap size={22} strokeWidth={2.5} />
            Track Order
          </button>
          <button
            onClick={onNavigateToPriceTracking}
            className="flex-1 bg-white text-orange-600 rounded-xl p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-50 transition-colors shadow-lg border-2 border-orange-200"
          >
            <DollarSign size={22} strokeWidth={2.5} />
            Track Prices
          </button>
        </div>

        {/* Today's Sales */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={24} className="text-orange-500" strokeWidth={2.5} />
            <h2 className="text-xl font-bold text-gray-900">Today's Sales</h2>
            <button
              className="ml-auto text-gray-500 hover:text-gray-700"
              onClick={() => setIsTodaysSalesExpanded(!isTodaysSalesExpanded)}
            >
              {isTodaysSalesExpanded ? (
                <ChevronUp size={18} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={18} strokeWidth={2.5} />
              )}
            </button>
          </div>
          {isTodaysSalesExpanded && (
            <div className="space-y-2">
              {topFiveSales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">{sale.dishName}</h3>
                      <p className="text-gray-500 font-semibold text-sm">{sale.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-500 font-bold text-xl">${sale.total.toFixed(2)}</p>
                      <p className="text-gray-500 font-semibold text-sm">Qty: {sale.quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analytics Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={24} className="text-orange-500" strokeWidth={2.5} />
            <h2 className="text-xl font-bold text-gray-900">Analytics & Performance</h2>
            <button
              className="ml-auto text-gray-500 hover:text-gray-700"
              onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
            >
              {isAnalyticsExpanded ? (
                <ChevronUp size={18} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={18} strokeWidth={2.5} />
              )}
            </button>
          </div>

          {isAnalyticsExpanded && (
            <div className="space-y-6">
              {/* Analytics Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                  <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Revenue Today</p>
                  <p className="text-green-600 font-black text-2xl">${analyticsData.revenue.toFixed(2)}</p>
                </div>
                <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                  <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Total Cost</p>
                  <p className="text-red-600 font-black text-2xl">${analyticsData.cost.toFixed(2)}</p>
                </div>
                <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                  <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Profit Today</p>
                  <p className="text-blue-600 font-black text-2xl">${analyticsData.profit.toFixed(2)}</p>
                </div>
                <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                  <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Avg Margin</p>
                  <p className="text-gray-900 font-black text-2xl">{analyticsData.margin.toFixed(1)}%</p>
                </div>
              </div>

              {/* Performance Chart */}
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <div className="relative mb-4">
                  <button
                    onClick={() => setShowChartModeDropdown(!showChartModeDropdown)}
                    className="flex items-center justify-between w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-lg active:bg-gray-100"
                  >
                    <span className="text-base font-bold text-gray-900">
                      View: {chartMode === 'sales' ? 'Sales Volume' : 'Finances'}
                    </span>
                    <ChevronDown size={20} strokeWidth={2.5} className="text-gray-600" />
                  </button>
                  
                  {showChartModeDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      <button
                        onClick={() => { setChartMode('sales'); setShowChartModeDropdown(false); }}
                        className={`w-full p-3 text-left font-bold transition-colors ${chartMode === 'sales' ? 'bg-orange-50 text-orange-600' : 'bg-white text-gray-700'}`}
                      >
                        Sales Volume
                      </button>
                      <button
                        onClick={() => { setChartMode('finances'); setShowChartModeDropdown(false); }}
                        className={`w-full p-3 text-left font-bold transition-colors ${chartMode === 'finances' ? 'bg-orange-50 text-orange-600' : 'bg-white text-gray-700'}`}
                      >
                        Finances
                      </button>
                    </div>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  {chartMode === 'sales' ? (
                    <BarChart data={performanceData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} interval={0} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontWeight: 'bold', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  ) : (
                    <BarChart data={financesData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} interval={0} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontWeight: 'bold', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="cost" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="profit" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Historical Trend */}
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-1">Historical Trend</h3>
                <p className="text-gray-500 text-sm font-medium mb-4">Past 4 Tuesdays vs Forecast</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={historicalData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '11px', fontWeight: 'bold' }} interval={0} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} tickLine={false} axisLine={false} domain={[0, 1000]} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontWeight: 'bold', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`$${value}`, 'Sales']} />
                    <Bar dataKey="sales" radius={[4, 4, 0, 0]} barSize={32}>
                      {historicalData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isToday ? '#f97316' : '#d1d5db'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}