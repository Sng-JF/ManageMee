import React from 'react';
import { ChevronRight, BarChart3, ChefHat, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DailyPrepForecastProps {
  onViewDetails: () => void;
  recommendations: Array<{ name: string; prep: number; change: number }> | undefined;
}

const COLORS = [
  { dot: 'bg-orange-500', text: 'text-orange-600', row: 'bg-orange-50 border-orange-100' },
  { dot: 'bg-blue-500',   text: 'text-blue-600',   row: 'bg-blue-50 border-blue-100'   },
  { dot: 'bg-emerald-500',text: 'text-emerald-600',row: 'bg-emerald-50 border-emerald-100'},
];

export default function DailyPrepForecast({ onViewDetails, recommendations }: DailyPrepForecastProps) {
  if (!recommendations) {
    return (
      <div className="bg-white border-2 border-orange-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-pulse shadow-sm">
        <div className="bg-orange-100 h-12 w-12 rounded-full mb-3 flex items-center justify-center">
          <ChefHat className="text-orange-400" size={24} />
        </div>
        <p className="text-base font-bold text-orange-400">Cooking up forecast...</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
        <div className="bg-gray-50 p-4 rounded-full mb-3">
          <BarChart3 size={24} className="text-gray-400" strokeWidth={2.5} />
        </div>
        <p className="text-base font-bold text-gray-900 mb-1">Forecast Unavailable</p>
        <p className="text-gray-500 text-sm max-w-[200px]">
          Record more sales to unlock smart daily prep recommendations.
        </p>
      </div>
    );
  }

  const sorted = [...recommendations].sort((a, b) => b.prep - a.prep);
  const topItems = sorted.slice(0, 3);
  const totalPortions = recommendations.reduce((sum, item) => sum + item.prep, 0);

  return (
    <div
      onClick={onViewDetails}
      className="bg-white border-2 border-gray-200 rounded-2xl p-5 cursor-pointer active:scale-[0.98] transition-all shadow-md hover:shadow-lg hover:border-orange-300 group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="bg-orange-100 p-1.5 rounded-lg">
          <TrendingUp size={18} strokeWidth={2.5} className="text-orange-600" />
        </div>
        <h2 className="text-base font-black text-gray-900">Demand Forecast</h2>
        {/* <span className="ml-auto text-xs font-bold text-gray-400 uppercase tracking-wide">AI · Today</span> */}
      </div>
      <p className="text-gray-400 text-sm font-medium mb-4 ml-9">
        {totalPortions} total portions recommended
      </p>

      {/* Top Items */}
      <div className="space-y-2 mb-4">
        {topItems.map((dish, i) => {
          const c = COLORS[i];
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-1 rounded-xl border ${c.row}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                <p className="text-gray-900 font-bold text-sm truncate">{dish.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {/* {dish.change > 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    <TrendingUp size={9} /> +{dish.change}%
                  </span>
                ) : dish.change < 0 ? (
                  <span className="flex items-center gap-0.5 text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    <TrendingDown size={9} /> {dish.change}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    <Minus size={9} /> 0%
                  </span>
                )} */}
                <p className={`font-black font-bold text-base w-6 text-right ${c.text}`}>{dish.prep}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="w-full bg-gray-50 border-2 border-gray-100 text-gray-600 rounded-xl py-2 px-4 font-bold text-sm flex items-center justify-between group-hover:bg-orange-50 group-hover:border-orange-200 group-hover:text-orange-600 transition-colors">
        <span>View Full Prep Guide</span>
        <ChevronRight size={16} strokeWidth={3} />
      </div>
    </div>
  );
}