import React from 'react';
import { CloudRain, ChevronRight, BarChart3 } from 'lucide-react';

interface DailyPrepForecastProps {
  onViewDetails: () => void;
  recommendations: Array<{ name: string; prep: number; change: number }> | undefined;
}

export default function DailyPrepForecast({ onViewDetails, recommendations }: DailyPrepForecastProps) {
  if (!recommendations) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 flex flex-col items-center justify-center text-center animate-pulse">
        <div className="bg-orange-200 h-12 w-12 rounded-full mb-3"></div>
        <h2 className="text-lg font-bold text-orange-400 mb-1">Loading Forecast...</h2>
      </div>
    );
  }

  // Empty State: Not enough data
  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-3 rounded-full shadow-sm mb-3">
          <BarChart3 size={28} className="text-gray-400" strokeWidth={2.5} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Forecast Unavailable</h2>
        <p className="text-gray-600 font-medium text-sm">
          Record more sales to unlock smart daily prep recommendations.
        </p>
      </div>
    );
  }

  const totalRecommendedPortions = recommendations.reduce((sum, item) => sum + item.prep, 0);

  return (
    <div 
      onClick={onViewDetails}
      className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-500 rounded-lg p-4 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Demand Forecast</h2>
      </div>

      <div className="mb-4">
        <p className="text-gray-600 font-bold text-sm mb-1">Total Portions Expected</p>
        <p className="text-orange-500 font-bold text-5xl">{totalRecommendedPortions}</p>
      </div>

      <div className="mb-4 space-y-2">
        {recommendations.slice(0, 3).map((dish, index) => (
          <div key={index} className="flex items-center justify-between">
            <p className="text-gray-900 font-semibold text-sm">{dish.name}</p>
            <p className="text-orange-500 font-bold text-lg">{dish.prep}</p>
          </div>
        ))}
      </div>

      <button className="w-full mt-2 text-orange-500 font-bold text-base flex items-center justify-center gap-2">
        View Prep Guide
        <ChevronRight size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}