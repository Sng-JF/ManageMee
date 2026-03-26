import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import MenuManager from './components/MenuManager';
import Settings from './components/Settings';
import Login from './components/Login';
import IPhoneFrame from './components/IPhoneFrame';
import { Home, Package, ChefHat, SettingsIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'inventory' | 'menu' | 'settings'>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'restock'>('stock');
  const [menuSubTab, setMenuSubTab] = useState<'all' | 'work'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);

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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <IPhoneFrame>
        <Login onLogin={handleLogin} />
      </IPhoneFrame>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard
                 onNavigateToWorkMode={navigateToWorkMode}
                 onNavigateToRestock={navigateToRestock}
                 salesRefreshKey={salesRefreshKey}
               />;
      case 'inventory':
        return <InventoryList initialSubTab={inventorySubTab} onFormStateChange={setIsFormOpen} />;
      case 'menu':
        return <MenuManager
                 initialSubTab={menuSubTab}
                 onFormStateChange={setIsFormOpen}
                 onSaleRecorded={() => setSalesRefreshKey((prev) => prev + 1)}
                 onExitToHome={() => {
                   setActiveTab('home');
                   setMenuSubTab('all');
                   setIsFormOpen(false);
                 }}
               />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard 
                 onNavigateToWorkMode={navigateToWorkMode} 
                 onNavigateToRestock={navigateToRestock} 
               />;
    }
  };

  return (
    <IPhoneFrame>
      <div className="h-full bg-white flex flex-col">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto min-h-0">
          {renderContent()}
        </main>

        {/* Bottom Navigation - Hidden when form is open */}
        {!isFormOpen && (
          <nav className="bg-white border-t-2 border-gray-200 flex-shrink-0">
            <div className="grid grid-cols-4 h-20">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  activeTab === 'home' ? 'text-orange-600' : 'text-gray-600'
                }`}
              >
                <Home size={24} strokeWidth={2.5} />
                <span className="text-xs font-bold">Home</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('inventory');
                  setInventorySubTab('stock');
                }}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  activeTab === 'inventory' ? 'text-orange-600' : 'text-gray-600'
                }`}
              >
                <Package size={24} strokeWidth={2.5} />
                <span className="text-xs font-bold">Inventory</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('menu');
                  setMenuSubTab('all');
                }}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  activeTab === 'menu' ? 'text-orange-600' : 'text-gray-600'
                }`}
              >
                <ChefHat size={24} strokeWidth={2.5} />
                <span className="text-xs font-bold">Menu</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  activeTab === 'settings' ? 'text-orange-600' : 'text-gray-600'
                }`}
              >
                <SettingsIcon size={24} strokeWidth={2.5} />
                <span className="text-xs font-bold">Settings</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </IPhoneFrame>
  );
}