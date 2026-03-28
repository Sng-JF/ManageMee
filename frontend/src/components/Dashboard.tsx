import React, { useState, useEffect } from 'react';
import { TrendingUp, CloudRain, ChevronDown, ChevronUp, Zap, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiRequest } from '../services/api';
import { getMenuItems } from '../services/menu';
import { getSales } from '../services/sales';
import type { MenuItem, SaleRecord } from '../types/menu';
import DailyPrepForecast from './DailyPrepForecast';
import SalesPrediction from './SalesPrediction';
import PriceComparison from './PriceComparison';

interface DashboardProps {
  onNavigateToWorkMode: () => void;
  onNavigateToRestock: () => void;
  salesRefreshKey?: number;
}

export default function Dashboard({ onNavigateToWorkMode, onNavigateToRestock, salesRefreshKey = 0 }: DashboardProps) {
  const [forecastData, setForecastData] = useState<any>(null);
  const [showSalesPrediction, setShowSalesPrediction] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(true);
  const [analytics, setAnalytics] = useState({ revenue: 0, totalOrders: 0 });
  const [hourlyData, setHourlyData] = useState<Array<{ hour: string; sales: number }>>([]);
  const [weeklyData, setWeeklyData] = useState<Array<{ week: string; sales: number; isToday: boolean }>>([]);
  const [showAllTodaySales, setShowAllTodaySales] = useState(false);
  const [recentTodaySales, setRecentTodaySales] = useState<
    Array<{ id: string; dishName: string; time: string; total: number; quantity: number }>
  >([]);


  const isSameDay = (dateA: Date, dateB: Date) => {
    return dateA.getFullYear() === dateB.getFullYear() &&
           dateA.getMonth() === dateB.getMonth() &&
           dateA.getDate() === dateB.getDate();
  };

  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [forecast, sales, menu] = await Promise.all([
          apiRequest<any>('/api/forecast/today'),
          getSales(),
          getMenuItems(),
        ]);

        setForecastData(forecast);

        const priceByMenuItemId = new Map(menu.map((item) => [item.id, item.price]));
        const now = new Date();

        // 1. Filter sales that happened today (Local Timezone)
        const todaySales = sales
          .filter((sale) => isSameDay(new Date(sale.timestamp), now))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setRecentTodaySales(
          todaySales.map((sale) => ({
            id: sale.id ?? `${sale.menuItemId}-${sale.timestamp}`,
            dishName: sale.menuItemName,
            // Native format to local time
            time: new Date(sale.timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            }),
            total: sale.menuItemPrice * sale.quantity,
            quantity: sale.quantity,
          })),
        );

        // 2. Calculate Total Revenue for Today
        const revenue = todaySales.reduce(
          (sum, sale) => sum + (priceByMenuItemId.get(sale.menuItemId) ?? 0) * sale.quantity,
          0,
        );
        setAnalytics({ revenue, totalOrders: todaySales.length });

        // 3. Hourly breakdown (6am–10pm) mapped natively
        const hourlyCounts: Record<number, number> = {};
        todaySales.forEach((sale) => {
          const h = new Date(sale.timestamp).getHours(); // Native local hour
          const saleRevenue = (priceByMenuItemId.get(sale.menuItemId) ?? 0) * sale.quantity;
          hourlyCounts[h] = (hourlyCounts[h] ?? 0) + saleRevenue;
        });

        setHourlyData(
          Array.from({ length: 17 }, (_, i) => {
            const h = i + 6;
            const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
            return { hour: label, sales: Math.round(hourlyCounts[h] ?? 0) };
          }),
        );

        // 4. Weekly historical comparison mapped by local midnight
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const weekBuckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
        sales.forEach((sale) => {
          const saleDate = new Date(sale.timestamp);
          const saleMidnight = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
          
          const diffDays = Math.round(
            (todayMidnight.getTime() - saleMidnight.getTime()) / (1000 * 60 * 60 * 24),
          );
          
          if (diffDays > 0 && diffDays <= 28 && diffDays % 7 === 0) {
            const weekIndex = diffDays / 7;
            const saleRevenue = (priceByMenuItemId.get(sale.menuItemId) ?? 0) * sale.quantity;
            weekBuckets[weekIndex] = (weekBuckets[weekIndex] ?? 0) + saleRevenue;
          }
        });

        setWeeklyData([
          { week: '-4 wks', sales: Math.round(weekBuckets[4]), isToday: false },
          { week: '-3 wks', sales: Math.round(weekBuckets[3]), isToday: false },
          { week: '-2 wks', sales: Math.round(weekBuckets[2]), isToday: false },
          { week: '-1 wk',  sales: Math.round(weekBuckets[1]), isToday: false },
          { week: 'Today',  sales: Math.round(revenue),        isToday: true  },
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    void fetchDashboardData();
  }, [salesRefreshKey]);

  if (showSalesPrediction) {
    return (
      <SalesPrediction
        onClose={() => setShowSalesPrediction(false)}
        forecastData={forecastData}
      />
    );
  }

  const visibleTodaySales = showAllTodaySales ? recentTodaySales : recentTodaySales.slice(0, 5);

  const todayLabel = new Date().toLocaleDateString('en-SG', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Asia/Singapore',
  });
  const weekdayLabel = new Date().toLocaleDateString('en-SG', {
    weekday: 'long', timeZone: 'Asia/Singapore',
  });

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-orange-600 rounded-lg p-4 mb-4">
          <h1 className="text-3xl font-bold text-white">Home</h1>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <span className="font-semibold">{todayLabel}</span>
          {forecastData?.weather && (
            <>
              <span className="font-semibold">•</span>
              <div className="flex items-center gap-1">
                <CloudRain size={18} strokeWidth={2.5} />
                <span className="font-semibold">{forecastData.weather}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily Prep Forecast Widget */}
      <div className="mb-6">
        <DailyPrepForecast
          onViewDetails={() => setShowSalesPrediction(true)}
          recommendations={forecastData?.prepRecommendations}
        />
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-4 z-10 flex gap-3 mb-6">
        <button
          onClick={onNavigateToWorkMode}
          className="flex-1 bg-green-600 text-white rounded-xl p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-green-600 transition-colors shadow-lg border-2 border-green-600"
        >
          <Zap size={22} strokeWidth={2.5} />
          Log Sale
        </button>
        <button
          onClick={onNavigateToRestock}
          className="flex-1 bg-white text-orange-600 rounded-xl p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-50 transition-colors shadow-lg border-2 border-orange-200"
        >
          <Package size={22} strokeWidth={2.5} />
          Restock
        </button>
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
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Revenue Today</p>
                <p className="text-green-600 font-black text-2xl">${analytics.revenue.toFixed(2)}</p>
              </div>
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Predicted Sales</p>
                <p className="text-orange-600 font-black text-2xl">
                  ${parseFloat(forecastData?.predictedSales ?? '0').toFixed(2)}
                </p>
              </div>
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Orders Today</p>
                <p className="text-blue-600 font-black text-2xl">{analytics.totalOrders}</p>
              </div>
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">Avg Weekday</p>
                <p className="text-gray-900 font-black text-2xl">
                  ${parseFloat(forecastData?.averageWeekdaySales ?? '0').toFixed(0)}
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-1">Sales by Hour</h3>
            {/* Changed description from "Portions" to "Revenue" */}
            <p className="text-gray-500 text-sm font-medium mb-4">Revenue today (SGT)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="hour" stroke="#9ca3af" style={{ fontSize: '9px', fontWeight: 'bold' }} interval={1} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} tickLine={false} axisLine={false} allowDecimals={false} />
                {/* Updated the Tooltip formatter to show $ and 'Revenue' instead of 'Portions' */}
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }} 
                  contentStyle={{ fontWeight: 'bold', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  formatter={(value) => [`$${value}`, 'Revenue']} 
                />
                <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

            {/* Historical Trend */}
            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-1">Historical Trend</h3>
              <p className="text-gray-500 text-sm font-medium mb-4">Past 4 {weekdayLabel}s vs Today</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} interval={0} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '10px', fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontWeight: 'bold', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Bar dataKey="sales" radius={[4, 4, 0, 0]} barSize={32}>
                    {weeklyData.map((entry, index) => (
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