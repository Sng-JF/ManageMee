import React, { useState, useEffect } from 'react';
import { Bell, Globe, DollarSign, User, HelpCircle, LogOut, X, Save } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

interface SettingsData {
  stallName: string;
  ownerName: string;
  location: string;
  lowStockAlerts: boolean;
  currency: string;
  language: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [formData, setFormData] = useState<SettingsData | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch settings on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(data => {
        setSettings(data);
        setFormData(data);
      })
      .catch(err => {
        console.error("Failed to fetch settings", err);
        // Optionally add an error state here (e.g., setError(true))
      })
      .finally(() => {
        // This ensures the loading state stops whether the request succeeds or fails
        setIsLoading(false); 
      });
  }, []);

  const handleSave = async () => {
    if (!formData) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setActiveModal(null);
      }
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  };

  if (isLoading || !settings || !formData) {
    return <div className="p-4 text-center font-bold text-gray-500 mt-10">Loading settings...</div>;
  }

  const settingsOptions = [
    {
      id: 'profile',
      icon: User,
      title: 'Profile',
      description: 'Edit stall name and owner details',
      currentValue: settings.ownerName
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Notifications',
      description: 'Configure low stock alerts',
      currentValue: settings.lowStockAlerts ? 'Enabled' : 'Disabled'
    },
    {
      id: 'currency',
      icon: DollarSign,
      title: 'Currency',
      description: 'Choose display currency',
      currentValue: settings.currency
    },
    {
      id: 'language',
      icon: Globe,
      title: 'Language',
      description: 'Change app language',
      currentValue: settings.language
    },
    {
      id: 'help',
      icon: HelpCircle,
      title: 'Help & Support',
      description: 'Get help with the app',
      currentValue: ''
    }
  ];

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto relative">
      {/* Header */}
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

      {/* Settings Options */}
      <div className="space-y-3 mb-6">
        {settingsOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => option.id === 'help' ? alert('Help center coming soon!') : setActiveModal(option.id)}
              className="w-full bg-white border-2 border-gray-300 rounded-lg p-4 text-left active:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Icon size={22} className="text-orange-600" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{option.title}</h3>
                  <p className="text-gray-500 font-bold text-sm">{option.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {option.currentValue && (
                  <span className="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded">
                    {option.currentValue}
                  </span>
                )}
                <div className="text-gray-400 text-2xl">→</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Logout Button */}
      <button
        onClick={() => alert('Logging out...')}
        className="w-full bg-red-50 border-2 border-red-200 text-red-600 rounded-lg p-4 font-bold text-lg flex items-center justify-center gap-3 active:bg-red-100 transition-colors"
      >
        <LogOut size={24} strokeWidth={2.5} />
        Logout
      </button>

      {/* App Info */}
      <div className="mt-8 text-center">
        <p className="text-gray-400 font-bold text-sm">Hawker Inventory Manager</p>
        <p className="text-gray-400 font-bold text-xs">Version 1.0.0</p>
      </div>

      {/* Dynamic Modal Overlay */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold capitalize">Edit {activeModal}</h2>
              <button onClick={() => { setActiveModal(null); setFormData(settings); }} className="p-2 bg-gray-100 rounded-full text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto">
              {activeModal === 'profile' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Stall Name</label>
                    <input 
                      type="text" 
                      value={formData.stallName} 
                      onChange={e => setFormData({...formData, stallName: e.target.value})}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Owner Name</label>
                    <input 
                      type="text" 
                      value={formData.ownerName} 
                      onChange={e => setFormData({...formData, ownerName: e.target.value})}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Location</label>
                    <input 
                      type="text" 
                      value={formData.location} 
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold"
                    />
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
                      onChange={e => setFormData({...formData, lowStockAlerts: e.target.checked})}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              )}

              {activeModal === 'currency' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Select Currency</label>
                  <select 
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold bg-white"
                  >
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="MYR">MYR (Malaysian Ringgit)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>
              )}

              {activeModal === 'language' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Select Language</label>
                  <select 
                    value={formData.language}
                    onChange={e => setFormData({...formData, language: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-lg p-3 font-bold bg-white"
                  >
                    <option value="English">English</option>
                    <option value="Mandarin">中文 (Mandarin)</option>
                    <option value="Malay">Bahasa Melayu</option>
                    <option value="Tamil">தமிழ் (Tamil)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button 
                onClick={() => { setActiveModal(null); setFormData(settings); }}
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