import { useState } from 'react';
import { Plus, Edit2, Zap, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { menuItems as initialMenuItems } from '../data/menuData';
import { dishCategories } from '../data/constants';
import { MenuItem } from '../types/menu';
import EditMenuItem from './EditMenuItem';
import DishAvailability from './DishAvailability';
import QuickSale from './QuickSale';

interface MenuManagerProps {
  initialSubTab?: 'all' | 'work';
  onFormStateChange?: (isOpen: boolean) => void;
}

export default function MenuManager({ initialSubTab = 'all', onFormStateChange }: MenuManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [quickSaleItem, setQuickSaleItem] = useState<MenuItem | null>(null);
  const activeTab = initialSubTab; // Use prop directly instead of state
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    // Collapse categories with no dishes by default
    const collapsed = new Set<string>();
    dishCategories.forEach(category => {
      const hasItems = initialMenuItems.some(item => item.category === category);
      if (!hasItems) {
        collapsed.add(category);
      }
    });
    return collapsed;
  });

  const handleSaveMenuItem = (item: MenuItem) => {
    if (editingItem) {
      setMenuItems(menuItems.map(m => m.id === item.id ? item : m));
    } else {
      setMenuItems([...menuItems, item]);
    }
    setShowEdit(false);
    setEditingItem(null);
    if (onFormStateChange) {
      onFormStateChange(false);
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

  const handleDelete = (id: string) => {
    setMenuItems(menuItems.filter(m => m.id !== id));
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

  if (showEdit) {
    return (
      <EditMenuItem
        item={editingItem}
        onSave={handleSaveMenuItem}
        onCancel={handleClose}
        onDelete={handleDelete}
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
    <div className="p-3">
      {/* Header */}
      <div className="mb-3">
        <div className="bg-orange-600 rounded-lg p-3 mb-4 mt-4">
          <h1 className="text-2xl font-bold text-white">Menu</h1>
        </div>
        
        {/* Search Bar */}
        <div className="relative" style={{marginTop: '15px', marginBottom: '15px'}}>
          <Search 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600" 
            size={20}
            strokeWidth={2.5}
          />
          <input
            type="text"
            placeholder="Search dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3  border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
    
          />
        </div>

        {/* Add New Dish Button */}
        <button
            onClick={() => {
              setShowEdit(true);
              if (onFormStateChange) {
                onFormStateChange(true);
              }
            }}
            className="w-full bg-orange-500  rounded-lg p-2 font-bold text-base flex items-center justify-center gap-2 active:bg-orange-700 transition-colors mt-2"
          >
            <Plus size={28} strokeWidth={2.5} />
            Add New Dish
          </button>
      </div>

      {/* Menu Items by Category */}
      <div className="space-y-2 mb-3">{dishCategories.map(category => {
          const items = groupedItems[category] || [];
          const itemCount = items.length;
          const isCollapsed = collapsedCategories.has(category);
          
          return (
            <div key={category}>
              {/* Collapsible Category Header */}
              <button
                onClick={() => toggleCategoryCollapse(category)}
                className="w-full bg-gray-100 border-2 border-gray-300 rounded-lg p-3 flex items-center justify-between active:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={20} className="text-gray-600" strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={20} className="text-gray-600" strokeWidth={2.5} />
                  )}
                  <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                </div>
                <span className="text-orange-500 font-bold text-sm">
                  {itemCount} {itemCount === 1 ? 'dish' : 'dishes'}
                </span>
              </button>

              {/* Category Items */}
              {!isCollapsed && (
                <div className="space-y-2 mt-2">
                  {itemCount === 0 ? (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <p className="text-gray-500 font-bold">No dishes in this category yet</p>
                    </div>
                  ) : (
                    items.map(item => {
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
                                {/* Dish Image */}
                                <div className="flex-shrink-0">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-16 h-16 rounded-lg border-2 border-gray-300 object-cover"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 rounded-lg border-2 border-gray-300 bg-gray-100"></div>
                                  )}
                                </div>

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
                                    <ChevronDown size={24} strokeWidth={2.5} />
                                  ) : (
                                    <ChevronRight size={24} strokeWidth={2.5} />
                                  )}
                                </div>
                              </div>

                              {/* Ingredient Count Preview */}
                              {!isExpanded && (
                                <div className="mt-2 flex items-center gap-2">
                                  <p className="text-gray-600 font-bold text-xs">
                                    {item.ingredients.length} {item.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
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
                                {/*<DishAvailability menuItem={item} />*/}

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
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
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