import { X, AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { InventoryItem } from '../types/inventory';
import { useState } from 'react';

interface LowStockAlertProps {
  lowStockItems: InventoryItem[];
  onGoToRestock: () => void;
  onClose: () => void;
}

export default function LowStockAlert({ lowStockItems, onGoToRestock, onClose }: LowStockAlertProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  if (lowStockItems.length === 0) {
    return null;
  }

  return (
      <div className="relative h-full overflow-hidden flex flex-col ">
        {/* Header */}
        <div className="shrink-0 p-4 pb-0">
            <div className="bg-red-600 rounded-lg p-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Low Stock Alert</h1>
              <button
                onClick={onClose}
                className="text-white active:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X size={28} strokeWidth={2.5} />
              </button>
            </div>
          </div> 

          {/* Content */}
          <div className="p-4">
            <div className="mb-4">
              <p className="text-gray-900 font-bold text-lg">
                {lowStockItems.length} ingredient{lowStockItems.length !== 1 ? 's' : ''} below minimum stock level
              </p>
              <p className="text-gray-600 font-bold text-sm">
                Review items that need restocking
              </p>
            </div>

            {/* Low Stock Items List */}
            <div className="space-y-3">
              {lowStockItems.map(item => {
                return (
                  <div
                    key={item.id}
                    className="w-full bg-red-50 border-2 border-red-600 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                        <p className="text-gray-600 font-bold text-sm">{item.category}</p>
                      </div>
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className="text-gray-600 hover:text-gray-900 active:text-gray-900 transition-colors"
                      >
                        {expandedItems.has(item.id) ? <ChevronUp size={24} strokeWidth={2.5} /> : <ChevronDown size={24} strokeWidth={2.5} />}
                      </button>
                    </div>

                    {expandedItems.has(item.id) && (
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-gray-600 font-bold text-xs">Current Stock</p>
                          <p className="text-red-600 font-bold text-2xl">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-600 font-bold text-xs">Min Stock</p>
                          <p className="text-orange-600 font-bold text-2xl">
                            {item.minQuantity} {item.unit}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 space-y-2">
              <button
                onClick={onGoToRestock}
                className="w-full bg-orange-600 text-white rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-700 transition-colors"
              >
                <Package size={24} strokeWidth={2.5} />
                Go to Restock
              </button>
              <button
                onClick={onClose}
                className="w-full bg-gray-600 text-white rounded-lg p-4 font-bold text-lg active:bg-gray-700 transition-colors"
              >
                I'll Restock Later
              </button>
            </div>
          </div>
        </div>
      // </div>
  );
}