import { useEffect, useState } from 'react';
import { CheckCircle, X, TrendingDown, Plus, Minus, ShoppingBag } from 'lucide-react';
import { MenuItem } from '../types/menu';
import { InventoryItem } from '../types/inventory';
import { motion, AnimatePresence } from 'motion/react';

interface QuickSaleProps {
  menuItem: MenuItem;
  onClose: () => void;
  onConfirm: (updates: { id: string; newQuantity: number }[]) => void;
}

interface IngredientAdjustment {
  inventoryItemId: string;
  inventoryItemName: string;
  baseQuantity: number;
  adjustedQuantity: number;
  unit: string;
}

export default function QuickSale({ menuItem, onClose, onConfirm }: QuickSaleProps) {
  const [animationStage, setAnimationStage] = useState<'input' | 'deducting' | 'complete'>('input');
  const [quantity, setQuantity] = useState(1);
  const [showIngredientAdjustments, setShowIngredientAdjustments] = useState(false);
  const [ingredientAdjustments, setIngredientAdjustments] = useState<IngredientAdjustment[]>(
    menuItem.ingredients.map(ing => ({
      inventoryItemId: ing.inventoryItemId,
      inventoryItemName: ing.inventoryItemName,
      baseQuantity: ing.quantity,
      adjustedQuantity: ing.quantity,
      unit: ing.unit
    }))
  );
  const [inventoryUpdates, setInventoryUpdates] = useState<Array<{
    id: string;
    name: string;
    deduction: number;
    unit: string;
    previousStock: number;
    newStock: number;
  }>>([]);

  const adjustIngredient = (index: number, change: number) => {
    setIngredientAdjustments(prev => {
      const newAdj = [...prev];
      // Allow going to 0 (exclude ingredient)
      newAdj[index].adjustedQuantity = Math.max(0, newAdj[index].adjustedQuantity + change);
      return newAdj;
    });
  };

  const setIngredientQuantity = (index: number, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    
    setIngredientAdjustments(prev => {
      const newAdj = [...prev];
      newAdj[index].adjustedQuantity = numValue;
      return newAdj;
    });
  };

  const resetIngredient = (index: number) => {
    setIngredientAdjustments(prev => {
      const newAdj = [...prev];
      newAdj[index].adjustedQuantity = newAdj[index].baseQuantity;
      return newAdj;
    });
  };

  const handleConfirmSale = async () => {
    setAnimationStage('deducting');

  try {
    // 1. Send the sale to the backend
    const response = await fetch('http://localhost:5432/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        quantity: quantity
      })
    });

    const data = await response.json();
    
    // Optional: If your backend returns the updated inventory levels in the response,
    // you can pass them down to setInventoryUpdates to keep your animations accurate!
    
  } catch (error) {
    console.error('Failed to process sale:', error);
    // Handle error UI here
  }
  };

  // 1️⃣ Handle transition to complete
  useEffect(() => {
    if (animationStage === 'deducting') {
      const timer = setTimeout(() => {
        setAnimationStage('complete');
      }, 1500);
  
      return () => clearTimeout(timer);
    }
  }, [animationStage]);
  
  // 2️⃣ Handle closing AFTER complete
  useEffect(() => {
    if (animationStage === 'complete') {
      const closeTimer = setTimeout(() => {
        const inventoryChanges = inventoryUpdates.map(u => ({
          id: u.id,
          newQuantity: u.newStock
        }));
  
        onConfirm(inventoryChanges);
        onClose();
      }, 5000);
  
      return () => clearTimeout(closeTimer);
    }
  }, [animationStage, inventoryUpdates, onConfirm, onClose]);

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));
  const totalPrice = (menuItem.price * quantity).toFixed(2);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={animationStage === 'input' ? onClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className={`text-white p-5 flex items-center justify-between ${
            animationStage === 'input' ? 'bg-gray-900' : 'bg-orange-600'
          }`}>
            <div className="flex items-center gap-3">
              {animationStage === 'input' ? (
                <ShoppingBag size={32} strokeWidth={2.5} />
              ) : (
                <CheckCircle size={32} strokeWidth={2.5} />
              )}
              <div>
                <p className="font-bold text-sm opacity-90">
                  {animationStage === 'input' ? 'QUICK SALE' : 'SOLD'}
                </p>
                <p className="font-bold text-xl">
                  {animationStage === 'input' ? menuItem.name : `${quantity}x ${menuItem.name}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`text-white p-2 rounded-lg transition-colors ${
                animationStage === 'input' ? 'active:bg-gray-800' : 'active:bg-orange-700'
              }`}
            >
              <X size={28} strokeWidth={2.5} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Quantity Input */}
            {animationStage === 'input' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="font-bold text-gray-900 text-lg mb-4 text-center">Select Quantity</p>
                
                {/* Quantity Selector */}
                <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      onClick={decrementQuantity}
                      className="bg-red-600 text-white w-16 h-16 rounded-xl flex items-center justify-center active:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      disabled={quantity <= 1}
                    >
                      <Minus size={32} strokeWidth={3} />
                    </button>
                    
                    <div className="text-center min-w-[120px]">
                      <p className="text-6xl font-bold text-orange-600">{quantity}</p>
                      <p className="text-gray-600 font-bold mt-1">portions</p>
                    </div>
                    
                    <button
                      onClick={incrementQuantity}
                      className="bg-green-600 text-white w-16 h-16 rounded-xl flex items-center justify-center active:bg-green-700 transition-colors"
                    >
                      <Plus size={32} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Quick Quantity Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 5, 10].map(num => (
                      <button
                        key={num}
                        onClick={() => setQuantity(num)}
                        className={`py-3 px-2 rounded-lg font-bold text-lg transition-colors ${
                          quantity === num
                            ? 'bg-orange-600 text-white'
                            : 'bg-white border-2 border-gray-300 text-gray-900 active:bg-gray-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Display */}
                <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 font-bold text-sm">Total Price</p>
                      <p className="text-green-600 font-bold text-4xl">${totalPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600 font-bold text-sm">${menuItem.price.toFixed(2)} each</p>
                      <p className="text-gray-900 font-bold text-xl">× {quantity}</p>
                    </div>
                  </div>
                </div>

                {/* Ingredient Adjustments Toggle */}
                <button
                  onClick={() => setShowIngredientAdjustments(!showIngredientAdjustments)}
                  className="w-full bg-blue-50 border-2 border-blue-600 text-blue-900 rounded-lg p-4 font-bold mb-4 flex items-center justify-center gap-2 active:bg-blue-100 transition-colors"
                >
                  {showIngredientAdjustments ? <Minus size={24} strokeWidth={2.5} /> : <Plus size={24} strokeWidth={2.5} />}
                  {showIngredientAdjustments ? 'Hide' : 'Customize'} Ingredients
                </button>

                {/* Ingredient Adjustments */}
                {showIngredientAdjustments && (
                  <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-6 space-y-3 max-h-80 overflow-y-auto">
                    <p className="font-bold text-gray-900 text-sm mb-2">Adjust Ingredients (per portion)</p>
                    {ingredientAdjustments.map((ingredient, index) => {
                      const isModified = ingredient.adjustedQuantity !== ingredient.baseQuantity;
                      const isExcluded = ingredient.adjustedQuantity === 0;
                      
                      return (
                        <div
                          key={ingredient.inventoryItemId}
                          className={`border-2 rounded-lg p-3 ${
                            isExcluded
                              ? 'bg-red-50 border-red-600'
                              : isModified
                              ? 'bg-orange-50 border-orange-600'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className={`font-bold text-sm flex-1 ${
                              isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'
                            }`}>
                              {ingredient.inventoryItemName}
                            </p>
                            {isModified && (
                              <button
                                onClick={() => resetIngredient(index)}
                                className="text-xs font-bold text-orange-600 active:text-orange-700 px-2 py-1 bg-white rounded border border-orange-600"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustIngredient(index, -0.1)}
                              className="bg-red-600 text-white w-10 h-10 rounded-lg flex items-center justify-center active:bg-red-700 transition-colors disabled:bg-gray-300"
                              disabled={ingredient.adjustedQuantity <= 0}
                            >
                              <Minus size={20} strokeWidth={3} />
                            </button>
                            
                            <div className="flex-1 text-center">
                              <input
                                type="text"
                                value={ingredient.adjustedQuantity.toFixed(2)}
                                onChange={(e) => setIngredientQuantity(index, e.target.value)}
                                className={`text-2xl font-bold w-16 text-center ${
                                  isExcluded
                                    ? 'text-red-600'
                                    : isModified
                                    ? 'text-orange-600'
                                    : 'text-gray-900'
                                }`}
                              />
                              <p className="text-xs font-bold text-gray-600">
                                {ingredient.unit} {isModified && `(was ${ingredient.baseQuantity.toFixed(2)})`}
                              </p>
                            </div>
                            
                            <button
                              onClick={() => adjustIngredient(index, 0.1)}
                              className="bg-green-600 text-white w-10 h-10 rounded-lg flex items-center justify-center active:bg-green-700 transition-colors"
                            >
                              <Plus size={20} strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {/*<div className="bg-blue-50 border border-blue-600 rounded-lg p-2 mt-2">
                      <p className="text-blue-900 font-bold text-xs text-center">
                        💡 Tip: Set to 0 to exclude an ingredient (e.g., "no vegetables")
                      </p>
                    </div>*/}
                  </div>
                )}

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmSale}
                  className="w-full bg-orange-600 text-white rounded-xl p-5 font-bold text-xl flex items-center justify-center gap-3 active:bg-orange-700 transition-colors"
                >
                  <CheckCircle size={28} strokeWidth={2.5} />
                  Confirm Sale
                </button>
              </motion.div>
            )}

            {/* Deductions */}
            {/* Deduction Animation */}
            {animationStage === 'deducting' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="font-bold text-gray-900 text-lg mb-4">Deducting Inventory...</p>
                <div className="space-y-3">
                  {inventoryUpdates.map((update, index) => (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 flex items-center gap-3"
                    >
                      <TrendingDown size={24} className="text-red-600" strokeWidth={2.5} />
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{update.name}</p>
                        <p className="text-red-600 font-bold text-xl">
                          -{update.deduction.toFixed(1)} {update.unit}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Completion */}

            {animationStage === 'complete' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle size={64} className="text-green-600 mx-auto mb-3" strokeWidth={2.5} />
                  </motion.div>
                  <p className="font-bold text-gray-900 text-xl mb-2">Sale Complete!</p>
                  <p className="font-bold text-gray-600">Inventory Updated</p>
                </div>

                {/* Updated Stock Levels */}
                <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4">
                  <p className="font-bold text-gray-900 mb-3">Remaining Stock:</p>
                  <div className="space-y-2">
                    {inventoryUpdates.map((update) => (
                      <div
                        key={update.id}
                        className="flex items-center justify-between"
                      >
                        <p className="font-bold text-gray-900 text-sm">{update.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-400 line-through text-sm">
                            {update.previousStock+500-10} {update.unit}
                          </p>
                          <p className="font-bold text-green-600 text-lg">
                            {update.newStock+490} {update.unit}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-center text-gray-500 font-bold text-sm mt-4">
                  Closing automatically...
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}