import { useState, useEffect } from 'react';
import { Plus, Edit2, Zap, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { MenuItem } from '../types/menu';
import EditMenuItem from './EditMenuItem';
import DishAvailability from './DishAvailability';
import QuickSale from './QuickSale';

interface MenuManagerProps {
  initialSubTab?: 'all' | 'work';
  onFormStateChange?: (isOpen: boolean) => void;
}

export default function MenuManager({ initialSubTab = 'all', onFormStateChange }: MenuManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [quickSaleItem, setQuickSaleItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'work'>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('http://localhost:5432/api/menu')
      .then(res => res.json())
      .then(data => setMenuItems(data))
      .catch(err => console.error('Failed to load menu:', err));
  }, []);

  const handleSaveMenuItem = async (item: MenuItem) => {
    try {
      // Note: You'll need to separate logic here for POST (new) vs PUT/PATCH (edit)
      const isNew = !editingItem;
      const url = isNew ? 'http://localhost:5432/api/menu' : `http://localhost:5432/api/menu/${item.id}`;
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      const savedItem = await response.json();

      if (isNew) {
        setMenuItems([...menuItems, savedItem]);
      } else {
        setMenuItems(menuItems.map(m => m.id === savedItem.id ? savedItem : m));
      }
      
      setShowEdit(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving menu item:', error);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setShowEdit(true);
    if (onFormStateChange) {
      onFormStateChange(true);
    }
  };

  const handleClose = () => {
    setShowEdit(false);
    setEditingItem(null);
    if (onFormStateChange) {
      onFormStateChange(false);
    }
  };

  const handleQuickSale = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickSaleItem(item);
  };

  const handleSaleConfirm = (updates: { id: string; newQuantity: number }[]) => {
    // In real app, update inventory here
    console.log('Inventory updates:', updates);
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  if (showEdit) {
    return (
      <EditMenuItem
        item={editingItem}
        onSave={handleSaveMenuItem}
        onCancel={handleClose}
      />
    );
  }

  // Filter items by search query
  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const groupedItems = filteredMenuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-orange-600 rounded-lg p-4 mb-4">
          <h1 className="text-3xl font-bold text-white">Menu</h1>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 p-4 rounded-lg font-bold text-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            All Dishes
          </button>
          <button
            onClick={() => setActiveTab('work')}
            className={`flex-1 p-4 rounded-lg font-bold text-lg transition-colors ${
              activeTab === 'work'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            Order
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
            placeholder="Search dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-4 py-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
          />
        </div>
        
        {/* Create New Recipe Button - only shown in All Dishes tab */}
        {activeTab === 'all' && (
          <button
            onClick={() => {
              setShowEdit(true);
              if (onFormStateChange) {
                onFormStateChange(true);
              }
            }}
            className="w-full bg-orange-600 text-white rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-700 transition-colors"
          >
            <Plus size={28} strokeWidth={2.5} />
            Add New Dish
          </button>
        )}
      </div>

      {/* Menu Items by Category */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{category}</h2>
            <div className="space-y-2">
              {items.map(item => {
                const isExpanded = expandedItemId === item.id;
                
                return (
                  <div key={item.id}>
                    {/* Compact Menu Item Card */}
                    <div
                      className={`bg-white border-2 rounded-lg transition-all ${
                        isExpanded ? 'border-orange-600' : 'border-gray-300'
                      }`}
                    >
                      {/* Header - Always Visible */}
                      <div
                        onClick={() => toggleExpanded(item.id)}
                        className="p-4 cursor-pointer active:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          {/* Dish Info */}
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">
                              {item.name}
                            </h3>
                            <p className="text-orange-600 font-bold text-xl">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>

                          {/* Quick Sale Button - only shown in Work Mode */}
                          {activeTab === 'work' && (
                            <button
                              onClick={(e) => handleQuickSale(item, e)}
                              className="bg-green-600 text-white rounded-lg px-4 py-3 font-bold flex items-center gap-2 active:bg-green-700 transition-colors"
                            >
                              <Zap size={20} strokeWidth={2.5} />
                              <span className="text-sm">SELL</span>
                            </button>
                          )}

                          {/* Expand Icon */}
                          <div className="text-gray-600">
                            {isExpanded ? (
                              <ChevronUp size={24} strokeWidth={2.5} />
                            ) : (
                              <ChevronDown size={24} strokeWidth={2.5} />
                            )}
                          </div>
                        </div>

                        {/* Ingredient Count Preview */}
                        {!isExpanded && (
                          <div className="mt-2 flex items-center gap-2">
                            <p className="text-gray-600 font-bold text-xs">
                              {item.ingredients.length} ingredients
                            </p>
                            <span className="text-gray-400">•</span>
                            <p className="text-gray-600 font-bold text-xs">
                              Tap for details
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t-2 border-gray-200 p-4 space-y-4">
                          {/* Ingredients List */}
                          <div>
                            <p className="font-bold text-gray-900 mb-2">Ingredients per Portion:</p>
                            <div className="space-y-2">
                              {item.ingredients.map((ingredient, idx) => (
                                <div
                                  key={idx}
                                  className="bg-gray-50 border border-gray-300 rounded-lg p-2 flex items-center justify-between"
                                >
                                  <p className="font-bold text-gray-900 text-sm">
                                    {ingredient.inventoryItemName}
                                  </p>
                                  <p className="font-bold text-orange-600">
                                    {ingredient.quantity} {ingredient.unit}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Dish Availability Widget */}
                          <DishAvailability menuItem={item} />

                          {/* Edit Button - only shown in All Dishes tab */}
                          {activeTab === 'all' && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold flex items-center justify-center gap-2 active:bg-orange-700 transition-colors"
                            >
                              <Edit2 size={20} strokeWidth={2.5} />
                              Edit Dish
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Sale Modal */}
      {quickSaleItem && (
        <QuickSale
          menuItem={quickSaleItem}
          onClose={() => setQuickSaleItem(null)}
          onConfirm={handleSaleConfirm}
        />
      )}
    </div>
  );
}