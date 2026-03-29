import { useEffect, useState } from 'react';
import { TrendingUp, CloudRain, ChevronDown, ChevronUp, ChevronLeft, Zap, Package, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiRequest } from '../services/api';
import { getMenuItems } from '../services/menu';
import { getSales } from '../services/sales';
import type { SaleRecord } from '../types/menu';
import DailyPrepForecast from './DailyPrepForecast';
import SalesPrediction from './SalesPrediction';

interface DashboardProps {
  onNavigateToWorkMode: () => void;
  onNavigateToRestock: () => void;
  salesRefreshKey?: number;
  onFormStateChange?: (isOpen: boolean) => void;
}

type RecentSaleItem = {
  id: string;
  dishName: string;
  time: string;
  total: number;
  quantity: number;
};

const getSalesDateKey = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
};

const getTodaySalesDateKey = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
};

const formatSalesDateLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);

  if (!year || !month || !day) {
    return dateKey;
  }

  const date = new Date(year, month - 1, day, 12);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(date);
};

export default function Dashboard({
  onNavigateToWorkMode,
  onNavigateToRestock,
  salesRefreshKey = 0,
  onFormStateChange,
}: DashboardProps) {
  const [forecastData, setForecastData] = useState<any>(null);
  const [showSalesPrediction, setShowSalesPrediction] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(true);
  const [analytics, setAnalytics] = useState({ revenue: 0, totalOrders: 0 });
  const [hourlyData, setHourlyData] = useState<Array<{ hour: string; sales: number }>>([]);
  const [weeklyData, setWeeklyData] = useState<
    Array<{ week: string; sales: number; isToday: boolean }>
  >([]);
  const [dashboardView, setDashboardView] = useState<'main' | 'salesHistory'>('main');
  const [recentTodaySales, setRecentTodaySales] = useState<RecentSaleItem[]>([]);
  const [allSales, setAllSales] = useState<SaleRecord[]>([]);
  const [selectedSalesDate, setSelectedSalesDate] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [forecast, sales, menu] = await Promise.all([
          apiRequest<any>('/api/forecast/today'),
          getSales(),
          getMenuItems(),
        ]);
        setForecastData(forecast);

        const sortedSales = [...sales].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setAllSales(sortedSales);

        const uniqueDateKeys = Array.from(
          new Set(
            sortedSales
              .map((sale) => getSalesDateKey(sale.timestamp))
              .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey)),
          ),
        ).sort((a, b) => b.localeCompare(a));

        const todayKey = getTodaySalesDateKey();

        setSelectedSalesDate((prev) => {
          if (prev && uniqueDateKeys.includes(prev)) return prev;
          if (uniqueDateKeys.includes(todayKey)) return todayKey;
          return uniqueDateKeys[0] ?? '';
        });

        const priceByMenuItemId = new Map(menu.map((item) => [item.id, item.price]));
        const todaySales = sales
          .filter((sale) => getSalesDateKey(sale.timestamp) === todayKey)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setRecentTodaySales(
          todaySales.map((sale) => ({
            id: sale.id ?? `${sale.menuItemId}-${sale.timestamp}`,
            dishName: sale.menuItemName,
            time: new Date(sale.timestamp).toLocaleTimeString('en-SG', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'Asia/Singapore',
            }),
            total: sale.menuItemPrice * sale.quantity,
            quantity: sale.quantity,
          })),
        );

        const revenue = todaySales.reduce(
          (sum, sale) => sum + (priceByMenuItemId.get(sale.menuItemId) ?? sale.menuItemPrice) * sale.quantity,
          0,
        );
        setAnalytics({ revenue, totalOrders: todaySales.length });

        const hourlyCounts: Record<number, number> = {};
        todaySales.forEach((sale) => {
          const hourParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Singapore',
            hour: '2-digit',
            hour12: false,
          }).formatToParts(new Date(sale.timestamp));

          const hour = Number(hourParts.find((part) => part.type === 'hour')?.value ?? '0');
          const saleRevenue = (priceByMenuItemId.get(sale.menuItemId) ?? sale.menuItemPrice) * sale.quantity;
          hourlyCounts[hour] = (hourlyCounts[hour] ?? 0) + saleRevenue;
        });

        setHourlyData(
          Array.from({ length: 17 }, (_, i) => {
            const h = i + 6;
            const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
            return { hour: label, sales: Math.round(hourlyCounts[h] ?? 0) };
          }),
        );
        
