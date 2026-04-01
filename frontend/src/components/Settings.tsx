import React, { useState, useEffect } from 'react';
import {  Bell, Globe, User, HelpCircle, LogOut, X, Save, Store, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../services/api';
import { getStoredAuthSession, saveAuthSession } from '../services/auth';

interface SettingsData {
  stallName: string;
  ownerName: string;
  location: string;
  stallCategories: string[];
  ingredientCategories: string[];
  lowStockAlerts: boolean;
  currency: string;
  language: string;
}

interface SettingsProps {
  onLogout: () => void;
  onFormStateChange?: (isOpen: boolean) => void;
}

type SettingsModal = 'userProfile' | 'stallDetails' | 'preferences' | 'notifications' | null;

export default function Settings({ onLogout, onFormStateChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [activeModal, setActiveModal] = useState<SettingsModal>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    onFormStateChange?.(activeModal !== null);

    return () => {
      onFormStateChange?.(false);
    };
  }, [activeModal, onFormStateChange]);

  const syncStoredSession = (data: SettingsData) => {
    const session = getStoredAuthSession();
    if (!session?.stall) return;

    saveAuthSession({
      ...session,
      user: {
        ...session.user,
        name: data.ownerName,
      },
      stall: {
        ...session.stall,
        stallName: data.stallName,
        location: data.location,
        stallCategories: data.stallCategories,
        ingredientCategories: data.ingredientCategories,
      },
      settings: {
        lowStockAlerts: data.lowStockAlerts,
        currency: data.currency,
        language: data.language,
      },
    });
  };

  useEffect(() => {
    apiRequest<SettingsData>('/api/settings')
      .then((data) => {
        setSettings(data);
        setFormData(data);
        syncStoredSession(data);
        setError('');
      })
      .catch((err) => {
        console.error('Failed to fetch settings', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const closeModal = () => {
    setActiveModal(null);
    if (settings) {
      setFormData(settings);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    try {
      const updated = await apiRequest<SettingsData>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      setSettings(updated);
      setFormData(updated);
      syncStoredSession(updated);
      setActiveModal(null);
      setError('');
    } catch (saveError) {
      console.error('Failed to save settings', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.');
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center font-bold text-gray-500 mt-10">Loading settings...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center mt-10">
        <p className="font-bold text-red-600">{error}</p>
      </div>
    );
  }

  if (!settings || !formData) {
    return (
      <div className="p-4 text-center font-bold text-gray-500 mt-10">
        Settings unavailable.
      </div>
    );
  }

  const settingsOptions = [
    {
      id: 'userProfile' as const,
      icon: User,
      title: 'User Profile',
      description: 'Manage owner details',
      currentValue: '',     //settings.ownerName,
    },
    {
      id: 'stallDetails' as const,
      icon: Store,
      title: 'Stall Details',
      description: 'Edit stall name and location',
      currentValue: '',     //settings.stallName,
    },
    {
      id: 'preferences' as const,
      icon: SlidersHorizontal,
      title: 'Preferences',
      description: 'Language and currency',
      currentValue: '',     //`${settings.language} · ${settings.currency}`,
    },
    {
      id: 'notifications' as const,
      icon: Bell,
      title: 'Notifications',
      description: 'Configure low stock alerts',
      currentValue: '',     //settings.lowStockAlerts ? 'Enabled' : 'Disabled',
    },
    {
      id: 'help' as const,
      icon: HelpCircle,
      title: 'Help & Support',
      description: 'Get help with the app',
      currentValue: '',
    },
  ];

  const renderModalTitle = () => {
    switch (activeModal) {
      case 'userProfile':
        return 'User Profile';
      case 'stallDetails':
        return 'Stall Details';
      case 'preferences':
        return 'Preferences';
      case 'notifications':
        return 'Notifications';
      default:
        return 'Settings';
    }
  };

  return (
    <div className="h-full relative bg-white overflow-hidden">
      <div className="h-full overflow-y-auto hide-scrollbar p-4 pb-24 max-w-2xl mx-auto">
        <div className="mb-3">
          <div className="bg-orange-600 rounded-lg p-3 mb-2">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
          </div>
          <div className="bg-orange-50 border-2 border-orange-600 rounded-lg p-4">
            <p className="font-bold text-gray-900 text-xl">{settings.stallName}</p>
            <p className="text-gray-600 font-bold">{settings.location}</p>
            <p className="text-gray-500 text-sm mt-1">Managed by: {settings.ownerName}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {settingsOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() =>
                  option.id === 'help' ? alert('Help center coming soon!') : setActiveModal(option.id)
                }
                className="w-full bg-white border-2 border-gray-300 rounded-lg p-4 text-left active:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-orange-100 p-2 rounded-lg shrink-0">
                    <Icon size={22} className="text-orange-600" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg">{option.title}</h3>
                    <p className="text-gray-500 font-bold text-sm">{option.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {option.currentValue && (
                    <span className="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded text-sm text-right">
                      {option.currentValue}
                    </span>
                  )}
                  <div className="text-gray-400 text-2xl">→</div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onLogout}
          className="w-full bg-red-50 border-2 border-red-200 text-red-600 rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-3 active:bg-red-100 transition-colors"
        >
          <LogOut size={24} strokeWidth={2.5} />
          Logout
        </button>

        <div className="mt-8 text-center">
          <p className="text-gray-400 font-bold text-sm">Hawker Inventory Manager</p>
          <p className="text-gray-400 font-bold text-xs">Version 2.1.1</p>
        </div>
      </div>

      {activeModal && (
        <div className="absolute inset-0 z-50 bg-black/25">
          <div className="h-full w-full bg-white flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-white shrink-0">
              <h2 className="text-xl font-bold">{renderModalTitle()}</h2>
              <button
                onClick={closeModal}
                className="p-2 bg-gray-100 rounded-full text-gray-600 active:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto hide-scrollbar">
              {activeModal === 'userProfile' && (
                <>
                  {/* <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="font-bold text-gray-900">Account owner details</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Update the name shown across the stall account.
                    </p>
                  </div> */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Owner Name</label>
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
                  </div>
                </>
              )}

              {activeModal === 'stallDetails' && (
                <>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Stall Name</label>
                    <input
                      type="text"
                      value={formData.stallName}
                      onChange={(e) => setFormData({ ...formData, stallName: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
                  </div>

                  <p className="font-bold text-gray-900 mb-2">Dish Categories</p>
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {formData.stallCategories.length > 0 ? (
                        formData.stallCategories.map((category) => (
                          <span
                            key={category}
                            className="w-full min-h-[56px] rounded-full bg-orange-50 border border-orange-200 px-3 py-2 text-base font-bold text-orange-700 text-center break-words flex items-center justify-center"
                          >
                            {category}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No dish categories configured yet.</p>
                      )}
                    </div>
                  </div>

                  <p className="font-bold text-gray-900 mb-2">Ingredient Categories</p>
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {formData.ingredientCategories.length > 0 ? (
                        formData.ingredientCategories.map((category) => (
                          <span
                            key={category}
                            className="w-full min-h-[56px] rounded-full bg-orange-50 border border-orange-200 px-3 py-2 text-base font-bold text-orange-700 text-center break-words flex items-center justify-center"                          >
                            {category}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No ingredient categories configured yet.</p>
                      )}
                    </div>
                    {/* <p className="text-xs text-gray-500 mt-3">
                      New categories can be added when creating or editing a dish or ingredient.
                    </p> */}
                  </div>
                </>
              )}

              {activeModal === 'preferences' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Language</label>
                    <div className="relative">
                      <Globe
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                      />

                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full appearance-none border-2 border-gray-300 rounded-lg py-3 pl-12 pr-10 font-bold bg-white text-gray-900"
                      >
                        <option value="English">English</option>
                        <option value="Mandarin">中文 (Mandarin)</option>
                        <option value="Malay">Bahasa Melayu</option>
                        <option value="Tamil">தமிழ் (Tamil)</option>
                      </select>

                      {/* <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                      /> */}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold bg-white"
                    >
                      <option value="SGD">SGD (Singapore Dollar)</option>
                      <option value="MYR">MYR (Malaysian Ringgit)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                </>
              )}

              {activeModal === 'notifications' && (
                <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                  <div>
                    <p className="font-bold text-gray-900">Low Stock Alerts</p>
                    <p className="text-sm text-gray-500">Get notified when ingredients run low</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.lowStockAlerts}
                      onChange={(e) => setFormData({ ...formData, lowStockAlerts: e.target.checked })}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3 shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 py-3 font-bold text-gray-600 bg-white border-2 border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 font-bold text-white bg-orange-600 rounded-lg flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
