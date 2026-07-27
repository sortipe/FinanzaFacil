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
  const { currentUser, updateUser, logout, companies, users } = useStore();

  useEffect(() => {
    if ((currentUser?.role === UserRole.USER || currentUser?.role === UserRole.ACCOUNTANT) && currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && currentUser.subscriptionEndDate) {
      const today = new Date().toISOString().split('T')[0];
      if (currentUser.subscriptionEndDate < today) {
        updateUser(currentUser.id, { subscriptionStatus: SubscriptionStatus.EXPIRED });
      }
    }
  }, [currentUser?.id, currentUser?.subscriptionEndDate, currentUser?.subscriptionStatus]);

  if (!currentUser || currentUser.mustChangePassword) {
    return <Auth />;
  }

  // Check own subscription
  const hasOwnSubscription = currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE;

  // For USER role: check if accountant has active subscription (inheritance)
  // For ACCOUNTANT role: check if any client USER has active subscription (inheritance)
  let hasInheritedSubscription = false;
  if (currentUser.role === UserRole.USER) {
    const clientCompanies = companies.filter(c => c.ownerUserId === currentUser.id);
    const accountantId = clientCompanies.find(c => c.assignedAccountantId)?.assignedAccountantId;
    if (accountantId) {
      const accountant = users.find(u => u.id === accountantId);
      if (accountant && accountant.subscriptionStatus === SubscriptionStatus.ACTIVE) {
        hasInheritedSubscription = true;
      }
    }
  } else if (currentUser.role === UserRole.ACCOUNTANT) {
    // Find all companies where this accountant is assigned
    const assignedCompanies = companies.filter(c => c.assignedAccountantId === currentUser.id);
    // Check if ANY of those company owners has an active subscription
    for (const comp of assignedCompanies) {
      const owner = users.find(u => u.id === comp.ownerUserId && u.role === UserRole.USER);
      if (owner && owner.subscriptionStatus === SubscriptionStatus.ACTIVE) {
        hasInheritedSubscription = true;
        break;
      }
    }
  }

  const hasActiveSubscription = hasOwnSubscription || hasInheritedSubscription;
  const needsSubscription = !hasActiveSubscription;

  // Role Based Routing
  const renderDashboard = () => {
    switch (currentUser.role) {
      case UserRole.ADMIN:
        return <AdminDashboard />;
      case UserRole.ACCOUNTANT:
        if (needsSubscription) return <Payment />;
        return <AccountantDashboard />;
      case UserRole.USER:
        if (needsSubscription) return <Payment />;
        return <UserDashboard />;
      default:
        return <div>Rol desconocido</div>;
    }
  };

  if (needsSubscription && (currentUser.role === UserRole.USER || currentUser.role === UserRole.ACCOUNTANT)) {
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
