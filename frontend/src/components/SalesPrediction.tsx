import React from 'react';
import { X, CloudRain, TrendingUp, TrendingDown, Minus, CheckCircle, BarChart3 } from 'lucide-react';
import { todayForecast, prepRecommendations } from '../data/forecastData';
import { menuItems } from '../data/menuData';

interface ForecastData {
  date: string;
  weather: string;
  confidence: string;
  predictedSales: string;
  averageWeekdaySales: string;
  prepRecommendations: Array<{ name: string; prep: number; change: number }>;
  ingredientsNeeded: Array<{ id: string; name: string; quantity: number; unit: string }>;
}

interface SalesPredictionProps {
  onClose: () => void;
  forecastData: ForecastData | null;
}

export default function SalesPrediction({ onClose, forecastData }: SalesPredictionProps) {
  if (!forecastData) {
    return <div className="p-8 text-center font-bold">Loading forecast...</div>;
  }

  if (forecastData.prepRecommendations.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex items-center justify-between z-10">
          <h1 className="text-2xl font-bold text-gray-900">Detailed Prep Guide</h1>
          <button onClick={onClose} className="text-gray-600 p-2 active:bg-gray-100 rounded-lg transition-colors">
            <X size={32} strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center mt-20">
          <div className="bg-orange-50 p-6 rounded-full mb-6">
            <BarChart3 size={64} className="text-orange-300" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Insufficient Data</h2>
          <p className="text-gray-600 font-medium text-lg max-w-xs">
            We need more sales history for this day of the week to predict your prep needs accurately. Keep tracking your orders!
          </p>
          <button 
            onClick={onClose}
            className="mt-8 bg-orange-600 text-white font-bold py-3 px-8 rounded-lg active:bg-orange-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp size={20} className="text-green-600" strokeWidth={2.5} />;
    if (change < 0) return <TrendingDown size={20} className="text-red-600" strokeWidth={2.5} />;
    return <Minus size={20} className="text-gray-600" strokeWidth={2.5} />;
  };

  const predicted = parseFloat(forecastData.predictedSales);
  const average = parseFloat(forecastData.averageWeekdaySales);
  const difference = predicted - average;
  const percentageChange = average > 0 ? ((difference / average) * 100).toFixed(0) : 0;
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex items-center justify-between z-10">
        <h1 className="text-2xl font-bold text-gray-900">Detailed Prep Guide</h1>
        <button onClick={onClose} className="text-gray-600 p-2 active:bg-gray-100 rounded-lg transition-colors">
          <X size={32} strokeWidth={2.5} />
        </button>
      </div>

      <div className="p-4 pb-24">
        {/* Date and Weather */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <CloudRain size={24} className="text-orange-500" strokeWidth={2.5} />
            <p className="font-bold text-gray-900 text-lg">
              {forecastData.date} • {forecastData.weather}
            </p>
          </div>
        </div>

        {/* Dish Breakdown */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Dish Breakdown</h2>
          <div className="space-y-2">
            {forecastData.prepRecommendations.map((dish, index) => {
              const isIncrease = dish.change > 0;
              const isStable = dish.change === 0;
              
              return (
                <div key={index} className="bg-white border-2 border-gray-300 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-900 text-base">{dish.name}</h3>
                    {!isStable && (
                      <div className="flex items-center gap-1">
                        {getTrendIcon(dish.change)}
                        <span className={`font-bold text-sm ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                          {isIncrease ? '+' : ''}{dish.change}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-orange-500 font-bold text-3xl">{dish.prep}</p>
                    <p className="text-gray-600 font-bold text-base">portions</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ingredients Needed (Now comes directly from backend) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Ingredients Needed</h2>
          <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4">
            <div className="space-y-3">
              {forecastData.ingredientsNeeded.map((ingredient, index) => (
                <div key={index} className="flex items-center justify-between">
                  <p className="text-gray-900 font-bold text-base">{ingredient.name}</p>
                  <p className="text-blue-600 font-bold text-xl">
                    {ingredient.quantity.toFixed(1)} {ingredient.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Predicted Sales */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Predicted Sales</h2>
          <div className="bg-white border-2 border-gray-300 rounded-lg p-5">
            <p className="font-bold mb-1 text-[16px] text-[#000000]">Predicted Sales</p>
            <p className="text-5xl font-bold text-orange-500 mb-3">${forecastData.predictedSales}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#000000]">vs Avg Tuesday</p>
                <p className="text-2xl font-bold text-orange-500">${forecastData.averageWeekdaySales}</p>
              </div>
              <div className={`text-right px-4 py-2 rounded-lg border-2 ${
                isIncrease ? 'bg-green-50 border-green-600' : isDecrease ? 'bg-red-50 border-red-600' : 'bg-gray-50 border-gray-300'
              }`}>
                <p className={`text-3xl font-bold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-600'}`}>
                  {isIncrease ? '+' : ''}{percentageChange}%
                </p>
                <p className={`text-xs font-bold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-600'}`}>
                  {isIncrease ? 'increase' : isDecrease ? 'decrease' : 'no change'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={32} className="text-green-600" strokeWidth={2.5} />
          <div>
            <p className="font-bold text-gray-900 text-lg">{forecastData.confidence}</p>
            <p className="text-sm font-bold text-gray-600">Based on 4 weeks of weekday data</p>
          </div>
        </div>
      </div>
    </div>
  );
}