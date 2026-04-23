import React, { useState, useEffect } from 'react';
import { useInventoryContext } from './contexts/InventoryContext';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Package, 
  PlusCircle, 
  Settings as SettingsIcon, 
  Menu, 
  X, 
  Users, 
  ShoppingCart, 
  FileText, 
  GraduationCap, 
  Megaphone,
  Truck,
  DollarSign,
  Briefcase,
  Shield,
  Scan
} from 'lucide-react';
import JanluDashboard from './components/JanluDashboard';
import JanluSidebar from './components/JanluSidebar';
import ProductForm from './components/ProductForm';
import RawMaterialForm from './components/RawMaterialForm';
import SaleForm from './components/SaleForm';
import QuoteForm from './components/QuoteForm';
import ThemeToggle from './components/ThemeToggle';
import Settings from './components/Settings';
import AcademyView from './components/AcademyView';
import { CourseManager } from './components/CourseManager';
import PublicCatalog from './components/PublicCatalog';
import CampaignBanner from './components/CampaignBanner';
import AdminCampaignPanel from './components/AdminCampaignPanel';
import SaleList from './components/SaleList';
import QuoteList from './components/QuoteList';
import CustomerList from './components/CustomerList';
import CouponView from './components/CouponView';
import InventoryView from './components/InventoryView';
import FinanceView from './components/FinanceView';
import StatsView from './components/StatsView';
import DispatchView from './components/DispatchView';
import AdminUsersView from './components/AdminUsersView';
import ProductionView from './components/ProductionView';
import ToolsView from './components/ToolsView';
import HelpView from './components/HelpView';
import AuditLogsView from './components/AuditLogsView';
import BarcodeScanner from './components/BarcodeScanner';
import ScannerView from './components/ScannerView';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

type View = 
  | 'dashboard' 
  | 'sales'
  | 'quotes'
  | 'customers'
  | 'inventory' 
  | 'finance' 
  | 'stats'
  | 'coupon'
  | 'dispatch' 
  | 'academy' 
  | 'courses'
  | 'settings' 
  | 'admin-campaigns'
  | 'admin-users'
  | 'audit-logs'
  | 'production'
  | 'tools'
  | 'help'
  | 'add-product' 
  | 'edit-product' 
  | 'edit-raw-material'
  | 'new-sale' 
  | 'new-quote'
  | 'scanner';

