/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Monitor,
  ShoppingBag,
  Grid,
  ChefHat,
  Truck,
  Wallet,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Layers,
  User,
  Settings,
  BarChart,
  Users,
  ChevronDown,
  ArrowLeft,
  ShoppingCart,
  MessageCircle,
  WifiOff
} from 'lucide-react';

import { useRouter, Link } from '../services/router';
import { ConnectionState } from '../types';
import { ConnectionStatus } from '../components/ui/Feedback';
import { Dropdown } from '../components/ui/Overlay';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { useNetwork } from '../services/storage/useNetwork';
import { cartService } from '../services/cartService';

// ----------------------------------------------------------------------
// 1. PUBLIC LAYOUT
// ----------------------------------------------------------------------
export function PublicLayout({ children }: { children: ReactNode }) {
  const { path } = useRouter();
  const [cart, setCart] = useState(() => cartService.getCart());

  useEffect(() => {
    const unsubscribe = cartService.subscribe(() => {
      setCart(cartService.getCart());
    });
    return () => unsubscribe();
  }, []);

  const totalCartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased font-sans selection:bg-amber-100">
      {/* Public Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/catalogo" className="flex items-center gap-2 select-none hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white font-extrabold flex items-center justify-center text-base tracking-tighter shadow-xs shadow-amber-500/20">
              Y
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-slate-950 tracking-tight leading-none">Yamel</span>
              <span className="text-[10px] text-amber-600 font-bold leading-none mt-1">Cardápio Digital</span>
            </div>
          </Link>

          {/* Quick Info & Cart Link */}
          <div className="flex items-center gap-4">
            <Link 
              to="/catalogo/carrinho" 
              className={`relative p-2.5 rounded-xl transition-all border flex items-center justify-center ${
                path === '/catalogo/carrinho' 
                  ? 'bg-amber-600 border-amber-600 text-white shadow-xs' 
                  : totalCartCount > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Carrinho de Compras"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4 px-1 bg-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                  {totalCartCount}
                </span>
              )}
            </Link>

            {/* Hidden on small mobile, help direct trigger */}
            <div className="hidden sm:block">
              <WhatsAppButton id="public-header-wa" size="sm" variant="outline" text="Pedir Ajuda" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center select-none text-xs text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} Yamel Cardápio Digital. Todos os direitos reservados.</span>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-slate-400 hover:text-slate-600 hover:underline">Painel Operacional</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. OPERATIONAL LAYOUT
// ----------------------------------------------------------------------
export function OperationalLayout({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);

  const { isOnline, pendingCount, status: networkStatus } = useNetwork();

  const operationalRoutes = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: '/pdv', label: 'PDV / Balcão', icon: <Monitor className="w-4 h-4" /> },
    { path: '/pedidos', label: 'Pedidos', icon: <ShoppingBag className="w-4 h-4" /> },
    { path: '/mesas', label: 'Mapa de Mesas', icon: <Grid className="w-4 h-4" /> },
    { path: '/cozinha', label: 'Cozinha', icon: <ChefHat className="w-4 h-4" /> },
    { path: '/delivery', label: 'Delivery', icon: <Truck className="w-4 h-4" /> },
    { path: '/caixa', label: 'Caixa', icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased font-sans">
      {/* Operational Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            id="op-mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg md:hidden transition-colors focus:outline-none"
            aria-label="Abrir Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo brand */}
          <Link to="/dashboard" className="flex items-center gap-2 select-none hover:opacity-90">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-extrabold flex items-center justify-center text-sm tracking-tighter shadow-sm">
              Y
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-slate-950 tracking-tight leading-none">Yamel</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Operações</span>
            </div>
          </Link>
        </div>

        {/* Quick Swapper to Admin & Catalogo */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <Link to="/catalogo" className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-900">
            Ver Cardápio
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/admin" className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-900">
            Painel Administrador
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status dropdown */}
          <Dropdown
            id="op-connection-dropdown"
            isOpen={connDropdownOpen}
            onToggle={() => setConnDropdownOpen(!connDropdownOpen)}
            onClose={() => setConnDropdownOpen(false)}
            trigger={
              <button id="op-conn-status-btn" className="focus:outline-none cursor-pointer">
                <ConnectionStatus status={networkStatus} id="op-connection-indicator" />
              </button>
            }
          >
            <div className="px-4 py-3 w-72 text-slate-700">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase select-none tracking-wider mb-2">
                Arquitetura Offline-First
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Conexão de Rede:</span>
                  <span className={isOnline ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {isOnline ? 'ONLINE' : 'DESCONECTADO'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Fila Outbox (Aguardando):</span>
                  <span className="font-bold text-slate-800">{pendingCount} registros</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                  O Yamel armazena localmente todos os pedidos, caixas, produtos e comandas no <strong>IndexedDB</strong>. Quando a internet cai, nada é perdido. As operações são transmitidas de forma segura quando a rede voltar.
                </div>
              </div>
            </div>
          </Dropdown>

          {/* Profile Dropdown */}
          <Dropdown
            id="op-user-dropdown"
            isOpen={userDropdownOpen}
            onToggle={() => setUserDropdownOpen(!userDropdownOpen)}
            onClose={() => setUserDropdownOpen(false)}
            trigger={
              <button id="op-user-btn" className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-lg transition-colors focus:outline-none cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 border border-slate-200">
                  JQ
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>
            }
          >
            <div className="px-4 py-2.5 border-b border-slate-50">
              <p className="text-xs font-bold text-slate-900 leading-none">João Quadros</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-none">Operador de Frente</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  navigate('/admin');
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 font-semibold"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Painel Administrador</span>
              </button>
              <button
                onClick={() => {
                  navigate('/catalogo');
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Ver Cardápio Público</span>
              </button>
            </div>
          </Dropdown>
        </div>
      </header>

      {/* Operational Body layout */}
      <div className="flex-1 flex relative">
        {/* DESKTOP SIDEBAR */}
        <aside id="op-desktop-sidebar" className="w-64 bg-white border-r border-slate-100 hidden md:flex flex-col justify-between sticky top-[57px] h-[calc(100vh-57px)]">
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 scrollbar-none">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase px-3 select-none">
                Canais Operacionais
              </span>
              <nav className="flex flex-col gap-1 mt-1">
                {operationalRoutes.map((route) => {
                  // Route active logic checks path prefix or identical
                  const isActive = path === route.path || path.startsWith(route.path + '/');
                  return (
                    <Link
                      key={route.path}
                      to={route.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-amber-600 border-amber-600 text-white shadow-xs shadow-amber-500/10'
                          : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{route.icon}</span>
                      <span>{route.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="p-4 border-t border-slate-50 text-center bg-slate-50/50">
            <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase">Yamel Operações v1.0</span>
          </div>
        </aside>

        {/* Dynamic Body Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-7xl mx-auto w-full">
          {/* Real-time connection warners (Local-First Pattern) */}
          {!isOnline && (
            <div id="offline-notification-bar" className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900 shadow-2xs select-none">
              <WifiOff className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-extrabold text-xs block mb-0.5">Modo Offline Ativo</span>
                <span className="text-[11px] text-red-600 font-medium leading-relaxed block">
                  Você está sem conexão de internet, mas o Yamel está <strong>100% operacional</strong> localmente.
                  Você pode continuar registrando comandas, atendendo mesas e operando o caixa sem nenhuma perda.
                  Todos os dados estão salvos de forma persistente no seu navegador e serão sincronizados automaticamente quando a conexão retornar.
                </span>
              </div>
            </div>
          )}

          {isOnline && pendingCount > 0 && (
            <div id="sync-notification-bar" className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 shadow-2xs select-none">
              <RefreshCw className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-xs block mb-0.5">Operações locais pendentes</span>
                <span className="text-[11px] text-amber-600 font-medium leading-relaxed block">
                  Existem <strong>{pendingCount} {pendingCount === 1 ? 'operação armazenada' : 'operações armazenadas'}</strong> localmente aguardando sincronização com o servidor. Seus dados permanecem seguros neste dispositivo.
                </span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div id="op-mobile-menu-portal" className="fixed inset-0 z-50 md:hidden flex overflow-hidden">
            <motion.div
              id="op-mobile-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              id="op-mobile-menu-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="relative w-screen max-w-xs bg-white h-full flex flex-col justify-between shadow-xl"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-extrabold flex items-center justify-center text-xs">
                    Y
                  </div>
                  <span className="text-sm font-extrabold text-slate-950">Yamel Operações</span>
                </div>
                <button
                  id="op-mobile-menu-close"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                <nav className="flex flex-col gap-1">
                  {operationalRoutes.map((route) => {
                    const isActive = path === route.path || path.startsWith(route.path + '/');
                    return (
                      <Link
                        key={route.path}
                        to={route.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          isActive
                            ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                            : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-slate-400'}>{route.icon}</span>
                        <span>{route.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                
                <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                  <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase px-3">
                    Outros Ambientes
                  </span>
                  <Link to="/catalogo" className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                    <Sparkles className="w-4 h-4 text-slate-400" />
                    <span>Ir para o Cardápio</span>
                  </Link>
                  <Link to="/admin" className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Painel Administrador</span>
                  </Link>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Yamel Delivery v1.0</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. ADMIN LAYOUT
// ----------------------------------------------------------------------
export function AdminLayout({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const adminRoutes = [
    { path: '/admin', label: 'Painel Geral', icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: '/admin/produtos', label: 'Produtos', icon: <Sparkles className="w-4 h-4" /> },
    { path: '/admin/categorias', label: 'Categorias', icon: <FolderOpen className="w-4 h-4" /> },
    { path: '/admin/acompanhamentos', label: 'Acompanhamentos', icon: <Layers className="w-4 h-4" /> },
    { path: '/admin/relatorios', label: 'Relatórios de Vendas', icon: <BarChart className="w-4 h-4" /> },
    { path: '/admin/usuarios', label: 'Equipe e Cargos', icon: <Users className="w-4 h-4" /> },
    { path: '/admin/configuracoes', label: 'Ajustes Estabelecimento', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased font-sans">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-xs text-white">
        <div className="flex items-center gap-3">
          <button
            id="admin-mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg md:hidden transition-colors focus:outline-none"
            aria-label="Abrir Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo brand */}
          <Link to="/admin" className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-extrabold flex items-center justify-center text-sm tracking-tighter shadow-sm">
              Y
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight leading-none text-white">Yamel</span>
              <span className="text-[9px] text-amber-500 font-bold uppercase mt-0.5">Administrador</span>
            </div>
          </Link>
        </div>

        {/* Back button to Operational */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para Operação</span>
          </Link>

          {/* Profile Dropdown */}
          <Dropdown
            id="admin-user-dropdown"
            isOpen={userDropdownOpen}
            onToggle={() => setUserDropdownOpen(!userDropdownOpen)}
            onClose={() => setUserDropdownOpen(false)}
            trigger={
              <button id="admin-user-btn" className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                  ADM
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>
            }
          >
            <div className="px-4 py-2.5 border-b border-slate-50 text-slate-800">
              <p className="text-xs font-bold text-slate-900 leading-none">Diretoria Yamel</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-none">admin@yamel.com.br</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <span>Modo Operador</span>
              </button>
              <button
                onClick={() => {
                  navigate('/catalogo');
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Visualizar Cardápio</span>
              </button>
            </div>
          </Dropdown>
        </div>
      </header>

      {/* Admin Body Layout */}
      <div className="flex-1 flex relative">
        {/* DESKTOP SIDEBAR */}
        <aside id="admin-desktop-sidebar" className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col justify-between sticky top-[57px] h-[calc(100vh-57px)] border-r border-slate-800">
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 scrollbar-none">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase px-3 select-none">
                Gestão Geral
              </span>
              <nav className="flex flex-col gap-1 mt-1">
                {adminRoutes.map((route) => {
                  const isActive = path === route.path || path.startsWith(route.path + '/');
                  return (
                    <Link
                      key={route.path}
                      to={route.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                          : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-500'}>{route.icon}</span>
                      <span>{route.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 text-center bg-slate-950/20">
            <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">Yamel Admin v1.0</span>
          </div>
        </aside>

        {/* Admin Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div id="admin-mobile-menu-portal" className="fixed inset-0 z-50 md:hidden flex overflow-hidden">
            <motion.div
              id="admin-mobile-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <motion.div
              id="admin-mobile-menu-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="relative w-screen max-w-xs bg-slate-900 text-slate-300 h-full flex flex-col justify-between shadow-xl"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-extrabold flex items-center justify-center text-xs">
                    Y
                  </div>
                  <span className="text-sm font-extrabold text-white">Yamel Admin</span>
                </div>
                <button
                  id="admin-mobile-menu-close"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                <nav className="flex flex-col gap-1">
                  {adminRoutes.map((route) => {
                    const isActive = path === route.path || path.startsWith(route.path + '/');
                    return (
                      <Link
                        key={route.path}
                        to={route.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          isActive
                            ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-slate-500'}>{route.icon}</span>
                        <span>{route.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                
                <div className="border-t border-slate-800 pt-4 flex flex-col gap-2">
                  <span className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase px-3">
                    Outras Áreas
                  </span>
                  <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-lg">
                    <ArrowLeft className="w-4 h-4 text-slate-500" />
                    <span>Voltar à Operação</span>
                  </Link>
                  <Link to="/catalogo" className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-lg">
                    <Sparkles className="w-4 h-4 text-slate-500" />
                    <span>Cardápio Público</span>
                  </Link>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 text-center bg-slate-950/20">
                <span className="text-[9px] font-bold text-slate-500 block uppercase">Yamel Admin v1.0</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
