import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Zap, ChevronDown, ChevronRight, Search, Mic, X } from 'lucide-react';
import { dishCategories } from '../data/constants';
import wontonmeeImg from '../assets/wontonmee.png';
import roastedcrImg from '../assets/roastedcr.png';
import currylaksaImg from '../assets/currylaksa.png';
import cktImg from '../assets/ckt.png';
import { CreateSalePayload, MenuItem, MenuItemPayload } from '../types/menu';
import { InventoryItem } from '../types/inventory';
import { createMenuItem, deleteMenuItem, getMenuItems, updateMenuItem } from '../services/menu';
import { getInventory } from '../services/inventory';
import { createSale } from '../services/sales';
import EditMenuItem from './EditMenuItem';
import DishAvailability from './DishAvailability';
import QuickSale from './QuickSale';

interface MenuManagerProps {
  initialSubTab?: 'all' | 'work';
  onFormStateChange?: (isOpen: boolean) => void;
  onExitToHome?: () => void;
  onSaleRecorded?: () => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const LOCAL_IMAGES: Record<string, string> = {
  'Wonton Mee': wontonmeeImg,
  'Roasted Chicken Rice': roastedcrImg,
  'Curry Laksa': currylaksaImg,
  'Char Kway Teow': cktImg,
};

const SPOKEN_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const normalizeVoiceText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseVoiceQuantity = (transcript: string) => {
  const normalized = normalizeVoiceText(transcript);
  const firstWord = normalized.split(' ')[0];

  if (!firstWord) {
    return 1;
  }

  if (/^\d+$/.test(firstWord)) {
    return Math.max(1, parseInt(firstWord, 10));
  }

  return SPOKEN_NUMBERS[firstWord] ?? 1;
};

const findMenuItemFromTranscript = (transcript: string, items: MenuItem[]) => {
  const normalizedTranscript = normalizeVoiceText(transcript);

  return [...items]
    .sort(
      (a, b) =>
        normalizeVoiceText(b.name).length - normalizeVoiceText(a.name).length,
    )
    .find((item) =>
      normalizedTranscript.includes(normalizeVoiceText(item.name)),
    );
};

export default function MenuManager({ initialSubTab = 'all', onFormStateChange, onExitToHome, onSaleRecorded }: MenuManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [quickSaleItem, setQuickSaleItem] = useState<MenuItem | null>(null);
  const activeTab = initialSubTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [voicePrefillQuantity, setVoicePrefillQuantity] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const loadMenuAndInventory = useCallback(async () => {
    try {
      const [menu, inventory] = await Promise.all([getMenuItems(), getInventory()]);
      setMenuItems(menu);
      setInventoryItems(inventory);

      const collapsed = new Set<string>();
      dishCategories.forEach((category) => {
        const hasItems = menu.some((menuItem) => menuItem.category === category);
        if (!hasItems) {
          collapsed.add(category);
        }
      });
      setCollapsedCategories(collapsed);
    } catch (error) {
      console.error('Failed to load menu/inventory:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    void loadMenuAndInventory();
  }, [loadMenuAndInventory]);

  useEffect(() => {
    if (activeTab === 'work') {
      onFormStateChange?.(true);

      return () => {
        onFormStateChange?.(false);
      };
    }
  }, [activeTab, onFormStateChange]);

  const handleSaveMenuItem = async (item: MenuItem | MenuItemPayload) => {
    try {
      let savedItem: MenuItem;

      if (editingItem) {
        savedItem = await updateMenuItem(editingItem.id, {
          name: item.name,
          price: item.price,
          category: item.category,
          ingredients: item.ingredients,
          image: item.image ?? null,
        });
        setMenuItems((prev) => prev.map((menuItem) => (menuItem.id === savedItem.id ? savedItem : menuItem)));
      } else {
        savedItem = await createMenuItem({
          name: item.name,
          price: item.price,
          category: item.category,
          ingredients: item.ingredients,
          image: item.image ?? null,
        });
        setMenuItems((prev) => [...prev, savedItem]);
      }

      setShowEdit(false);
      setEditingItem(null);
      if (onFormStateChange) {
        onFormStateChange(false);
      }
    } catch (error) {
      console.error('Failed to save menu item:', error);
      alert(error instanceof Error ? error.message : 'Failed to save menu item.');
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

  const handleDelete = async (
    id: string,
    salesAction: 'keep' | 'delete'
  ) => {
    try {
      await deleteMenuItem(id, salesAction);
      setMenuItems((prev) => prev.filter((menuItem) => menuItem.id !== id));
      setShowEdit(false);
      setEditingItem(null);
      onSaleRecorded?.();

      if (onFormStateChange) {
        onFormStateChange(false);
      }
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete menu item.');
    }
  };

  const handleQuickSale = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setVoicePrefillQuantity(1);
    setQuickSaleItem(item);
  };

  const handleSaleConfirm = async (payload: CreateSalePayload) => {
    try {
      await createSale(payload);
      onSaleRecorded?.();

      const refreshedInventory = await getInventory();
      setInventoryItems(refreshedInventory);
    } catch (error) {
      console.error('Failed to record sale:', error);
      throw error;
    }
  };

  const handleExitToHome = () => {
    onFormStateChange?.(false);
    onExitToHome?.();
  };

  const handleVoiceOrder = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice ordering is not supported on this device/browser.');
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-SG';
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      const matchedMenuItem = findMenuItemFromTranscript(transcript, menuItems);

      if (!matchedMenuItem) {
        alert(`Could not match a dish from "${transcript}".`);
        return;
      }

      setVoicePrefillQuantity(parseVoiceQuantity(transcript));
      setQuickSaleItem(matchedMenuItem);
    };

    recognition.onerror = (event) => {
      console.error('Voice order error:', event.error);
      alert('Unable to capture the voice order. Please try again.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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

  // Filter items by search query
  const filteredMenuItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [menuItems, searchQuery],
  );

  if (showEdit) {
    return (
      <EditMenuItem
        item={editingItem}
        inventoryItems={inventoryItems}
        onSave={handleSaveMenuItem}
        onCancel={handleClose}
        onDelete={handleDelete}
      />
    );
  }

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
          {activeTab === 'work' ? (
            <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex items-center justify-between z-10 mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Track Orders</h1>
              <button
                onClick={handleExitToHome}
                className="text-gray-600 active:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X size={28} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div className="bg-orange-600 rounded-lg p-4 mb-4">
              <h1 className="text-3xl font-bold text-white">Menu</h1>
            </div>
          )}
        
        {/* Search Bar */}
        <div className="relative" style={{marginTop: '30px'}}>
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
              setEditingItem(null);
              setShowEdit(true);
              if (onFormStateChange) {  
                onFormStateChange(true);
              }
            }}
            className="w-full bg-orange-600 text-white rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-2 active:bg-orange-700 transition-colors mt-4"
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
                <span className="text-orange-600 font-bold text-lg">
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
                                  {(item.image || LOCAL_IMAGES[item.name]) ? (
                                    <img
                                      src={item.image || LOCAL_IMAGES[item.name]}
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

      {activeTab === 'work' && !quickSaleItem && (
        <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-4 z-20 pointer-events-none">
          <div className="flex justify-center">
            <button
              onClick={handleVoiceOrder}
              className={`pointer-events-auto w-20 h-20 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white transition-colors ${
                isListening
                  ? 'bg-red-600 active:bg-red-700 animate-pulse'
                  : 'bg-orange-600 active:bg-orange-700'
              }`}
            >
              <Mic size={32} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Sale Modal */}
      {quickSaleItem && (
        <QuickSale
          menuItem={quickSaleItem}
          inventoryItems={inventoryItems}
          initialQuantity={voicePrefillQuantity}
          onClose={() => {
            setQuickSaleItem(null);
            setVoicePrefillQuantity(1);
          }}
          onConfirm={handleSaleConfirm}
        />
      )}
    </div>
  );
}