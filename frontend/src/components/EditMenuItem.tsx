import { useEffect, useState } from 'react';
import { X, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { MenuItem, MenuItemPayload, RecipeIngredient } from '../types/menu';
import { InventoryItem } from '../types/inventory';

interface EditMenuItemProps {
  item?: MenuItem | null;
  inventoryItems: InventoryItem[];
  onSave: (item: MenuItem | MenuItemPayload) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string, salesAction: 'keep' | 'delete') => void | Promise<void>;
}

const normalizeToSmallestUnit = (quantity: number, unit: string) => {
  if (unit === 'kg') return { quantity: quantity * 1000, unit: 'g' };
  if (unit === 'L') return { quantity: quantity * 1000, unit: 'ml' };
  return { quantity, unit };
}

export default function EditMenuItem({ item, inventoryItems, onSave, onCancel, onDelete }: EditMenuItemProps) {
  const [dishName, setDishName] = useState(item?.name || '');
  const [dishType, setDishType] = useState(item?.category || 'Rice Dishes');
  const [price, setPrice] = useState(item?.price ? item.price.toFixed(2) : '');
  const [dishImage, setDishImage] = useState<string | undefined>(item?.image);
  const [dishImagePreview, setDishImagePreview] = useState<string | undefined>(item?.image);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    () =>
      (item?.ingredients || []).map((ingredient) => {
        const normalized = normalizeToSmallestUnit(ingredient.quantity, ingredient.unit);

        return {
          ...ingredient,
          quantity: normalized.quantity,
          unit: normalized.unit,
        };
      })
  );
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);

  useEffect(() => {
  return () => {
    if (dishImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(dishImagePreview);
    }
  };
}, [dishImagePreview]);

  const resizeImageToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image.'));
      };

      img.onload = () => {
        try {
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          let { width, height } = img;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to process image.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.7);

          URL.revokeObjectURL(objectUrl);
          resolve(compressed);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };

      img.src = objectUrl;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previousImage = dishImage;
    const previousPreview = dishImagePreview;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDishImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const compressedImage = await resizeImageToDataUrl(file);
      setDishImage(compressedImage);
    } catch (error) {
      console.error('Failed to process image:', error);
      setDishImage(previousImage);
      setDishImagePreview(previousPreview);
      alert('Failed to process image.');
    }
  };

  const handleSave = async () => {
    const menuItem = {
      ...(item ? { id: item.id } : {}),
      name: dishName,
      price: parseFloat(price),
      category: dishType,
      ingredients,
      image: dishImage ?? null,
    };

    await onSave(menuItem);
  };

  const addIngredient = (inventoryItemId: string) => {
    const inventoryItem = inventoryItems.find(i => i.id === inventoryItemId);
    if (!inventoryItem) return;

    const normalized = normalizeToSmallestUnit(0, inventoryItem.unit);

    const newIngredient: RecipeIngredient = {
      inventoryItemId: inventoryItem.id,
      inventoryItemName: inventoryItem.name,
      quantity: 0,
      unit: normalized.unit,
    };

    setIngredients([...ingredients, newIngredient]);
    setShowAddIngredient(false);
  };

  const updateIngredientQuantity = (index: number, quantity: string) => {
    const updated = [...ingredients];
    const numValue = parseFloat(quantity) || 0;
    
    // For editing mode: prevent setting to 0 (user must delete via trash icon)
    // For create mode: allow 0
    if (item && numValue === 0) {
      return;
    }
    
    updated[index] = { ...updated[index], quantity: numValue };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const clearDishImage = () => {
    setDishImage(undefined);
    setDishImagePreview((current) => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current);
      }
      return undefined;
    });
  };

  // Filter available items based on dish type
  const availableItems = inventoryItems
    .filter(inv => {
      // First check if ingredient is already added
      if (ingredients.some(ing => ing.inventoryItemId === inv.id)) {
        return false;
      }
      
      // Filter based on dish type
      if (dishType === 'Rice Dishes') {
        // Hide noodles when Rice Dish is selected
        return inv.category !== 'Noodles';
      } else if (dishType === 'Noodle Dishes') {
        // Hide rice when Noodle Dish is selected
        return inv.category !== 'Rice';
      }
      
      // For other dish types, show all
      return true;
    })
    .sort((a, b) => {
      // Sort Brown Rice to the top
      if (a.name === 'Brown Rice') return -1;
      if (b.name === 'Brown Rice') return 1;
      return 0;
    });

  // Check if all ingredients have 0 quantity (for create mode)
  const displayedImage = dishImagePreview || dishImage;
  const allIngredientsZero = ingredients.length > 0 && ingredients.every(ing => ing.quantity === 0);
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex items-center justify-between z-10">
        <h1 className="text-2xl font-bold text-gray-900">
          {item ? `Edit Dish` : 'Add New Dish'}
        </h1>
        <button
          onClick={onCancel}
          className="text-gray-600 active:bg-gray-100 p-2 rounded-lg transition-colors"
        >
          <X size={28} strokeWidth={2.5} />
        </button>
      </div>

      <div className="p-4 pb-24">
        {/* Top Section: Basic Info */}
        <div className="mb-6">
          
          {/* Dish Image Upload */}
          <div className="mb-4">
            <label className="block text-gray-900 font-bold mb-2 text-lg">
              Dish Photo
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="dish-image-upload"
              />
              <label
                htmlFor="dish-image-upload"
                className="inline-block cursor-pointer"
              >
                {displayedImage ? (
                  <div className="relative w-24 h-24 rounded-lg border-2 border-gray-300 overflow-hidden group">
                    <img
                      src={displayedImage}
                      alt="Dish preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-full p-2 opacity-0 group-active:opacity-100 transition-opacity">
                        <Edit2 size={20} strokeWidth={2.5} className="text-gray-900" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-gray-300 bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors">
                    <Plus size={32} strokeWidth={2.5} className="text-gray-600" />
                  </div>
                )}
              </label>
            </div>
          </div>
          
          {/* Dish Name */}
          <div className="mb-4">
            <label className="block text-gray-900 font-bold mb-2 text-lg">
              Dish Name *
            </label>
            <input
              type="text"
              required
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="e.g., Chicken Rice"
              className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
            />
          </div>

          {/* Dish Type */}
          <div className="mb-4">
            <label className="block text-gray-900 font-bold mb-2 text-lg">Category *</label>
            <select
              value={dishType}
              onChange={(e) => setDishType(e.target.value)}
              className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
            >
              <option value="Rice Dishes">Rice Dish</option>
              <option value="Noodle Dishes">Noodle Dish</option>
              {/*<option value="Appetizer">Appetizer</option>*/}
              {/*<option value="Main Course">Main Course</option>*/}
              {/*<option value="Dessert">Dessert</option>*/}
              {/*<option value="Beverage">Beverage</option>*/}
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Selling Price */}
          <div>
            <label className="block text-gray-900 font-bold mb-2 text-lg">Selling Price *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-600">$</span>
              <input
                type="text"
                required
                value={price}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow only numbers and one decimal point
                  if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
                    setPrice(value);
                  }
                }}
                onBlur={(e) => {
                  // Format to 2 decimal places on blur
                  const value = e.target.value;
                  if (value && !isNaN(parseFloat(value))) {
                    setPrice(parseFloat(value).toFixed(2));
                  }
                }}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg font-bold text-2xl focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>
        </div>

        {/* Ingredients Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Ingredients per Portion</h2>
          
          {/* Gray container for ingredients and add button */}
          <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3">
            {/* Ingredients List */}
            <div className="space-y-2 mb-3">
              {ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="bg-white border-2 border-gray-300 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-bold text-gray-900">{ingredient.inventoryItemName}</p>
                    <button
                      onClick={() => {
                        if (item) {
                          setIngredientToDelete(index);
                        } else {
                          removeIngredient(index);
                        }
                      }}
                      className="text-red-600 p-1 active:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                  
                  {/* Quantity Input */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={ingredient.quantity || ''}
                        onChange={(e) => updateIngredientQuantity(index, e.target.value)}
                        placeholder="0"
                        className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-xl focus:outline-none focus:border-orange-600 text-center"
                      />
                    </div>
                    <div className="bg-orange-100 text-orange-600 px-3 py-3 rounded-lg font-bold min-w-[60px] text-center">
                      {ingredient.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Ingredient Button */}
            {showAddIngredient ? (
              <div className="bg-white border-2 border-orange-600 rounded-lg p-4">
                <p className="font-bold text-gray-900 mb-3">Select Ingredient:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableItems.map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => addIngredient(inv.id)}
                      className="w-full bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-left font-bold text-gray-900 active:bg-orange-50 active:border-orange-600 transition-colors"
                    >
                      {inv.name}   ({inv.category})
                    </button>
                  ))}
                  {availableItems.length === 0 && (
                    <p className="text-gray-600 font-bold text-center py-4">
                      All inventory items added
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddIngredient(false)}
                  className="w-full mt-3 bg-gray-600 text-white rounded-lg p-3 font-bold active:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddIngredient(true)}
                className="w-full bg-gray-900 text-white rounded-lg p-3 font-bold flex items-center justify-center gap-2 active:bg-gray-800 transition-colors"
              >
                <Plus size={24} strokeWidth={2.5} />
                Add Ingredient
              </button>
            )}
          </div>
        </div>

        {/* Delete Button - Above Save Button */}
        {item && onDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-red-600 text-white rounded-lg p-5 font-bold text-xl flex items-center justify-center gap-3 active:bg-red-700 transition-colors mb-3"
          >
            <Trash2 size={28} strokeWidth={2.5} />
            Delete Dish
          </button>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!dishName || !price || ingredients.length === 0 || allIngredientsZero}
          className="w-full bg-orange-600 text-white rounded-lg p-5 font-bold text-xl flex items-center justify-center gap-3 active:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Save size={28} strokeWidth={2.5} />
          Save Dish
        </button>

        {item && ingredientToDelete !== null && (
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove{' '}
                <span className="font-bold text-gray-900">
                  {ingredients[ingredientToDelete]?.inventoryItemName}
                </span>{' '}
                from this dish?
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setIngredientToDelete(null)}
                  className="bg-gray-600 text-white rounded-lg p-3 font-bold active:bg-gray-700 transition-colors mr-3"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (ingredientToDelete !== null) {
                      removeIngredient(ingredientToDelete);
                    }
                    setIngredientToDelete(null);
                  }}
                  className="bg-red-600 text-white rounded-lg p-3 font-bold active:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
              <p className="text-gray-600 mb-3">
                Are you sure you want to delete this dish from your menu.
              </p>
              <p className="text-gray-600 mb-6">
                If this dish has sales history, do you want to keep those sales records or delete them too?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (item && onDelete) {
                      await onDelete(item.id, 'keep');
                    }
                    setShowDeleteConfirm(false);
                  }}
                  className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold active:bg-orange-700 transition-colors"
                >
                  Delete Dish, Keep Sales History
                </button>

                <button
                  onClick={async () => {
                    if (item && onDelete) {
                      await onDelete(item.id, 'delete');
                    }
                    setShowDeleteConfirm(false);
                  }}
                  className="w-full bg-red-600 text-white rounded-lg p-3 font-bold active:bg-red-700 transition-colors"
                >
                  Delete Dish and Sales History
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full bg-gray-600 text-white rounded-lg p-3 font-bold active:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}