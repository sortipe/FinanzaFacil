import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AccountantDashboard } from './pages/AccountantDashboard';
import { Payment } from './pages/Payment';
import { UserRole, SubscriptionStatus } from './types';

const MainApp: React.FC = () => {
  const { currentUser } = useStore();

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
            <div className="fixed top-0 right-0 p-4">
                <button onClick={() => window.location.reload()} className="text-gray-500 text-sm">Salir</button>
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
