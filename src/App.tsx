/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RouterProvider, useRouter } from './services/router';
import { PublicLayout, OperationalLayout, AdminLayout } from './layouts/Layouts';

// Views
import { DashboardView } from './pages/DashboardView';
import { PdvView, PedidosView, MesasView, CozinhaView, DeliveryView, CaixaView } from './pages/OperationalViews';
import {
  ProdutosView,
  CategoriasView,
  PublicCatalogView,
  PublicProductDetailView,
  PublicCartView,
  PublicOrderTrackerView
} from './pages/CatalogViews';
import { RelatoriosView, UsuariosView, ConfiguracoesView, NotFoundView } from './pages/ManagementViews';

function AppContent() {
  const { path, activeRouteConfig, navigate } = useRouter();

  // 1. Content Router Switchboard
  const renderContent = () => {
    // PUBLIC ROUTES
    if (path === '/catalogo' || path.startsWith('/catalogo/categoria/')) {
      return <PublicCatalogView />;
    }
    if (path.startsWith('/catalogo/produto/')) {
      return <PublicProductDetailView />;
    }
    if (path === '/catalogo/carrinho') {
      return <PublicCartView />;
    }
    if (path.startsWith('/pedido/')) {
      return <PublicOrderTrackerView />;
    }

    // OPERATIONAL ROUTES
    if (path === '/dashboard') {
      return <DashboardView />;
    }
    if (path === '/pdv') {
      return <PdvView />;
    }
    if (path === '/pedidos' || path.startsWith('/pedidos/')) {
      return <PedidosView />;
    }
    if (path === '/mesas' || path.startsWith('/mesas/')) {
      return <MesasView />;
    }
    if (path === '/cozinha') {
      return <CozinhaView />;
    }
    if (path === '/delivery') {
      return <DeliveryView />;
    }
    if (path === '/caixa') {
      return <CaixaView />;
    }

    // ADMINISTRATIVE ROUTES
    if (path === '/admin') {
      return <RelatoriosView />; // Admin Dashboard main landing is Reports
    }
    if (path === '/admin/produtos') {
      return <ProdutosView />;
    }
    if (path === '/admin/categorias') {
      return <CategoriasView />;
    }
    if (path === '/admin/relatorios') {
      return <RelatoriosView />;
    }
    if (path === '/admin/usuarios') {
      return <UsuariosView />;
    }
    if (path === '/admin/configuracoes') {
      return <ConfiguracoesView />;
    }

    // 404 Fallback page
    return <NotFoundView onBackToDashboard={() => navigate('/dashboard')} />;
  };

  // 2. Select corresponding Layout depending on RouteConfig metadata
  const layout = activeRouteConfig?.layout || 'operational';

  switch (layout) {
    case 'public':
      return <PublicLayout>{renderContent()}</PublicLayout>;
    case 'admin':
      return <AdminLayout>{renderContent()}</AdminLayout>;
    case 'operational':
    default:
      return <OperationalLayout>{renderContent()}</OperationalLayout>;
  }
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
