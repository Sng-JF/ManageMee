import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { categories } from '../data/constants';
import AddEditItem from './AddEditItem';
import LowStockAlert from './LowStockAlert';
import RestockModal from './RestockModal';
import { InventoryItem } from '../types/inventory';

interface InventoryListProps {
  initialSubTab?: 'stock' | 'restock';
  onFormStateChange?: (isOpen: boolean) => void;
}

export default function InventoryList({ initialSubTab = 'stock', onFormStateChange }: InventoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockingItem, setRestockingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'restock'>(initialSubTab === 'restock' ? 'restock' : 'overview');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    // Collapse categories with no items by default
    const collapsed = new Set<string>();
    categories.forEach(category => {
      const hasItems = initialItems.some(item => item.category === category);
      if (!hasItems) {
        collapsed.add(category);
      }
    });
    return collapsed;
  });

  // Check for low stock items on mount - only show once per session
  useEffect(() => {
    const hasShownAlert = sessionStorage.getItem('lowStockAlertShown');
    if (!hasShownAlert) {
      const lowStockItems = items.filter(item => item.quantity < item.minQuantity);
      if (lowStockItems.length > 0) {
        setShowLowStockAlert(true);
        sessionStorage.setItem('lowStockAlertShown', 'true');
      }
    }
  }, [items]);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddItem = (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: Date.now().toString(),
      lastUpdated: new Date().toISOString()
    };
    setItems([...items, newItem]);
    setShowAddEdit(false);
    if (onFormStateChange) {
      onFormStateChange(false);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setItems(items.map(i => i.id === item.id ? item : i));
    setShowAddEdit(false);
    setEditingItem(null);
    if (onFormStateChange) {
      onFormStateChange(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setShowAddEdit(true);
    if (onFormStateChange) {
      onFormStateChange(true);
    }
  };

  const handleClose = () => {
    setShowAddEdit(false);
    setEditingItem(null);
    if (onFormStateChange) {
      onFormStateChange(false);
    }
  };

  const handleRestockClick = (item: InventoryItem) => {
    setRestockingItem(item);
    setShowRestockModal(true);
  };

  const handleRestock = (itemId: string, quantity: number, supplier: string, estimatedCost: number) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            pendingRestock: {
              quantity,
              supplier,
              estimatedCost,
              date: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString() 
          }
        : item
    ));
    setShowRestockModal(false);
    setRestockingItem(null);
  };

  const handleLowStockSelect = (item: InventoryItem) => {
    setShowLowStockAlert(false);
    setRestockingItem(item);
    setShowRestockModal(true);
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Show low stock alert modal
  if (showLowStockAlert) {
    const lowStockItems = items.filter(item => item.quantity < item.minQuantity);
    return (
      <LowStockAlert
        lowStockItems={lowStockItems}
        onGoToRestock={() => {
          setShowLowStockAlert(false);
          setActiveTab('restock');
        }}
        onClose={() => setShowLowStockAlert(false)}
      />
    );
  }

  // Show restock modal
  if (showRestockModal && restockingItem) {
    return (
      <RestockModal
        item={restockingItem}
        onRestock={handleRestock}
        onClose={() => {
          setShowRestockModal(false);
          setRestockingItem(null);
        }}
      />
    );
  }

  if (showAddEdit) {
    return (
      <AddEditItem
        item={editingItem}
        onSave={editingItem ? handleEditItem : handleAddItem}
        onCancel={handleClose}
      />
    );
  }

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  // For restock tab: separate low stock and optional restock items
  const lowStockItems = activeTab === 'restock' 
    ? filteredItems.filter(item => item.quantity < item.minQuantity)
    : [];
  
  const optionalRestockItems = activeTab === 'restock'
    ? filteredItems.filter(item => item.quantity >= item.minQuantity)
    : [];

  // Filter items based on active tab
  const displayItems = activeTab === 'restock' 
    ? filteredItems
    : filteredItems;

  const displayGroupedItems = (activeTab === 'overview' ? displayItems : lowStockItems).reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const optionalGroupedItems = optionalRestockItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const lowStockCount = items.filter(item => item.quantity < item.minQuantity).length;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-orange-500 rounded-lg p-4 mb-4">
          <h1 className="text-3xl font-bold text-white">Inventory</h1>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 p-4 rounded-lg font-bold text-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            All Stock
          </button>
          <button
            onClick={() => setActiveTab('restock')}
            className={`flex-1 p-4 rounded-lg font-bold text-lg transition-colors relative ${
              activeTab === 'restock'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            Restock
            {lowStockCount > 0 && (
              <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                activeTab === 'restock' ? 'bg-red-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {lowStockCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600" 
            size={24}
            strokeWidth={2.5}
          />
          <input
            type="text"
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-4 py-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
          />
        </div>

        {/* Add New Button - only shown in All Stock tab */}
        {activeTab === 'overview' && (
          <button
            onClick={() => {
              setShowAddEdit(true);
              if (onFormStateChange) {
                onFormStateChange(true);
              }
            }}
            className="w-full bg-orange-500 text-white rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-600 transition-colors"
          >
            <Plus size={28} strokeWidth={2.5} />
            Add New Ingredient
          </button>
        )}
      </div>

      {/* Inventory List by Category */}
      <div className="space-y-3 mb-6">
        {categories.map(category => {
          const categoryItems = groupedItems[category] || [];
          const itemCount = categoryItems.length;
          const isCollapsed = collapsedCategories.has(category);
          
          return (
            <div key={category}>
              {/* Collapsible Category Header */}
              <button
                onClick={() => toggleCategoryCollapse(category)}
                className="w-full bg-gray-100 border-2 border-gray-300 rounded-lg p-4 flex items-center justify-between active:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight size={24} className="text-gray-600" strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={24} className="text-gray-600" strokeWidth={2.5} />
                  )}
                  <h2 className="text-xl font-bold text-gray-900">{category}</h2>
                </div>
                <span className="text-orange-500 font-bold text-lg">
                  {itemCount} {itemCount === 1 ? 'ingredient' : 'ingredients'}
                </span>
              </button>

              {/* Category Items */}
              {!isCollapsed && (
                <div className="space-y-2 mt-2">
                  {itemCount === 0 ? (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <p className="text-gray-500 font-bold">No ingredients in this category yet</p>
                    </div>
                  ) : (
                    categoryItems.map(item => {
                      const isLow = item.quantity < item.minQuantity;
                      const hasPendingRestock = !!item.pendingRestock;
                      
                      // If pending restock, use yellow; otherwise use red for low or green for good
                      const statusColor = hasPendingRestock ? 'yellow' : (isLow ? 'red' : 'green');
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-white border-2 border-gray-300 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                              <p className="text-gray-600 font-bold text-sm">{item.supplier}</p>
                            </div>
                            {/* Edit button - only shown in All Stock tab */}
                            {activeTab === 'overview' && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="text-orange-600 p-2 active:bg-orange-100 rounded-lg transition-colors"
                              >
                                <Edit2 size={24} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-${statusColor}-600 font-bold text-2xl`}>
                                {item.quantity} {item.unit}
                              </p>
                              <p className="text-gray-600 font-bold text-sm">
                                Min: {item.minQuantity} {item.unit}
                              </p>
                            </div>
                            <div>
                              <div className={`${hasPendingRestock ? 'bg-yellow-600 text-gray-900' : `bg-${statusColor}-600 text-white`} px-4 py-2 rounded font-bold mb-1`}>
                                {hasPendingRestock ? 'PENDING' : (isLow ? 'LOW' : 'GOOD')}
                              </div>
                            </div>
                          </div>
                          
                          {/* Pending Restock Info */}
                          {hasPendingRestock && (
                            <div className="mt-3 bg-yellow-50 border-2 border-yellow-600 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-yellow-900 font-bold text-xs flex items-center gap-1">
                                  <Package size={14} strokeWidth={2.5} />
                                  RESTOCK PENDING
                                </p>
                                <p className="text-yellow-700 font-bold text-sm">
                                  +{item.pendingRestock!.quantity.toFixed(1)} {item.unit}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <p className="text-gray-600 font-bold">
                                  {item.pendingRestock!.supplier}
                                </p>
                                <p className="text-gray-900 font-bold">
                                  ${item.pendingRestock!.estimatedCost.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Restock Button - shown in restock tab only for items without pending restock */}
                          {activeTab === 'restock' && isLow && !hasPendingRestock && (
                            <button
                              onClick={() => handleRestockClick(item)}
                              className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold text-base flex items-center justify-center gap-2 active:bg-orange-700 transition-colors mt-3"
                            >
                              <Package size={20} strokeWidth={2.5} />
                              Restock Now
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Optional Restock Section - only shown in Restock tab */}
      {activeTab === 'restock' && Object.keys(optionalGroupedItems).length > 0 && (
        <>
          <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4 mb-3">
            <p className="text-blue-900 font-bold text-sm text-center">
              ℹ️ Optional Restock - These ingredients don't need immediate restocking
            </p>
          </div>
          
          <div className="space-y-3 mb-6">
            {categories.map(category => {
              const categoryItems = optionalGroupedItems[category] || [];
              const itemCount = categoryItems.length;
              const isCollapsed = collapsedCategories.has(category);
              
              // Skip categories with no items in optional section
              if (itemCount === 0) return null;
              
              return (
                <div key={`optional-${category}`}>
                  {/* Collapsible Category Header */}
                  <button
                    onClick={() => toggleCategoryCollapse(category)}
                    className="w-full bg-gray-100 border-2 border-gray-300 rounded-lg p-4 flex items-center justify-between active:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight size={24} className="text-gray-600" strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={24} className="text-gray-600" strokeWidth={2.5} />
                      )}
                      <h2 className="text-xl font-bold text-gray-900">{category}</h2>
                    </div>
                    <span className="text-orange-500 font-bold text-lg">
                      {itemCount} {itemCount === 1 ? 'ingredient' : 'ingredients'}
                    </span>
                  </button>

                  {/* Category Items */}
                  {!isCollapsed && (
                    <div className="space-y-2 mt-2">
                      {categoryItems.map(item => {
                        const hasPendingRestock = !!item.pendingRestock;
                        const statusColor = hasPendingRestock ? 'yellow' : 'green';
                        
                        return (
                          <div
                            key={item.id}
                            className="bg-white border-2 border-gray-300 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                                <p className="text-gray-600 font-bold text-sm">{item.supplier}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`text-${statusColor}-600 font-bold text-2xl`}>
                                  {item.quantity} {item.unit}
                                </p>
                                <p className="text-gray-600 font-bold text-sm">
                                  Min: {item.minQuantity} {item.unit}
                                </p>
                              </div>
                              <div>
                                <div className={`${hasPendingRestock ? 'bg-yellow-600 text-gray-900' : 'bg-green-600 text-white'} px-4 py-2 rounded font-bold mb-1`}>
                                  {hasPendingRestock ? 'PENDING' : 'GOOD'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Pending Restock Info */}
                            {hasPendingRestock && (
                              <div className="mt-3 bg-yellow-50 border-2 border-yellow-600 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-yellow-900 font-bold text-xs flex items-center gap-1">
                                    <Package size={14} strokeWidth={2.5} />
                                    RESTOCK PENDING
                                  </p>
                                  <p className="text-yellow-700 font-bold text-sm">
                                    +{item.pendingRestock!.quantity.toFixed(1)} {item.unit}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <p className="text-gray-600 font-bold">
                                    {item.pendingRestock!.supplier}
                                  </p>
                                  <p className="text-gray-900 font-bold">
                                    ${item.pendingRestock!.estimatedCost.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Restock Button for optional items */}
                            {!hasPendingRestock && (
                              <button
                                onClick={() => handleRestockClick(item)}
                                className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold text-base flex items-center justify-center gap-2 active:bg-orange-700 transition-colors mt-3"
                              >
                                <Package size={20} strokeWidth={2.5} />
                                Restock (Optional)
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}