export default function App() {
  const { 
    products, addProduct, addMultipleProducts, updateProduct, deleteProduct, adjustStock,
    customers, addCustomer, updateCustomer, deleteCustomer,
    sales, registerSale, updateSale,
    quotes, addQuote, deleteQuote, approveQuote,
    rawMaterials, addRawMaterial, addMultipleRawMaterials, updateRawMaterial, deleteRawMaterial, restockRawMaterial,
    financialDocs, addFinancialDoc, deleteFinancialDoc,
    activities, addActivity, updateActivity, deleteActivity,
    campaigns, addCampaign, deleteCampaign,
    offers, addOffer, updateOffer, deleteOffer,
    courses, addCourse, updateCourse, deleteCourse,
    userProfile, purchaseStarterKit,
    metrics, currentUser, isAuthReady,
    users, updateUserRole, isAdmin, lastSync, refresh,
    productionOrders, addProductionOrder, updateProductionOrder, deleteProductionOrder, completeProductionOrder, fabricarProducto,
    simulations, saveSimulation, deleteSimulation, updateMultipleProducts, updateMultipleRawMaterials,
    preAuthorizedAdmins, addPreAuth, updatePreAuthRole, removePreAuth,
    auditLogs, clearAuditLogs, storeSettings, isSettingsLoaded, validateCoupon,
    coupons, generateCoupon, updateCoupon, deleteCoupon, addSubscriber
  } = useInventoryContext();
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingRawMaterialId, setEditingRawMaterialId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<'products' | 'raw-materials'>('products');
  const [isScanning, setIsScanning] = useState(false);
  const [saleStatusFilter, setSaleStatusFilter] = useState<string>('all');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [showAuth, setShowAuth] = useState(false);
  const [isPublicCatalog, setIsPublicCatalog] = useState(true);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const isAdminHash = hash && hash !== '' && hash !== '#catalog' && !hash.startsWith('#catalog?');
      
      if (isAdminHash && isAdmin) {
        setIsPublicCatalog(false);
      } else if (isAdminHash && !currentUser) {
        setShowAuth(true);
        setIsPublicCatalog(true);
      } else {
        setIsPublicCatalog(true);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    if (isAuthReady) handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [isAdmin, isAuthReady, currentUser]);

  const navigateToCatalog = () => {
    window.location.hash = 'catalog';
    setIsPublicCatalog(true);
  };

  const navigateToAdmin = () => {
    if (!isAdmin) return;
    window.location.hash = 'dashboard';
    setIsPublicCatalog(false);
  };

  // 🚀 LÓGICA DE NUMERACIÓN CORRELATIVA CORREGIDA (Y RETORNANDO DATOS AL CARRITO)
  const handleSmartRegisterSale = async (saleData: any) => {
    // 🚀 Validación Estricta de Cliente por Teléfono (Fusión de Perfiles)
    const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';
    const cleanIncomingPhone = normalizePhone(saleData.customerPhone || saleData.customer?.phone); 

    if (cleanIncomingPhone) {
      const existingCustomer = customers.find(c => normalizePhone(c.phone) === cleanIncomingPhone);

      if (existingCustomer) {
        saleData.customerId = existingCustomer.id;
        if (saleData.customerName && existingCustomer.name.toLowerCase() !== saleData.customerName.toLowerCase()) {
           updateCustomer({ ...existingCustomer, name: saleData.customerName });
        }
        saleData.customerName = existingCustomer.name;
      } else if (!saleData.customerId) {
        const newCustomerId = uuidv4();
        const newCustomer = {
           id: newCustomerId,
           name: saleData.customerName || 'Cliente Invitado',
           phone: cleanIncomingPhone,
           email: saleData.customerEmail || '',
           createdAt: new Date().toISOString()
        };
        addCustomer(newCustomer);
        saleData.customerId = newCustomerId;
      }
    }

    // Buscamos con lupa el número de pedido más alto que ya existe
    const currentSales = sales || [];
    const maxOrderNumber = currentSales.reduce((max, sale) => {
      const currentNum = Number(sale.orderNumber) || 0;
      return currentNum > max ? currentNum : max;
    }, 0);

    // Si no hay ventas o el máximo es 0, empezamos en 1000. Si no, máximo + 1.
    const nextOrderNumber = maxOrderNumber < 1000 ? 1000 : maxOrderNumber + 1;

    // Ejecutamos el registro oficial con el nuevo número Y DEVOLVEMOS EL RESULTADO
    const result = await registerSale({
      ...saleData,
      orderNumber: nextOrderNumber
    });
    
    return result; // 🚨 ESTO ES VITAL PARA QUE EL CARRITO RECIBA EL CUPÓN O SEPA QUE YA EXISTÍAS
  };

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4e9d3] dark:bg-stone-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      {showAuth && !currentUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f4e9d3] dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="flex flex-col items-center justify-center mb-8">
              <h1 className="text-4xl font-cinzel font-bold text-stone-900 dark:text-white leading-none tracking-normal">JANLU</h1>
              <p className="font-lato text-[10px] uppercase tracking-[0.4em] text-stone-500 dark:text-stone-400 mt-2">Aromas & Diseño</p>
            </div>
            {authMode === 'login' ? (
              <LoginForm onSwitchToRegister={() => setAuthMode('register')} />
            ) : (
              <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
            )}
          </div>
        </div>
      )}

      {currentUser && isAdmin && !isPublicCatalog ? (
        <div className="flex min-h-screen lg:h-screen bg-[#f4e9d3] dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-sans print:block print:h-auto print:bg-white">
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {isScanning && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
              <div className="w-full max-w-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white text-lg font-medium">Escanear Código</h3>
                  <button onClick={() => setIsScanning(false)} className="text-white/70 hover:text-white p-2">
                    <X size={24} />
                  </button>
                </div>
                <div className="bg-black rounded-xl overflow-hidden">
                  <BarcodeScanner hideCloseButton={true} onScan={(barcode) => {
                    setIsScanning(false);
                    const product = products.find(p => p.variants.some(v => v.barcode === barcode));
                    if (product) {
                      setInventoryTab('products');
                      setCurrentView('edit-product');
                      setEditingProductId(product.id);
                    } else {
                      const material = rawMaterials.find(m => m.barcode === barcode);
                      if (material) {
                        setInventoryTab('raw-materials');
                        setEditingRawMaterialId(material.id);
                        setCurrentView('edit-raw-material');
                      } else {
                        alert('Código no encontrado');
                      }
                    }
                  }} onClose={() => setIsScanning(false)} />
                </div>
              </div>
            </div>
          )}

          <aside className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-0 print:hidden`}>
            <JanluSidebar 
              currentView={currentView}
              onNavigate={(view) => {
                setCurrentView(view as View);
                setIsMobileMenuOpen(false);
              }}
              onNavigateToCatalog={navigateToCatalog}
              onClose={() => setIsMobileMenuOpen(false)}
              userProfile={userProfile}
              isAdmin={isAdmin}
              storeSettings={storeSettings}
            />
          </aside>

          <main className="flex-1 flex flex-col min-w-0 overflow-visible lg:overflow-hidden print:overflow-visible print:block">
            <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 print:hidden shrink-0">
              <button className="text-stone-500 dark:text-stone-400" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-stone-800 dark:text-stone-100 font-cinzel">JANLU</h1>
              <div className="w-6" />
            </header>

            <div className="flex-1 flex flex-col min-h-0 p-4 lg:p-8 print:overflow-visible print:p-0">
              <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
                <CampaignBanner campaigns={campaigns} />
                
                {currentView === 'dashboard' && (
                  <JanluDashboard 
                    metrics={metrics} 
                    products={products} 
                    rawMaterials={rawMaterials}
                    sales={sales} 
                    quotes={quotes} 
                    customers={customers}
                    activities={activities}
                    onAddActivity={addActivity}
                    onUpdateActivity={updateActivity}
                    onDeleteActivity={deleteActivity}
                    onAdjustStock={adjustStock}
                    onRestockRawMaterial={restockRawMaterial}
                    userProfile={userProfile}
                    onNavigateToCatalog={navigateToCatalog}
                    lastSync={lastSync}
                    onRefresh={refresh}
                    onGenerateCoupon={generateCoupon}
                    onNavigate={(view) => {
                      if (view === 'quotes') {
                        setSaleStatusFilter('presupuesto');
                        setCurrentView('sales');
                      } else {
                        setCurrentView(view as View);
                      }
                    }} 
                  />
                )}

                {currentView === 'inventory' && (
                  <InventoryView 
                    initialTab={inventoryTab}
                    products={products}
                    rawMaterials={rawMaterials}
                    productionOrders={productionOrders}
                    sales={sales}
                    onAddProduct={() => setCurrentView('add-product')}
                    onAddMultipleProducts={addMultipleProducts}
                    onEditProduct={(id) => {
                      setEditingProductId(id);
                      setCurrentView('edit-product');
                    }}
                    onUpdateProduct={updateProduct}
                    onDeleteProduct={deleteProduct}
                    onAdjustStock={adjustStock}
                    onProduce={fabricarProducto}
                    onAddRawMaterial={addRawMaterial}
                    onAddMultipleRawMaterials={addMultipleRawMaterials}
                    onUpdateRawMaterial={updateRawMaterial}
                    onDeleteRawMaterial={deleteRawMaterial}
                    onRestockRawMaterial={restockRawMaterial}
                    onNavigateToCatalog={navigateToCatalog}
                  />
                )}

                {currentView === 'sales' && <SaleList sales={sales} products={products} customers={customers} storeSettings={storeSettings} onNewSale={() => setCurrentView('new-sale')} onUpdateSale={updateSale} onAttachReceipt={(id, url) => updateSale({...sales.find(s=>s.id===id)!, receiptUrl: url})} initialStatusFilter={saleStatusFilter} />}
                {currentView === 'quotes' && <QuoteList quotes={quotes} products={products} customers={customers} onNewQuote={() => setCurrentView('new-quote')} onDelete={deleteQuote} onApprove={approveQuote} />}
                {currentView === 'customers' && <CustomerList customers={customers} sales={sales} offers={offers} onAdd={addCustomer} onUpdate={updateCustomer} onDelete={deleteCustomer} />}
                {currentView === 'coupon' && (
                  <CouponView 
                    offers={offers} 
                    coupons={coupons}
                    products={products} 
                    onAddOffer={addOffer} 
                    onUpdateOffer={updateOffer} 
                    onDeleteOffer={deleteOffer}
                    onUpdateCoupon={updateCoupon}
                    onDeleteCoupon={deleteCoupon}
                  />
                )}
                {currentView === 'finance' && <FinanceView financialDocs={financialDocs} sales={sales} onAddDoc={addFinancialDoc} onDeleteDoc={deleteFinancialDoc} />}
                {currentView === 'stats' && <StatsView sales={sales} quotes={quotes} financialDocs={financialDocs} products={products} />}
                {currentView === 'dispatch' && <DispatchView sales={sales} customers={customers} />}
                {currentView === 'new-sale' && <SaleForm products={products} rawMaterials={rawMaterials} customers={customers} offers={offers} campaigns={campaigns} storeSettings={storeSettings} courses={courses} onSave={(s)=>{handleSmartRegisterSale(s); setCurrentView('sales');}} onCancel={()=>setCurrentView('sales')} onValidateCoupon={validateCoupon} />}
                {currentView === 'new-quote' && <QuoteForm products={products} customers={customers} offers={offers} campaigns={campaigns} storeSettings={storeSettings} onSave={(q)=>{addQuote(q); setCurrentView('quotes');}} onCancel={()=>setCurrentView('quotes')} />}
                {(currentView === 'add-product' || currentView === 'edit-product') && <ProductForm product={currentView === 'edit-product' ? products.find(p=>p.id===editingProductId) : undefined} rawMaterials={rawMaterials} onSave={async(p)=>{if(currentView==='edit-product') await updateProduct(p); else await addProduct(p); setCurrentView('inventory');}} onCancel={()=>setCurrentView('inventory')} />}
                {currentView === 'edit-raw-material' && editingRawMaterialId && <RawMaterialForm initialData={rawMaterials.find(m=>m.id===editingRawMaterialId)} products={products} onSave={(m)=>{updateRawMaterial(m); setCurrentView('inventory');}} onCancel={()=>setCurrentView('inventory')} />}
                {currentView === 'production' && <ProductionView products={products} productionOrders={productionOrders} rawMaterials={rawMaterials} onAddOrder={addProductionOrder} onUpdateOrder={updateProductionOrder} onCompleteOrder={completeProductionOrder} onDeleteOrder={deleteProductionOrder} />}
                {currentView === 'tools' && <ToolsView products={products} rawMaterials={rawMaterials} simulations={simulations} onSaveSimulation={saveSimulation} onDeleteSimulation={deleteSimulation} onUpdateProducts={updateMultipleProducts} onUpdateRawMaterials={updateMultipleRawMaterials} onAddActivity={addActivity} onAddMultipleProducts={addMultipleProducts} onAddMultipleRawMaterials={addMultipleRawMaterials} />}
                {currentView === 'scanner' && (
                  <ScannerView 
                    products={products} 
                    rawMaterials={rawMaterials} 
                    onProductFound={(id) => {
                      setInventoryTab('products');
                      setCurrentView('edit-product');
                      setEditingProductId(id);
                    }}
                    onRawMaterialFound={(id) => {
                      setInventoryTab('raw-materials');
                      setEditingRawMaterialId(id);
                      setCurrentView('edit-raw-material');
                    }}
                  />
                )}
                {currentView === 'help' && <HelpView />}
                {currentView === 'settings' && <Settings />}
                {currentView === 'academy' && <AcademyView profile={userProfile} onPurchaseKit={()=>{purchaseStarterKit(); alert('Kit comprado');}} />}
                {currentView === 'courses' && (
                  <CourseManager 
                    courses={courses}
                    sales={sales}
                    customers={customers}
                    onAddCourse={addCourse}
                    onUpdateCourse={updateCourse}
                    onDeleteCourse={deleteCourse}
                  />
                )}
                {currentView === 'admin-campaigns' && <AdminCampaignPanel campaigns={campaigns} onAdd={addCampaign} onDelete={deleteCampaign} />}
                {currentView === 'admin-users' && userProfile?.role === 'admin' && <AdminUsersView users={users} preAuthorizedAdmins={preAuthorizedAdmins} currentUser={currentUser} onUpdateRole={updateUserRole} onAddPreAuth={addPreAuth} onUpdatePreAuthRole={updatePreAuthRole} onRemovePreAuth={removePreAuth} />}
                {currentView === 'audit-logs' && userProfile?.role === 'admin' && <AuditLogsView logs={auditLogs} clearLogs={clearAuditLogs} />}
              </div>
            </div>

            <button
              onClick={() => setIsScanning(true)}
              className="fixed bottom-4 right-4 lg:bottom-8 lg:right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-40 print:hidden"
            >
              <Scan size={24} />
            </button>
          </main>
        </div>
      ) : (
        <PublicCatalog 
          products={products} 
          courses={courses}
          rawMaterials={rawMaterials}
          sales={sales}
          offers={offers}
          campaigns={campaigns}
          onAddProduct={isAdmin ? addProduct : undefined}
          onUpdateProduct={isAdmin ? updateProduct : undefined}
          onDeleteProduct={isAdmin ? deleteProduct : undefined}
          onRegisterSale={handleSmartRegisterSale} // 🎯 AHORA SÍ: Usamos la función inteligente
          onBackToAdmin={currentUser && isAdmin ? navigateToAdmin : (currentUser ? () => auth.signOut() : undefined)}
          isCustomer={!isAdmin}
          lastSync={lastSync}
          onRefresh={refresh}
          storeSettings={storeSettings}
          isSettingsLoaded={isSettingsLoaded}
          onValidateCoupon={validateCoupon}
          onLogin={() => setShowAuth(true)}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onAddSubscriber={addSubscriber}
        />
      )}
    </>
  );
}
