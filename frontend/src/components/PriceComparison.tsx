import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { inventoryItems as initialItems } from '../data/mockData';
import { supplierPrices } from '../data/supplierPrices';
import { InventoryItem } from '../types/inventory';
import LogPrice from './LogPrice';
import AddEditItem from './AddEditItem';

export default function PriceComparison({ onFormStateChange, hideHeader }: { onFormStateChange?: (isOpen: boolean) => void; hideHeader?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showLogPrice, setShowLogPrice] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>(initialItems);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  const handleLogPrice = (itemId: string) => {
    setSelectedItem(itemId);
    setShowLogPrice(true);
    if (onFormStateChange) {
      onFormStateChange(true);
    }
  };

  const handleAddItem = (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: Date.now().toString(),
      lastUpdated: new Date().toISOString()
    };
    setItems([...items, newItem]);
    setShowAddItem(false);
  };

  const getSupplierPricesForItem = (itemId: string) => {
    return supplierPrices.filter(sp => sp.inventoryItemId === itemId);
  };

  const calculateAveragePrice = (itemId: string) => {
    const prices = getSupplierPricesForItem(itemId);
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, sp) => acc + sp.price, 0);
    return sum / prices.length;
  };

  const getPriceStatus = (price: number, average: number) => {
    const difference = ((price - average) / average) * 100;
    if (difference <= -5) return { color: 'green', label: 'BEST', icon: TrendingDown };
    if (difference >= 5) return { color: 'red', label: 'HIGH', icon: TrendingUp };
    return { color: 'orange', label: 'AVG', icon: DollarSign };
  };

  if (showLogPrice) {
    return (
      <LogPrice
        itemId={selectedItem}
        onClose={() => {
          setShowLogPrice(false);
          setSelectedItem(null);
          if (onFormStateChange) {
            onFormStateChange(false);
          }
        }}
      />
    );
  }

  if (showAddItem) {
    return (
      <AddEditItem
        onSave={handleAddItem}
        onCancel={() => setShowAddItem(false)}
      />
    );
  }

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof initialItems>);

  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-orange-500 rounded-lg p-4 mb-2">
          <h1 className="text-3xl font-bold text-white">Track Prices</h1>
        </div>
        <p className="text-gray-600 font-medium px-1">Monitor and log supplier ingredient costs</p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search 
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" 
          size={24}
          strokeWidth={2.5}
        />
        <input
          type="text"
          placeholder="Search ingredients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl font-bold text-lg focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 transition-all shadow-sm"
        />
      </div>

      {/* Ingredient Cards by Category */}
      <div className="space-y-8">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
              {category}
            </h2>
            <div className="space-y-3">
              {categoryItems.map(item => {
                const isExpanded = expandedItemId === item.id;
                const itemSupplierPrices = getSupplierPricesForItem(item.id);
                const averagePrice = calculateAveragePrice(item.id);
                const bestPrice = itemSupplierPrices.length > 0 
                  ? Math.min(...itemSupplierPrices.map(sp => sp.price))
                  : item.targetPrice;

                return (
                  <div
                    key={item.id}
                    className={`bg-white border-2 rounded-xl shadow-sm transition-all overflow-hidden ${
                      isExpanded ? 'border-orange-500 shadow-md' : 'border-gray-200'
                    }`}
                  >
                    {/* Compact View */}
                    <div
                      onClick={() => toggleExpanded(item.id)}
                      className="p-4 cursor-pointer active:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg mb-1">
                            {item.name}
                          </h3>
                          <div className="flex items-baseline gap-2">
                            <p className="text-gray-500 font-bold text-sm">Target:</p>
                            <p className="text-gray-900 font-black text-xl">
                              ${item.targetPrice.toFixed(2)}
                            </p>
                            <p className="text-gray-500 font-bold text-sm">
                              per {item.unit}
                            </p>
                          </div>
                          {itemSupplierPrices.length > 0 && (
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-gray-500 font-bold text-sm">Best:</p>
                              <p className="text-green-600 font-black text-lg">
                                ${bestPrice.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Expand Icon */}
                        <div className={`p-2 rounded-full ${isExpanded ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                          {isExpanded ? (
                            <ChevronUp size={24} strokeWidth={2.5} />
                          ) : (
                            <ChevronDown size={24} strokeWidth={2.5} />
                          )}
                        </div>
                      </div>

                      {!isExpanded && (
                        <p className="text-gray-500 font-medium text-sm mt-3 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {itemSupplierPrices.length} suppliers • Tap to compare
                        </p>
                      )}
                    </div>

                    {/* Expanded View - Supplier Prices */}
                    {isExpanded && (
                      <div className="border-t-2 border-gray-100 bg-gray-50 p-4">
                        {/* Market Average */}
                        {itemSupplierPrices.length > 0 && (
                          <div className="bg-white border-2 border-blue-200 shadow-sm rounded-xl p-4 mb-4">
                            <p className="text-blue-900 font-bold text-xs uppercase tracking-wider mb-1">Market Average</p>
                            <p className="text-blue-600 font-black text-2xl">
                              ${averagePrice.toFixed(2)} <span className="text-sm font-bold text-blue-400">per {item.unit}</span>
                            </p>
                          </div>
                        )}

                        {/* Supplier Price List */}
                        <div className="space-y-3 mb-4">
                          {itemSupplierPrices.length > 0 ? (
                            itemSupplierPrices.map((sp, index) => {
                              const status = getPriceStatus(sp.price, averagePrice);
                              const StatusIcon = status.icon;
                              
                              return (
                                <div
                                  key={index}
                                  className={`bg-white border-2 border-${status.color}-200 shadow-sm rounded-xl p-4 relative overflow-hidden`}
                                >
                                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-${status.color}-500`}></div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <p className="font-bold text-gray-900 text-lg">{sp.supplierName}</p>
                                      <p className="text-gray-500 font-medium text-xs">
                                        Updated: {sp.lastUpdated}
                                      </p>
                                    </div>
                                    <div className={`bg-${status.color}-100 text-${status.color}-700 px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1`}>
                                      <StatusIcon size={16} strokeWidth={3} />
                                      {status.label}
                                    </div>
                                  </div>
                                  <p className={`text-${status.color}-600 font-black text-2xl`}>
                                    ${sp.price.toFixed(2)} <span className={`text-sm font-bold text-${status.color}-400`}>per {item.unit}</span>
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="bg-white border-2 border-gray-200 border-dashed rounded-xl p-6 text-center">
                              <DollarSign size={32} className="mx-auto text-gray-300 mb-2" />
                              <p className="text-gray-500 font-bold">No prices logged yet</p>
                            </div>
                          )}
                        </div>

                        {/* Log Price Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogPrice(item.id);
                          }}
                          className="w-full bg-white text-orange-600 border-2 border-orange-200 rounded-xl p-4 font-bold text-lg flex items-center justify-center gap-2 hover:bg-orange-50 active:bg-orange-100 transition-colors shadow-sm"
                        >
                          <Plus size={24} strokeWidth={2.5} />
                          Log New Price
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
