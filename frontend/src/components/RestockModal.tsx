import { useEffect, useMemo, useState } from 'react';
import { X, Phone, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { InventoryItem, Supplier, SupplierPrice } from '../types/inventory';
import { getSupplierPrices } from '../services/supplierPrices';
import { getSuppliers } from '../services/suppliers';

interface RestockModalProps {
  item: InventoryItem;
  onRestock: (itemId: string, quantity: number, supplier: string, estimatedCost: number) => void;
  onClose: () => void;
  restockMode: 'required' | 'optional';
}

export default function RestockModal({ item, onRestock, onClose, restockMode = 'required' }: RestockModalProps) {
  const isOptionalRestock = restockMode === 'optional';
  const isLowStock = item.quantity < item.minQuantity;

  // Optional good-stock restock: recommend the minimum quantity needed.
  // Required low-stock restock: recommend enough to reach 2x minimum quantity.
  const recommendedAmount = isOptionalRestock
    ? item.minQuantity
    : Math.max(0, (item.minQuantity * 2) - item.quantity);

  const [restockQuantity, setRestockQuantity] = useState<number | string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'min' | 'recommended' | '3x' | null>(null);
  const [supplierPriceOptions, setSupplierPriceOptions] = useState<SupplierPrice[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [prices, suppliers] = await Promise.all([
          getSupplierPrices(item.id),
          getSuppliers(),
        ]);

        setSupplierPriceOptions(prices);
        setSupplierOptions(suppliers);
      } catch (error) {
        console.error('Failed to load restock data:', error);
        setSupplierPriceOptions([]);
        setSupplierOptions([]);
      }
    };

    void loadData();
  }, [item.id]);

  const itemSupplierPrices = supplierPriceOptions;

  // Calculate average price
  const averagePrice = itemSupplierPrices.length > 0
    ? itemSupplierPrices.reduce((sum, sp) => sum + sp.price, 0) / itemSupplierPrices.length
    : item.targetPrice;

  // Sort suppliers by price (best price first)
  const sortedSuppliers = useMemo(
    () => [...itemSupplierPrices].sort((a, b) => a.price - b.price),
    [itemSupplierPrices],
  );

  useEffect(() => {
    if (selectedSupplier) {
      return;
    }

    if (sortedSuppliers.length > 0) {
      setSelectedSupplier(sortedSuppliers[0].supplierName);
      return;
    }

    if (item.supplier) {
      setSelectedSupplier(item.supplier);
    }
  }, [item.supplier, selectedSupplier, sortedSuppliers]);

  const handleInitialConfirm = () => {
    if (restockQuantity > 0) {
      setShowConfirmation(true);
    }
  };

  const handleFinalConfirm = () => {
    if (numericRestockQuantity > 0 && selectedSupplier) {
      onRestock(item.id, numericRestockQuantity, selectedSupplier, totalCost);
      onClose();
    }
  };

  const getSupplierPhone = (supplierName: string) => {
    const supplier = supplierOptions.find((s) => s.name === supplierName);
    return supplier?.phone || 'N/A';
  };

  const selectedSupplierPrice = sortedSuppliers.find(sp => sp.supplierName === selectedSupplier);
  const numericRestockQuantity = typeof restockQuantity === 'number' ? restockQuantity : (restockQuantity === '' ? 0 : parseFloat(restockQuantity));
  const totalCost = selectedSupplierPrice
    ? selectedSupplierPrice.price * numericRestockQuantity 
    : (sortedSuppliers.length > 0 ? sortedSuppliers[0].price * numericRestockQuantity : item.targetPrice * numericRestockQuantity);

  // Show confirmation summary
  if (showConfirmation) {
    const selectedSupplierDetails = supplierOptions.find((s) => s.name === selectedSupplier);
    const pricePerUnit = selectedSupplierPrice?.price || sortedSuppliers[0]?.price || item.targetPrice;
    
    return (
      <div className="absolute inset-0 bg-black/50 z-50 overflow-hidden">
        <div className="h-full px-4 pt-16 pb-4">
          <div className="mx-auto h-full max-w-md">
            <div className="bg-white rounded-lg h-full overflow-y-auto hide-scrollbar">
          {/* Header */}
          <div className="sticky top-0 bg-green-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={28} strokeWidth={2.5} />
              <h2 className="font-bold text-xl">Confirm Restock</h2>
            </div>
            <button
              onClick={() => setShowConfirmation(false)}
              className="text-white active:bg-green-700 p-1 rounded transition-colors"
            >
              <X size={28} strokeWidth={2.5} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/*
            <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4">
              <p className="text-blue-900 font-bold text-sm mb-2">Review Restock Details</p>
              <p className="text-gray-600 font-bold text-xs">
                Please confirm before placing order
              </p>
            </div>
            */}
            
            {/* Ingredient Info */}
            <div>
              <p className="text-gray-600 font-bold text-xs mb-1">INGREDIENT</p>
              <p className="text-gray-900 font-bold text-2xl">{item.name}</p>
              <p className="text-gray-600 font-bold text-sm">{item.category}</p>
            </div>

            {/* Restock Quantity */}
            <div className="bg-orange-50 border-2 border-orange-600 rounded-lg p-4">
              <p className="text-gray-600 font-bold text-xs mb-1">RESTOCK QUANTITY</p>
              <p className="text-orange-600 font-bold text-3xl">
                +{numericRestockQuantity.toFixed(1)} {item.unit}
              </p>
              <p className="text-gray-600 font-bold text-sm mt-1">
                Current: {item.quantity} {item.unit} → New: {(item.quantity + numericRestockQuantity).toFixed(1)} {item.unit}
              </p>
            </div>

            {/* Supplier Info */}
            <div>
              <p className="text-gray-600 font-bold text-xs mb-2">SUPPLIER</p>
              <div className="bg-white border-2 border-gray-300 rounded-lg p-3">
                <p className="font-bold text-gray-900 text-lg">{selectedSupplier}</p>
                <a
                  href={`tel:${selectedSupplierDetails?.phone}`}
                  className="text-orange-600 font-bold text-sm flex items-center gap-1 active:text-orange-700 mt-1"
                >
                  <Phone size={14} strokeWidth={2.5} />
                  {selectedSupplierDetails?.phone}
                </a>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <p className="text-gray-600 font-bold text-xs mb-2">COST BREAKDOWN</p>
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-600 font-bold text-sm">Unit Price</p>
                  <p className="text-gray-900 font-bold text-lg">
                    ${pricePerUnit.toFixed(2)}/{item.unit}
                  </p>
                </div>
                <div className="flex justify-between items-center mb-3 pb-3 border-b-2 border-gray-300">
                  <p className="text-gray-600 font-bold text-sm">Quantity</p>
                  <p className="text-gray-900 font-bold text-lg">
                    {numericRestockQuantity.toFixed(1)} {item.unit}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-900 font-bold text-base">TOTAL COST</p>
                  <p className="text-gray-900 font-bold text-3xl">
                    ${totalCost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleFinalConfirm}
                className="w-full bg-orange-600 text-white rounded-lg p-4 font-bold text-lg active:bg-orange-700 transition-colors"
              >
                Confirm Order
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                className="w-full bg-gray-200 text-gray-900 rounded-lg p-4 font-bold text-lg active:bg-gray-300 transition-colors"
              >
                Back to Edit
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    );
  }

  return (
  <div className="absolute inset-0 bg-black/50 z-50 overflow-hidden">
    <div className="h-full px-4 pt-16 pb-4">
      <div className="mx-auto h-full max-w-md">
        <div className="bg-white rounded-lg h-full overflow-y-auto hide-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-orange-600 text-white p-4 flex items-center justify-between">
          <h2 className="font-bold text-xl">Restock Ingredient</h2>
          <button
            onClick={onClose}
            className="text-white active:bg-orange-700 p-1 rounded transition-colors"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Item Info */}
          <div
            className={`border-2 rounded-lg p-4 ${
              isLowStock
                ? 'bg-red-50 border-red-600'
                : 'bg-green-50 border-green-600'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                <p className="text-gray-600 font-bold text-sm">{item.category}</p>
              </div>
              <div
                className={`px-3 py-1 rounded font-bold text-xs flex items-center gap-1 ${
                  isLowStock
                    ? 'bg-red-600 text-white'
                    : 'bg-green-600 text-white'
                }`}
              >
                <AlertTriangle size={14} strokeWidth={2.5} />
                {isOptionalRestock ? 'OPTIONAL' : isLowStock ? 'LOW' : 'GOOD'}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-gray-600 font-bold text-xs">Current Stock</p>
                <p
                  className={`font-bold text-2xl ${
                    isLowStock ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {item.quantity} {item.unit}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-bold text-xs">Minimum</p>
                <p className="text-gray-900 font-bold text-xl">{item.minQuantity} {item.unit}</p>
              </div>
            </div>
          </div>

          {/* Recommended Restock Amount */}
          <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4">
            <p className="text-blue-900 font-bold text-sm mb-2">Recommended Restock</p>
            <p className="text-blue-600 font-bold text-2xl mb-1">
              {recommendedAmount.toFixed(1)} {item.unit}
            </p>
            <p className="text-gray-600 font-bold text-xs">
              {isOptionalRestock
                ? `(Minimum quantity needed)`
                : `(Brings stock to ${(item.minQuantity * 2).toFixed(1)} ${item.unit})`}
            </p>
          </div>

          {/* Restock Quantity Input */}
          <div>
            <label className="block text-gray-900 font-bold mb-2">Restock Quantity</label>
            <input
              type="number"
              step="0.1"
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder={`e.g., ${recommendedAmount.toFixed(1)} ${item.unit}`}
              className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-2xl text-center focus:outline-none focus:border-orange-600"
            />
            {restockQuantity !== '' && (
              <p className="text-gray-900 font-bold text-base mt-2 text-center">
                New stock will be: {(item.quantity + (typeof restockQuantity === 'number' ? restockQuantity : 0)).toFixed(1)} {item.unit}
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                if (selectedPreset === 'min') {
                  // Unclick: reset to empty
                  setRestockQuantity('');
                  setSelectedPreset(null);
                } else {
                  // Click: set quantity
                  setRestockQuantity(item.minQuantity);
                  setSelectedPreset('min');
                }
              }}
              className={`${
                selectedPreset === 'min'
                  ? 'bg-orange-100 border-2 border-orange-600'
                  : 'bg-gray-100 border-2 border-gray-300'
              } rounded-lg p-2 font-bold text-xs active:bg-orange-200`}
            >
              <div>Min</div>
              <div className="text-sm">{item.minQuantity}</div>
            </button>
            <button
              onClick={() => {
                if (selectedPreset === 'recommended') {
                  // Unclick: reset to empty
                  setRestockQuantity('');
                  setSelectedPreset(null);
                } else {
                  // Click: set quantity
                  setRestockQuantity(recommendedAmount);
                  setSelectedPreset('recommended');
                }
              }}
              className={`${
                selectedPreset === 'recommended'
                  ? 'bg-orange-100 border-2 border-orange-600'
                  : 'bg-gray-100 border-2 border-gray-300'
              } rounded-lg p-2 font-bold text-xs active:bg-orange-200`}
            >
              <div>Recom.</div>
              <div className="text-sm">{recommendedAmount.toFixed(1)}</div>
            </button>
            <button
              onClick={() => {
                if (selectedPreset === '3x') {
                  // Unclick: reset to empty
                  setRestockQuantity('');
                  setSelectedPreset(null);
                } else {
                  // Click: set quantity
                  setRestockQuantity(item.minQuantity * 3);
                  setSelectedPreset('3x');
                }
              }}
              className={`${
                selectedPreset === '3x'
                  ? 'bg-orange-100 border-2 border-orange-600'
                  : 'bg-gray-100 border-2 border-gray-300'
              } rounded-lg p-2 font-bold text-xs active:bg-orange-200`}
            >
              <div>3x Min</div>
              <div className="text-sm">{(item.minQuantity * 3).toFixed(1)}</div>
            </button>
          </div>

          {/* Estimated Cost */}
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
            <p className="text-gray-600 font-bold text-sm mb-1">Estimated Total Cost</p>
            <p className="text-gray-900 font-bold text-3xl">
              ${totalCost.toFixed(2)}
            </p>
            <p className="text-gray-600 font-bold text-xs mt-1">
              {numericRestockQuantity.toFixed(1)} {item.unit} @ ${(selectedSupplierPrice?.price || sortedSuppliers[0]?.price || item.targetPrice).toFixed(2)}/{item.unit}
            </p>
          </div>

          {/* Supplier Information */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Select Supplier</h3>
            {sortedSuppliers.length > 0 ? (
              <div className="space-y-2">
                {sortedSuppliers.map((sp, index) => {
                  const isBest = index === 0;
                  const isSelected = selectedSupplier === sp.supplierName;
                  const phone = getSupplierPhone(sp.supplierName);
                  const priceVsAvg = ((sp.price - averagePrice) / averagePrice) * 100;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedSupplier(sp.supplierName)}
                      className={`w-full border-2 rounded-lg p-3 text-left transition-all ${
                        isSelected
                          ? 'bg-orange-100 border-orange-600 shadow-md'
                          : isBest 
                            ? 'bg-green-50 border-green-600' 
                            : 'bg-white border-gray-300'
                      } active:scale-[0.98]`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-orange-600 bg-orange-600' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                            <p className="font-bold text-gray-900">{sp.supplierName}</p>
                          </div>
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-orange-600 font-bold text-sm flex items-center gap-1 active:text-orange-700 ml-7 mt-1"
                          >
                            <Phone size={14} strokeWidth={2.5} />
                            {phone}
                          </a>
                        </div>
                        {isBest && (
                          <div className="bg-green-600 text-white px-2 py-1 rounded font-bold text-xs flex items-center gap-1">
                            <TrendingDown size={12} strokeWidth={2.5} />
                            BEST
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between ml-7">
                        <p className={`font-bold text-2xl ${
                          isSelected ? 'text-orange-600' : isBest ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          ${sp.price.toFixed(2)}
                          <span className="text-sm font-bold text-gray-600"> /{item.unit}</span>
                        </p>
                        {priceVsAvg !== 0 && (
                          <p className={`font-bold text-xs ${priceVsAvg < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {priceVsAvg > 0 ? '+' : ''}{priceVsAvg.toFixed(1)}% vs avg
                          </p>
                        )}
                      </div>
                      <p className="text-gray-600 font-bold text-xs mt-1 ml-7">
                        Updated: {sp.lastUpdated}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 text-center">
                <p className="text-gray-600 font-bold">No supplier prices available</p>
                <p className="text-gray-600 font-bold text-sm">Current supplier: {item.supplier}</p>
              </div>
            )}
          </div>

          {/* Restock Button */}
          <button
            onClick={handleInitialConfirm}
            disabled={restockQuantity <= 0}
            className={`w-full rounded-lg p-4 font-bold text-lg transition-colors ${
              restockQuantity > 0
                ? 'bg-orange-600 text-white active:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirm Restock
          </button>
        </div>
      </div>
    </div>
  </div>
  </div>
  );
}