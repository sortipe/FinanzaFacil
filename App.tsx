import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AccountantDashboard } from './pages/AccountantDashboard';
import { Payment } from './pages/Payment';
import { UserRole, SubscriptionStatus } from './types';

const MainApp: React.FC = () => {
  const { currentUser, updateUser, logout } = useStore();

  useEffect(() => {
    if (currentUser?.role === UserRole.USER && currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && currentUser.subscriptionEndDate) {
      const today = new Date().toISOString().split('T')[0];
      if (currentUser.subscriptionEndDate < today) {
        updateUser(currentUser.id, { subscriptionStatus: SubscriptionStatus.EXPIRED });
      }
    }
  }, [currentUser?.id, currentUser?.subscriptionEndDate, currentUser?.subscriptionStatus]);

  if (!currentUser || currentUser.mustChangePassword) {
    return <Auth />;
  }

  // Role Based Routing
  const renderDashboard = () => {
    switch (currentUser.role) {
      case UserRole.ADMIN:
        return <AdminDashboard />;
      case UserRole.ACCOUNTANT:
        return <AccountantDashboard />;
      case UserRole.USER:
        if (currentUser.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
          return <Payment />;
        }
        return <UserDashboard />;
      default:
        return <div>Rol desconocido</div>;
    }
  };

  // If user is pending payment, they shouldn't see the sidebar layout for the dashboard
  if (currentUser.role === UserRole.USER && currentUser.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
    return (
        <>
            <div className="fixed top-0 right-0 p-6 z-50">
                <button onClick={logout} className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition shadow-sm flex items-center gap-1.5">
                    Salir
                </button>
            </div>
            <Payment />
        </>
    );
  }

  return (
    <Layout>
      {renderDashboard()}
    </Layout>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}