console.log('todayKey', todayKey);
console.log(
  'sales with keys',
  sales.map((sale) => ({
    name: sale.menuItemName,
    quantity: sale.quantity,
    timestamp: sale.timestamp,
    key: getSalesDateKey(sale.timestamp),
  }))
);
console.log(
  'todaySales',
  todaySales.map((sale) => ({
    name: sale.menuItemName,
    quantity: sale.quantity,
    timestamp: sale.timestamp,
  }))
);

        const todayDate = new Date();
        const todayMidnight = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          todayDate.getDate(),
        );

        const weekBuckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

        sales.forEach((sale) => {
          const saleDate = new Date(sale.timestamp);
          const saleMidnight = new Date(
            saleDate.getFullYear(),
            saleDate.getMonth(),
            saleDate.getDate(),
          );

          const diffDays = Math.round(
            (todayMidnight.getTime() - saleMidnight.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (diffDays > 0 && diffDays <= 28 && diffDays % 7 === 0) {
            const weekIndex = diffDays / 7;
            const saleRevenue =
              (priceByMenuItemId.get(sale.menuItemId) ?? sale.menuItemPrice) * sale.quantity;
            weekBuckets[weekIndex] = (weekBuckets[weekIndex] ?? 0) + saleRevenue;
          }
        });

        setWeeklyData([
          { week: '-4 wks', sales: Math.round(weekBuckets[4]), isToday: false },
          { week: '-3 wks', sales: Math.round(weekBuckets[3]), isToday: false },
          { week: '-2 wks', sales: Math.round(weekBuckets[2]), isToday: false },
          { week: '-1 wk', sales: Math.round(weekBuckets[1]), isToday: false },
          { week: 'Today', sales: Math.round(revenue), isToday: true },
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    void fetchDashboardData();
  }, [salesRefreshKey]);

  useEffect(() => {
    const shouldHideNav = dashboardView === 'salesHistory' || showSalesPrediction;
    onFormStateChange?.(shouldHideNav);

    return () => {
      onFormStateChange?.(false);
    };
  }, [dashboardView, showSalesPrediction, onFormStateChange]);

  const visibleTodaySales = recentTodaySales.slice(0, 5);

  const todayLabel = new Date().toLocaleDateString('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  });

  const weekdayLabel = new Date().toLocaleDateString('en-SG', {
    weekday: 'long',
    timeZone: 'Asia/Singapore',
  });

  const uniqueSalesDates = Array.from(
    new Set(
      allSales
        .map((sale) => getSalesDateKey(sale.timestamp))
        .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey)),
    ),
  ).sort((a, b) => b.localeCompare(a));

  const filteredSalesForDate = allSales.filter(
    (sale) => getSalesDateKey(sale.timestamp) === selectedSalesDate,
  );

  const selectedDateRevenue = filteredSalesForDate.reduce(
    (sum, sale) => sum + sale.menuItemPrice * sale.quantity,
    0,
  );

  if (dashboardView === 'salesHistory') {
    return (
      <div className="p-4 pb-24">
        <div className="mb-6">
          <div className="bg-gray-600 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Recent Sales</h1>
            </div>

            <button
              type="button"
              onClick={() => setDashboardView('main')}
              className="text-white active:bg-gray-500 p-2 rounded-lg transition-colors"
            >
              <X size={28} strokeWidth={2.5} />
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-gray-900 font-bold mb-2 text-sm">Select Date</label>

            {uniqueSalesDates.length > 0 ? (
              <select
                value={selectedSalesDate}
                onChange={(e) => setSelectedSalesDate(e.target.value)}
                className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600 bg-white"
              >
                {uniqueSalesDates.map((dateKey) => (
                  <option key={dateKey} value={dateKey}>
                    {formatSalesDateLabel(dateKey)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full p-4 border-2 border-gray-200 rounded-lg font-bold text-base bg-gray-50 text-gray-500">
                No sales dates available
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                Orders
              </p>
              <p className="text-blue-600 font-black text-2xl">
                {filteredSalesForDate.length}
              </p>
            </div>

            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                Revenue
              </p>
              <p className="text-green-600 font-black text-2xl">
                ${selectedDateRevenue.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-1">All Sales</h3>
            <p className="text-gray-500 text-sm font-medium mb-4">
              {selectedSalesDate
                ? formatSalesDateLabel(selectedSalesDate)
                : 'No sales date selected'}
            </p>

            {filteredSalesForDate.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-500 font-bold text-sm">
                  No sales recorded for this date
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSalesForDate.map((sale) => (
                  <div
                    key={sale.id ?? `${sale.menuItemId}-${sale.timestamp}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {sale.quantity}x {sale.menuItemName}
                      </p>
                      <p className="text-gray-500 text-xs font-medium">
                        {new Date(sale.timestamp).toLocaleTimeString('en-SG', {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: 'Asia/Singapore',
                        })}
                      </p>
                    </div>
                    <p className="font-black text-orange-600 text-sm ml-3">
                      ${(sale.menuItemPrice * sale.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showSalesPrediction) {
    return (
      <SalesPrediction
        onClose={() => setShowSalesPrediction(false)}
        forecastData={forecastData}
      />
    );
  }

  return (
    <div className="p-4 pb-24">
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

      <div className="mb-6">
        <DailyPrepForecast
          onViewDetails={() => setShowSalesPrediction(true)}
          recommendations={forecastData?.prepRecommendations}
        />
      </div>

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
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                  Revenue Today
                </p>
                <p className="text-green-600 font-black text-2xl">
                  ${analytics.revenue.toFixed(2)}
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                  Predicted Sales
                </p>
                <p className="text-orange-600 font-black text-2xl">
                  ${parseFloat(forecastData?.predictedSales ?? '0').toFixed(2)}
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                  Orders Today
                </p>
                <p className="text-blue-600 font-black text-2xl">{analytics.totalOrders}</p>
              </div>

              <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
                <p className="text-gray-500 font-bold text-xs mb-1 uppercase tracking-wider">
                  Avg Weekday
                </p>
                <p className="text-gray-900 font-black text-2xl">
                  ${parseFloat(forecastData?.averageWeekdaySales ?? '0').toFixed(0)}
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">Recent Sales</h3>
                  <p className="text-gray-500 text-sm font-medium">Latest orders today</p>
                </div>

                {recentTodaySales.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {console.log("view all");setDashboardView('salesHistory')}}
                    className="text-orange-600 font-bold text-sm active:text-orange-700 transition-colors"
                  >
                    View All
                  </button>
                )}
              </div>

              {visibleTodaySales.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-gray-500 font-bold text-sm">No sales recorded yet today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleTodaySales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {sale.quantity}x {sale.dishName}
                        </p>
                        <p className="text-gray-500 text-xs font-medium">{sale.time}</p>
                      </div>
                      <p className="font-black text-orange-600 text-sm ml-3">
                        ${sale.total.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-1">Sales by Hour</h3>
              <p className="text-gray-500 text-sm font-medium mb-4">Revenue today (SGT)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    stroke="#9ca3af"
                    style={{ fontSize: '9px', fontWeight: 'bold' }}
                    interval={1}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    style={{ fontSize: '10px', fontWeight: 'bold' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [`$${value}`, 'Revenue']}
                  />
                  <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border-2 border-gray-200 shadow-sm rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-1">Historical Trend</h3>
              <p className="text-gray-500 text-sm font-medium mb-4">
                Past 4 {weekdayLabel}s vs Today
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="week"
                    stroke="#9ca3af"
                    style={{ fontSize: '10px', fontWeight: 'bold' }}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    style={{ fontSize: '10px', fontWeight: 'bold' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [`$${value}`, 'Revenue']}
                  />
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