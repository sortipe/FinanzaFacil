import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AccountantDashboard } from './pages/AccountantDashboard';
import { Payment } from './pages/Payment';
import { UserRole, SubscriptionStatus } from './types';

const isUserRole = (r?: UserRole) => r === UserRole.USER || r === UserRole.EMPRESARIO || r === UserRole.PERSONA_NATURAL;
const isAccountantRole = (r?: UserRole) => r === UserRole.ACCOUNTANT || r === UserRole.CONTADOR;

const MainApp: React.FC = () => {
  const { currentUser, updateUser, logout, companies, users, loading } = useStore();

  useEffect(() => {
    if ((isUserRole(currentUser?.role) || isAccountantRole(currentUser?.role)) && currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && currentUser.subscriptionEndDate) {
      const today = new Date().toISOString().split('T')[0];
      if (currentUser.subscriptionEndDate < today) {
        updateUser(currentUser.id, { subscriptionStatus: SubscriptionStatus.EXPIRED });
      }
    }
  }, [currentUser?.id, currentUser?.subscriptionEndDate, currentUser?.subscriptionStatus]);

  if (!currentUser || currentUser.mustChangePassword) {
    return <Auth />;
  }

  // Don't evaluate subscription/inheritance routing while the store is still
  // hydrating. If we render Payment here before the async init completes, users
  // who have an inherited/active subscription (resolvable only once `companies`
  // and `users` finish loading) briefly see the "planes" screen, then it
  // disappears — the reported flicker.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-sm font-black uppercase tracking-widest">Cargando...</span>
        </div>
      </div>
    );
  }

  // Check own subscription
  const hasOwnSubscription = currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE;

  // For USER role: check if accountant has active subscription (inheritance)
  // For ACCOUNTANT role: check if any client USER has active subscription (inheritance)
  let hasInheritedSubscription = false;
  if (isUserRole(currentUser.role)) {
    const clientCompanies = companies.filter(c => c.ownerUserId === currentUser.id);
    const accountantId = clientCompanies.find(c => c.assignedAccountantId)?.assignedAccountantId;
    if (accountantId) {
      const accountant = users.find(u => u.id === accountantId);
      if (accountant && accountant.subscriptionStatus === SubscriptionStatus.ACTIVE) {
        hasInheritedSubscription = true;
      }
    }
  } else if (isAccountantRole(currentUser.role)) {
    // Find all companies where this accountant is assigned
    const assignedCompanies = companies.filter(c => c.assignedAccountantId === currentUser.id);
    // Check if ANY of those company owners has an active subscription
    for (const comp of assignedCompanies) {
      const owner = users.find(u => u.id === comp.ownerUserId && isUserRole(u.role));
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
      case UserRole.CONTADOR:
        return <AccountantDashboard />;
      case UserRole.USER:
      case UserRole.EMPRESARIO:
      case UserRole.PERSONA_NATURAL:
        return <UserDashboard />;
      default:
        return <div>Rol desconocido</div>;
    }
  };

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
