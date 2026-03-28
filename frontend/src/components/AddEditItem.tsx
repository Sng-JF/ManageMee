import { useEffect, useMemo, useState } from 'react';
import { X, Save, Trash2, Plus, Edit2 } from 'lucide-react';
import { InventoryItem, Supplier } from '../types/inventory';
import { createSupplier, getSuppliers } from '../services/suppliers';
import { getSupplierPrices } from '../services/supplierPrices';
import { getStoredIngredientCategories, setStoredStallCategoryList } from '../services/auth';
import { apiRequest } from '../services/api';
import { getUnitsForCategory } from '../data/constants';
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
  const isEditing = Boolean(item);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() =>
    Array.from(
      new Set([
        ...getStoredIngredientCategories(),
        ...(item?.category ? [item.category] : []),
      ]),
    ),
  );

  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || categoryOptions[0] || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || 'kg',
    minQuantity: item?.minQuantity?.toString() || '',
    supplier: item?.supplier || '',
    targetPrice: item?.targetPrice?.toString() || '',
    supplierPrice: '',
  });
  const [itemImage, setItemImage] = useState<string | undefined>((item as any)?.image);
  const [itemImagePreview, setItemImagePreview] = useState<string | undefined>((item as any)?.image);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isLoadingSupplierPrice, setIsLoadingSupplierPrice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { voiceState, transcript, voiceError, toggle, resultCount } = useVoiceInput();

  const selectedSupplier = useMemo(
    () => supplierOptions.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, supplierOptions],
  );

  useEffect(() => {
    if (formData.category && !categoryOptions.some((category) => category.toLowerCase() === formData.category.toLowerCase())) {
      setCategoryOptions((prev) => [...prev, formData.category]);
    }
  }, [formData.category, categoryOptions]);

  useEffect(() => {
    if (voiceState === 'done' && transcript) {
      const parsed = parseIngredientTranscript(
        transcript,
        supplierOptions.map((s) => s.name),
        categoryOptions,
      );
      setFormData((prev) => ({
        ...prev,
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.category && { category: parsed.category }),
        ...(!isEditing && parsed.quantity && { quantity: parsed.quantity }),
        ...(!isEditing && parsed.unit && { unit: parsed.unit }),
        ...(parsed.minQuantity && { minQuantity: parsed.minQuantity }),
        ...(parsed.supplier && { supplier: parsed.supplier }),
        ...(parsed.targetPrice && { targetPrice: parsed.targetPrice }),
      }));
    }
  }, [categoryOptions, isEditing, resultCount, supplierOptions, transcript, voiceState]);

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

  useEffect(() => {
    if (showNewSupplierInput) {
      setSelectedSupplierId('');
      return;
    }

    if (!formData.supplier || supplierOptions.length === 0) {
      return;
    }

    const matchedSupplier = supplierOptions.find(
      (supplier) => supplier.name.trim().toLowerCase() === formData.supplier.trim().toLowerCase(),
    );

    if (matchedSupplier) {
      setSelectedSupplierId(matchedSupplier.id);
    }
  }, [formData.supplier, showNewSupplierInput, supplierOptions]);

  useEffect(() => {
    if (!item?.id || showNewSupplierInput || !selectedSupplierId) {
      return;
    }

    let cancelled = false;

    const loadSupplierPrice = async () => {
      try {
        setIsLoadingSupplierPrice(true);
        const prices = await getSupplierPrices(item.id);
        const matchedPrice = prices.find((price) => price.supplierId === selectedSupplierId);

        if (!cancelled) {
          setFormData((prev) => ({
            ...prev,
            supplierPrice: matchedPrice ? matchedPrice.price.toString() : '',
          }));
        }
      } catch (error) {
        console.error('Failed to load supplier price:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingSupplierPrice(false);
        }
      }
    };

    void loadSupplierPrice();

    return () => {
      cancelled = true;
    };
  }, [item?.id, selectedSupplierId, showNewSupplierInput]);

  useEffect(() => {
    if (formData.category && !availableUnits.includes(formData.unit)) {
      setFormData((prev) => ({ ...prev, unit: availableUnits[0] || 'kg' }));
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

  const persistNewIngredientCategory = async () => {
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      alert('Please enter a category name.');
      return null;
    }

    const existingCategory = categoryOptions.find(
      (category) => category.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (existingCategory) {
      const nextCategories = Array.from(new Set([...categoryOptions, existingCategory]));
      setCategoryOptions(nextCategories);
      setStoredStallCategoryList('ingredientCategories', nextCategories);
      setFormData((prev) => ({ ...prev, category: existingCategory }));
      setShowNewCategoryInput(false);
      setNewCategoryName('');
      return existingCategory;
    }

    try {
      const updated = await apiRequest<{ ingredientCategories?: string[] }>(`/api/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          ingredientCategories: [...categoryOptions, trimmedName],
        }),
      });

      const nextCategories = setStoredStallCategoryList(
        'ingredientCategories',
        updated.ingredientCategories ?? [...categoryOptions, trimmedName],
      );

      setCategoryOptions(nextCategories);
      setFormData((prev) => ({ ...prev, category: trimmedName }));
      setShowNewCategoryInput(false);
      setNewCategoryName('');
      return trimmedName;
    } catch (error) {
      console.error('Failed to create ingredient category:', error);
      alert(error instanceof Error ? error.message : 'Failed to create category.');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let categoryName = formData.category;

    if (showNewCategoryInput) {
      const createdCategory = await persistNewIngredientCategory();
      if (!createdCategory) {
        return;
      }
      categoryName = createdCategory;
    }

    let supplierName = formData.supplier;
    let supplierId = selectedSupplierId;
    let supplierContact: string | undefined = selectedSupplier?.phone;

    if (showNewSupplierInput) {
      const trimmedName = newSupplierName.trim();
      const trimmedContact = newSupplierContact.trim();

      if (!trimmedName) {
        alert('Please enter a supplier name.');
        return;
      }

      if (!trimmedContact) {
        alert('Please enter supplier contact details.');
        return;
      }

      const existingSupplier = supplierOptions.find(
        (supplier) => supplier.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (existingSupplier) {
        supplierName = existingSupplier.name;
        supplierId = existingSupplier.id;
        supplierContact = existingSupplier.phone;
      } else {
        try {
          const createdSupplier = await createSupplier({
            name: trimmedName,
            phone: trimmedContact,
            items: [],
          });

          setSupplierOptions((prev) =>
            [...prev, createdSupplier].sort((a, b) => a.name.localeCompare(b.name)),
          );
          supplierName = createdSupplier.name;
          supplierId = createdSupplier.id;
          supplierContact = createdSupplier.phone;
        } catch (error) {
          console.error('Failed to create supplier:', error);
          alert(error instanceof Error ? error.message : 'Failed to create supplier.');
          return;
        }
      }
    }

    if (!supplierName || !supplierId) {
      alert('Please select a supplier.');
      return;
    }

    const normalizedSupplierPrice = Number.parseFloat(formData.supplierPrice);

    if (!Number.isFinite(normalizedSupplierPrice) || normalizedSupplierPrice < 0) {
      alert('Please enter a valid supplier price.');
      return;
    }

    const itemData = {
      ...item,
      name: formData.name,
      category: categoryName,
      quantity: isEditing ? item.quantity : parseFloat(formData.quantity),
      unit: isEditing ? item.unit : formData.unit,
      minQuantity: parseFloat(formData.minQuantity),
      supplier: supplierName,
      targetPrice: parseFloat(formData.targetPrice) || 0,
      supplierId,
      supplierContact,
      supplierPrice: normalizedSupplierPrice,
      image: itemImage ?? null,
      lastUpdated: new Date().toISOString(),
    };

    await onSave(itemData as InventoryItem);
  };

  const displayedImage = itemImagePreview || itemImage;

  if (item && onDelete && !isDeleteDisabled && showDeleteConfirm) {
    return (
      <div className="h-full bg-black px-4 py-6 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h2>

          <p className="mb-6 text-base text-gray-700">
            Are you sure you want to delete this ingredient?
          </p>

          <div className="flex gap-3">
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
    );
  }

  const supplierSelectValue = showNewSupplierInput
    ? 'ADD_NEW'
    : selectedSupplierId || (formData.supplier ? '__CURRENT_SUPPLIER__' : '');

  return (
    <div className="relative h-full p-3">
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

      <form onSubmit={handleSubmit} className="space-y-4 pb-24">
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

        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Category *
          </label>
          <select
            required={!showNewCategoryInput}
            value={showNewCategoryInput ? 'ADD_NEW_CATEGORY' : formData.category}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW_CATEGORY') {
                setFormData({ ...formData, category: '' });
                setNewCategoryName('');
                setShowNewCategoryInput(true);
              } else {
                setFormData({ ...formData, category: e.target.value });
                setShowNewCategoryInput(false);
              }
            }}
            className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
          >
            <option value="">Select category</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="ADD_NEW_CATEGORY">+ Add New Category...</option>
          </select>

          {showNewCategoryInput && (
            <input
              type="text"
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New ingredient category"
              autoFocus
              className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600 mt-2"
            />
          )}
        </div>

        {!isEditing && (
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
                {availableUnits.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>
        )}

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

        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Supplier *
          </label>

          <select
            required={!showNewSupplierInput}
            value={supplierSelectValue}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                setFormData((prev) => ({ ...prev, supplier: '' }));
                setNewSupplierName('');
                setNewSupplierContact('');
                setSelectedSupplierId('');
                setShowNewSupplierInput(true);
                return;
              }

              if (e.target.value === '__CURRENT_SUPPLIER__') {
                return;
              }

              const matchedSupplier = supplierOptions.find((supplier) => supplier.id === e.target.value);
              setFormData((prev) => ({
                ...prev,
                supplier: matchedSupplier?.name ?? '',
              }));
              setSelectedSupplierId(matchedSupplier?.id ?? '');
              setShowNewSupplierInput(false);
            }}
            className="w-full p-4 border-2 border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:border-orange-600"
          >
            <option value="">Select supplier</option>
            {!selectedSupplierId && formData.supplier && !showNewSupplierInput && (
              <option value="__CURRENT_SUPPLIER__">{formData.supplier}</option>
            )}
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
            <option value="ADD_NEW">+ Add New Supplier...</option>
          </select>

          {showNewSupplierInput ? (
            <div className="mt-3 rounded-2xl border-2 border-orange-600 p-4">
              <p className="mb-3 text-lg font-bold text-gray-900">Add New Supplier:</p>
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="New supplier name"
                  autoFocus
                  className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
                />
                <input
                  type="text"
                  required
                  value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)}
                  placeholder="Supplier contact number"
                  className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          ) : selectedSupplier?.phone ? (
            <p className="mt-2 text-sm font-bold text-gray-600">
              Contact: {selectedSupplier.phone}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-gray-900 font-bold mb-1 text-base">
            Supplier Price (per {formData.unit}) *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-600">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.supplierPrice}
              onChange={(e) => setFormData({ ...formData, supplierPrice: e.target.value })}
              placeholder="0.00"
              className="w-full pr-4 py-3 border-2 border-gray-300 rounded-lg font-bold text-base focus:outline-none focus:border-orange-600"
              style={{ paddingLeft: '30px' }}
            />
          </div>
          {isLoadingSupplierPrice && item && (
            <p className="text-xs text-gray-500 mt-2">Loading saved supplier price...</p>
          )}
        </div>

        {/* Target price kept in state/payload but hidden from the UI for now */}

        <button
          type="submit"
          className="w-full bg-orange-600 text-white rounded-lg p-3 font-bold text-lg flex items-center justify-center gap-3 active:bg-orange-700 transition-colors mt-4 mb-2"
        >
          <Save size={22} strokeWidth={2.5} />
          Save Ingredient
        </button>

        {item && onDelete && (
          <button
            type="button"
            disabled={isDeleteDisabled}
            onClick={() => {
              if (!isDeleteDisabled) {
                setShowDeleteConfirm(true);
              }
            }}
            className={`w-full border-2 rounded-lg p-3 font-bold text-lg flex items-center justify-center gap-3 transition-colors mb-4 ${
              isDeleteDisabled
                ? 'bg-gray-400 border-gray-400 text-white cursor-not-allowed'
                : 'bg-white border-red-600 text-red-600 active:bg-red-50'
            }`}
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
      </form>
    </div>
  );
}
