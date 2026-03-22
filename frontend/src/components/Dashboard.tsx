import React, { useState, useEffect } from 'react';
import { TrendingUp, ChefHat, TrendingDown, CloudRain, ChevronDown, ChevronUp, Zap, Package, BarChart3, Calendar, Bell, Receipt } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryItems, todaySalesData } from '../data/mockData';
import { menuItems } from '../data/menuData';
import { prepRecommendations } from '../data/forecastData';
import { recentSales } from '../data/salesData';
import DailyPrepForecast from './DailyPrepForecast';
import SalesPrediction from './SalesPrediction';
import PriceComparison from './PriceComparison';

interface DashboardProps {
  onNavigateToWorkMode: () => void;
  onNavigateToRestock: () => void;
  onFormStateChange?: (isOpen: boolean) => void;
}

export default function Dashboard({ onNavigateToWorkMode, onNavigateToRestock, onFormStateChange }: DashboardProps) {
  const [forecastData, setForecastData] = useState<any>(null);
  const totalSales = todaySalesData.reduce((sum, data) => sum + data.sales, 0);
  const [showSalesPrediction, setShowSalesPrediction] = useState(false);
  const [isPrepGuideExpanded, setIsPrepGuideExpanded] = useState(true);
  const [isTodaysSalesExpanded, setIsTodaysSalesExpanded] = useState(true);

  // Get top 5 recent sales
  const topFiveSales = recentSales.slice(0, 5);

  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        // Adjust the URL to match where your backend is running
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
    <div className="p-3">
        {/* Header */}
        <div className="mb-3">
          <div className="bg-orange-600 rounded-lg p-3 mb-4">
            <h1 className="text-2xl font-bold text-white">Home</h1>
          </div>

          <div className="flex items-center gap-2 mb-3 text-gray-600">
            <span className="font-semibold">{todayStr}</span>
            {/* <span className="font-semibold">•</span> */}
            {/* <div className="flex items-center gap-1">
              <CloudRain size={18} strokeWidth={2.5} />
              <span className="font-semibold">Rainy</span>
            </div> */}
          </div>


        {/* Daily Prep Forecast Widget */}
        {/* <div className="mb-3">
          <DailyPrepForecast 
            onViewDetails={() => setShowSalesPrediction(true)} 
            recommendations={forecastData?.prepRecommendations} 
          />
        </div> */}

        
        {/* Track Order Button */}
        {/* <div className="mb-3 sticky bottom-4 z-10">
          <button
            onClick={onNavigateToWorkMode}
            className="w-full bg-orange-500  rounded-lg p-3 font-bold text-lg flex items-center justify-center gap-3 active:bg-orange-600 transition-colors shadow-lg border-2 border-orange-600"
          >
            <Zap size={28} strokeWidth={2.5} />
            Track Order
          </button>
        </div> */}

        {/* Today's Sales */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
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
              {/* {topFiveSales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-white border-2 border-gray-300 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">{sale.dishName}</h3>
                      <p className="text-gray-600 font-semibold text-sm">{sale.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-500 font-bold text-xl">${sale.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))} */}
              
              {/* See More Button */}
              {/* <button
                className="w-full bg-white border-2 border-orange-500 text-orange-500 rounded-lg p-3 font-bold text-base active:bg-orange-50 transition-colors"
              >
                See More
              </button> */}
            </div>
          )}
        </div>

        {/* Analytics Section */}
        <PriceComparison hideHeader onFormStateChange={onFormStateChange} />

        {/* Today's Sales */}
        {/*
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={24} className="text-orange-600" strokeWidth={2.5} />
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
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
              <div className="mb-4">
                <p className="text-gray-600 font-bold">Total Sales</p>
                <p className="text-4xl font-bold text-orange-600">${totalSales.toFixed(2)}</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={todaySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#374151"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <YAxis 
                    stroke="#374151"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      fontWeight: 'bold',
                      border: '2px solid #ea580c',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#ea580c" 
                    strokeWidth={3}
                    dot={{ fill: '#ea580c', r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div> */}
      </div>
    </div>
  );
}