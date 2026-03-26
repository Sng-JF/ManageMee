import { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Edit2 } from 'lucide-react';
import { InventoryItem, Supplier } from '../types/inventory';
import { createSupplier, getSuppliers } from '../services/suppliers';
import { categories, getUnitsForCategory } from '../data/constants';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { parseIngredientTranscript } from '../utils/voiceParsers';
import microphoneImg from '../assets/microphone.png';

interface AddEditItemProps {
  item?: InventoryItem | null;
  onSave: (item: Omit<InventoryItem, 'id' | 'lastUpdated'> | InventoryItem) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  isDeleteDisabled?: boolean;
}

export default function AddEditItem({ item, onSave, onCancel, onDelete, isDeleteDisabled = false }: AddEditItemProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || 'kg',
    minQuantity: item?.minQuantity?.toString() || '',
    supplier: item?.supplier || '',
    targetPrice: item?.targetPrice?.toString() || ''
  });
  const [itemImage, setItemImage] = useState<string | undefined>((item as any)?.image);
  const [itemImagePreview, setItemImagePreview] = useState<string | undefined>((item as any)?.image);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { voiceState, transcript, voiceError, toggle, resultCount } = useVoiceInput();

  // Populate form fields when voice transcript is ready.
  useEffect(() => {
    if (voiceState === 'done' && transcript) {
      const parsed = parseIngredientTranscript(
        transcript,
        supplierOptions.map((s) => s.name),
        categories
      );
      setFormData((prev) => ({
        ...prev,
        ...(parsed.name        && { name: parsed.name }),
        ...(parsed.category    && { category: parsed.category }),
        ...(parsed.quantity    && { quantity: parsed.quantity }),
        ...(parsed.unit        && { unit: parsed.unit }),
        ...(parsed.minQuantity && { minQuantity: parsed.minQuantity }),
        ...(parsed.supplier    && { supplier: parsed.supplier }),
        ...(parsed.targetPrice && { targetPrice: parsed.targetPrice }),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultCount, supplierOptions]);

  const availableUnits = getUnitsForCategory(formData.category);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const backendSuppliers = await getSuppliers();
        setSupplierOptions(backendSuppliers);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      }
    };

    void loadSuppliers();
  }, []);

  // Update unit when category changes if current unit is not available
  useEffect(() => {
    if (formData.category && !availableUnits.includes(formData.unit)) {
      setFormData(prev => ({ ...prev, unit: availableUnits[0] || 'kg' }));
    }
  }, [formData.category, formData.unit, availableUnits]);

  useEffect(() => {
    return () => {
      if (itemImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(itemImagePreview);
      }
    };
  }, [itemImagePreview]);

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

    const previousImage = itemImage;
    const previousPreview = itemImagePreview;

    const reader = new FileReader();
    reader.onloadend = () => {
      setItemImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const compressedImage = await resizeImageToDataUrl(file);
      setItemImage(compressedImage);
    } catch (error) {
      console.error('Failed to process image:', error);
      setItemImage(previousImage);
      setItemImagePreview(previousPreview);
      alert('Failed to process image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let supplierName = formData.supplier;

    if (showNewSupplierInput) {
      const trimmedName = newSupplierName.trim();

      if (!trimmedName) {
        alert('Please enter a supplier name.');
        return;
      }

      const existingSupplier = supplierOptions.find(
        (supplier) => supplier.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingSupplier) {
        supplierName = existingSupplier.name;
      } else {
        try {
          const createdSupplier = await createSupplier({
            name: trimmedName,
            phone: '-',
            items: [],
          });

          setSupplierOptions((prev) => [...prev, createdSupplier]);
          supplierName = createdSupplier.name;
        } catch (error) {
          console.error('Failed to create supplier:', error);
          alert('Failed to create supplier.');
          return;
        }
      }
    }

    const itemData = {
      ...item,
      name: formData.name,
      category: formData.category,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      minQuantity: parseFloat(formData.minQuantity),
      supplier: supplierName,
      targetPrice: parseFloat(formData.targetPrice) || 0,
      image: itemImage ?? null,
      lastUpdated: new Date().toISOString()
    };

    await onSave(itemData as InventoryItem);
  };

  const displayedImage = itemImagePreview || itemImage;

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

      {/* Item Image Upload */}
      <div className="mb-6 flex justify-center">
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="item-image-upload"
          />
          <label
            htmlFor="item-image-upload"
            className="inline-block cursor-pointer"
          >
            {displayedImage ? (
              <div className="relative w-32 h-32 rounded-xl border-2 border-gray-300 overflow-hidden group shadow-sm">
                <img
                  src={displayedImage}
                  alt="Ingredient preview"
                  className="w-full h-full object-cover rounded-xl"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="bg-white rounded-full p-2 opacity-0 group-active:opacity-100 transition-opacity shadow-sm">
                    <Edit2 size={24} strokeWidth={2.5} className="text-gray-900" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center active:bg-gray-100 transition-colors shadow-sm">
                <Plus size={36} strokeWidth={2.5} className="text-gray-400 mb-2" />
                <span className="text-xs font-bold text-gray-500">Add Photo</span>
              </div>
            )}
          </label>
        </div>
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
      <form onSubmit={handleSubmit} className="space-y-4 pb-24">
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
            required={!showNewSupplierInput}
            value={showNewSupplierInput ? 'ADD_NEW' : formData.supplier || ''}
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
            className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
          >
            <option value="">Select supplier</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.name}>
                {supplier.name}
              </option>
            ))}
            <option value="ADD_NEW">+ Add New Supplier...</option>
          </select>

          {showNewSupplierInput && (
            <input
              type="text"
              required
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
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

        {/* Delete Button */}
        {item && onDelete && (
          <button
            type="button"
            disabled={isDeleteDisabled}
            onClick={() => {
              if (!isDeleteDisabled) {
                setShowDeleteConfirm(true);
              }
            }}
            className="w-full bg-red-600 text-white rounded-lg p-5 font-bold text-xl flex items-center justify-center gap-3 active:bg-red-700 transition-colors mt-6 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Trash2 size={28} strokeWidth={2.5} />
            Delete Ingredient
          </button>
        )}

        {item && isDeleteDisabled && (
          <p className="text-sm text-gray-600 mt-2">
            This ingredient cannot be deleted because it is used in a dish.
          </p>
        )}

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

      {item && onDelete && !isDeleteDisabled && showDeleteConfirm && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this ingredient?
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-gray-600 text-white rounded-lg p-3 font-bold active:bg-gray-700 transition-colors mr-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDelete(item.id);
                    setShowDeleteConfirm(false);
                  } catch (error) {
                    console.error('Failed to delete ingredient:', error);
                  }
                }}
                className="bg-red-600 text-white rounded-lg p-3 font-bold active:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}