import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import MenuManager from './components/MenuManager';
import PriceComparison from './components/PriceComparison';
import Settings from './components/Settings';
import Login from './components/Login';
import { Home, Package, ChefHat, DollarSign, SettingsIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'inventory' | 'menu' | 'prices' | 'settings'>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'restock'>('stock');
  const [menuSubTab, setMenuSubTab] = useState<'all' | 'work'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const navigateToWorkMode = () => {
    setActiveTab('menu');
    setMenuSubTab('work');
  };

  const navigateToRestock = () => {
    setActiveTab('inventory');
    setInventorySubTab('restock');
  };

  const navigateToPriceTracking = () => {
    setActiveTab('prices');
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard 
                 onNavigateToWorkMode={navigateToWorkMode} 
                 onNavigateToRestock={navigateToRestock} 
                 onNavigateToPriceTracking={navigateToPriceTracking} 
               />;
      case 'inventory':
        return <InventoryList initialSubTab={inventorySubTab} onFormStateChange={setIsFormOpen} />;
      case 'menu':
        return <MenuManager initialSubTab={menuSubTab} onFormStateChange={setIsFormOpen} />;
      case 'prices':
        return <PriceComparison onFormStateChange={setIsFormOpen} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard 
                 onNavigateToWorkMode={navigateToWorkMode} 
                 onNavigateToRestock={navigateToRestock} 
                 onNavigateToPriceTracking={navigateToPriceTracking} 
               />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-md mx-auto">
      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto ${isFormOpen ? '' : 'pb-20'}`}>
        {renderContent()}
      </main>

      {/* Bottom Navigation - Hidden when form is open */}
      {!isFormOpen && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t-2 border-gray-200">
          <div className="grid grid-cols-5 h-20">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'home' ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <Home size={24} strokeWidth={2.5} />
              <span className="text-xs font-bold">Home</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'inventory' ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <Package size={24} strokeWidth={2.5} />
              <span className="text-xs font-bold">Inventory</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('menu');
                setMenuSubTab('all'); // Reset to 'all' when clicking Menu in nav
              }}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'menu' ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <ChefHat size={24} strokeWidth={2.5} />
              <span className="text-xs font-bold">Menu</span>
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'prices' ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <DollarSign size={24} strokeWidth={2.5} />
              <span className="text-xs font-bold">Prices</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'settings' ? 'text-orange-500' : 'text-gray-600'
              }`}
            >
              <SettingsIcon size={24} strokeWidth={2.5} />
              <span className="text-xs font-bold">Settings</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}