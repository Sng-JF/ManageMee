import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import * as api from '../api';
import { InventoryItem, Supplier } from '../types/inventory';
import { categories, getUnitsForCategory } from '../data/constants';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { parseIngredientTranscript } from '../utils/voiceParsers';
import microphoneImg from '../assets/microphone.png';

interface AddEditItemProps {
  item?: InventoryItem | null;
  onSave: (item: any) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

export default function AddEditItem({ item, onSave, onDelete, onCancel }: AddEditItemProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || 'kg',
    minQuantity: item?.minQuantity?.toString() || '',
    supplier: item?.supplier || '',
    targetPrice: item?.targetPrice?.toString() || ''
  });
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const { voiceState, transcript, voiceError, toggle, resultCount } = useVoiceInput();

  useEffect(() => {
    api.fetchSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  // Populate form fields when voice transcript is ready.
  // Depends on resultCount (incremented per transcription) so re-recording
  // the same phrase still re-applies the parsed values.
  useEffect(() => {
    if (voiceState === 'done' && transcript) {
      const parsed = parseIngredientTranscript(
        transcript,
        suppliers.map((s) => s.name),
        categories
      );
      setFormData((prev) => ({
        ...prev,
        ...(parsed.name      && { name: parsed.name }),
        ...(parsed.category  && { category: parsed.category }),
        ...(parsed.quantity  && { quantity: parsed.quantity }),
        ...(parsed.unit      && { unit: parsed.unit }),
        ...(parsed.minQuantity && { minQuantity: parsed.minQuantity }),
        ...(parsed.supplier  && { supplier: parsed.supplier }),
        ...(parsed.targetPrice && { targetPrice: parsed.targetPrice }),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultCount, suppliers]);

  const availableUnits = getUnitsForCategory(formData.category);

  // Update unit when category changes if current unit is not available
  useEffect(() => {
    if (formData.category && !availableUnits.includes(formData.unit)) {
      setFormData(prev => ({ ...prev, unit: availableUnits[0] || 'kg' }));
    }
  }, [formData.category, formData.unit, availableUnits]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      ...item,
      name: formData.name,
      category: formData.category,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      minQuantity: parseFloat(formData.minQuantity),
      supplier: formData.supplier,
      targetPrice: parseFloat(formData.targetPrice) || 0,
      lastUpdated: new Date().toISOString()
    };

    onSave(itemData);
  };

  const handleAddSupplier = () => {
    if (newSupplierName.trim()) {
      setFormData(prev => ({ ...prev, supplier: newSupplierName.trim() }));
      setNewSupplierName('');
      setShowNewSupplierInput(false);
    }
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {item ? 'Edit Ingredient' : 'New Ingredient'}
        </h1>
        <button
          onClick={onCancel}
          className="text-gray-600 p-2 active:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={32} strokeWidth={2.5} />
        </button>
      </div>

      {/* Voice input button */}
      <button
        type="button"
        onClick={toggle}
        disabled={voiceState === 'processing'}
        className={`flex items-center gap-2 mb-1 px-3 py-2 border-2 rounded-lg transition-colors ${
          voiceState === 'recording'
            ? 'border-red-500 bg-red-50 animate-pulse'
            : voiceState === 'processing'
            ? 'border-orange-300 bg-orange-50 opacity-70'
            : voiceState === 'done'
            ? 'border-green-500 bg-green-50'
            : voiceState === 'error'
            ? 'border-red-300 bg-red-50'
            : 'border-gray-200 bg-gray-50'
        }`}
      >
        <img src={microphoneImg} alt="Voice input" className="w-5 h-5" />
        <span className={`text-sm font-bold ${
          voiceState === 'recording' ? 'text-red-600'
          : voiceState === 'processing' ? 'text-orange-600'
          : voiceState === 'done' ? 'text-green-600'
          : voiceState === 'error' ? 'text-red-500'
          : 'text-gray-600'
        }`}>
          {voiceState === 'recording'
            ? 'Stop Recording'
            : voiceState === 'processing'
            ? 'Processing…'
            : voiceState === 'done'
            ? 'Fields Filled ✓'
            : voiceState === 'error'
            ? 'Try Again'
            : 'Voice Input'}
        </span>
      </button>
      {voiceState === 'idle' && (
        <p className="text-xs text-gray-400 mb-3">
          Say: “[name], [category], [qty] [unit], minimum [qty], supplier [name], price [amount]”
        </p>
      )}
      {voiceState === 'done' && transcript && (
        <p className="text-xs text-gray-500 mb-3 italic">“{transcript}”</p>
      )}
      {voiceState === 'error' && voiceError && (
        <p className="text-xs text-red-500 mb-3">{voiceError}</p>
      )}
      {(voiceState === 'recording' || voiceState === 'processing') && (
        <p className="text-xs text-gray-400 mb-3">
          {voiceState === 'recording' ? 'Tap again when done speaking…' : 'Sending to Google Speech-to-Text…'}
        </p>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Item Name */}
        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Item Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Yellow Noodles"
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Category *
          </label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-900 font-bold mb-1 text-base">
              Quantity *
            </label>
            <input
              type="number"
              required
              step="0.1"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="0.0"
              className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
            />
          </div>
          <div>
            <label className="block text-gray-900 font-bold mb-1 text-base">
              Unit *
            </label>
            <select
              required
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
            >
              {availableUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Minimum Quantity */}
        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Minimum Quantity *
          </label>
          <input
            type="number"
            required
            step="0.1"
            min="0"
            value={formData.minQuantity}
            onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
            placeholder="0.0"
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
          />
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Supplier *
          </label>
          <select
              required
              value={formData.supplier || ''}
              onChange={(e) => {
                if (e.target.value === 'ADD_NEW') {
                  setFormData({ ...formData, supplier: '' });
                  setNewSupplierName('');
                  setShowNewSupplierInput(true);
                } else {
                  setFormData({ ...formData, supplier: e.target.value });
                  setShowNewSupplierInput(false);
                }
              }}
              className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
            >
              <option value="">Select supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
              ))}
              <option value="ADD_NEW">+ Add New Supplier...</option>
            </select>
          {showNewSupplierInput && (
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              onBlur={handleAddSupplier}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSupplier();
                }
              }}
              placeholder="New supplier name"
              autoFocus
              className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600 mt-2"
            />
          )}
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Target Price (per {formData.unit})
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-600">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.targetPrice}
              onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
              placeholder="0.00"
              className="w-full pr-4 py-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
              style={{paddingLeft: "30px"}}
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold text-lg flex items-center justify-center gap-3 active:bg-orange-700 transition-colors mt-4 mb-2"
        >
          <Save size={22} strokeWidth={2.5} />
          Save Ingredient
        </button>

        {/* Delete Button (edit mode only) */}
        {item && onDelete && (
          <>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-white border-2 border-red-600 text-red-600 rounded-lg p-3 font-bold text-lg flex items-center justify-center gap-3 active:bg-red-50 transition-colors mb-4"
              >
                <Trash2 size={22} strokeWidth={2.5} />
                Delete Ingredient
              </button>
            ) : (
              <div className="border-2 border-red-600 rounded-lg p-3 mb-4">
                <p className="text-red-700 font-bold text-center mb-3">Delete this ingredient?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="flex-1 bg-red-600 text-white rounded-lg p-2 font-bold active:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-100 text-gray-700 rounded-lg p-2 font-bold active:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}