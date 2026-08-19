/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, ReactNode, MouseEvent } from 'react';

export type RouteArea = 'public' | 'operation' | 'admin';
export type RouteLayout = 'public' | 'operational' | 'admin';

export interface RouteConfig {
  path: string;
  label: string;
  area: RouteArea;
  layout: RouteLayout;
  parentPath?: string;
}

// Global list of configured routes in the Yamel ecosystem
export const routeConfig: RouteConfig[] = [
  // CATÁLOGO PÚBLICO
  { path: '/catalogo', label: 'Cardápio Digital', area: 'public', layout: 'public' },
  { path: '/catalogo/produto/:id', label: 'Detalhes do Produto', area: 'public', layout: 'public', parentPath: '/catalogo' },
  { path: '/catalogo/categoria/:id', label: 'Categoria', area: 'public', layout: 'public', parentPath: '/catalogo' },
  { path: '/catalogo/carrinho', label: 'Carrinho de Compras', area: 'public', layout: 'public', parentPath: '/catalogo' },
  { path: '/pedido/:id', label: 'Acompanhar Pedido', area: 'public', layout: 'public' },

  // OPERAÇÃO INTERNA
  { path: '/dashboard', label: 'Dashboard', area: 'operation', layout: 'operational' },
  { path: '/pdv', label: 'Frente de Caixa (PDV)', area: 'operation', layout: 'operational' },
  { path: '/pedidos', label: 'Fila de Pedidos', area: 'operation', layout: 'operational' },
  { path: '/pedidos/:id', label: 'Detalhes do Pedido', area: 'operation', layout: 'operational', parentPath: '/pedidos' },
  { path: '/mesas', label: 'Mapa de Mesas', area: 'operation', layout: 'operational' },
  { path: '/mesas/:id', label: 'Detalhes da Mesa', area: 'operation', layout: 'operational', parentPath: '/mesas' },
  { path: '/cozinha', label: 'Monitor de Preparo (KDS)', area: 'operation', layout: 'operational' },
  { path: '/delivery', label: 'Controle de Delivery', area: 'operation', layout: 'operational' },
  { path: '/caixa', label: 'Fluxo de Caixa', area: 'operation', layout: 'operational' },

  // ADMINISTRAÇÃO
  { path: '/admin', label: 'Painel Administrativo', area: 'admin', layout: 'admin' },
  { path: '/admin/produtos', label: 'Gerenciar Produtos', area: 'admin', layout: 'admin', parentPath: '/admin' },
  { path: '/admin/categorias', label: 'Gerenciar Categorias', area: 'admin', layout: 'admin', parentPath: '/admin' },
  { path: '/admin/relatorios', label: 'Relatórios de Vendas', area: 'admin', layout: 'admin', parentPath: '/admin' },
  { path: '/admin/usuarios', label: 'Equipe e Cargos', area: 'admin', layout: 'admin', parentPath: '/admin' },
  { path: '/admin/configuracoes', label: 'Ajustes do Sistema', area: 'admin', layout: 'admin', parentPath: '/admin' },
];

export interface RouterContextType {
  path: string;
  params: Record<string, string>;
  activeRouteConfig: RouteConfig | null;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// Helper to clean and normalize hash to standard path format (e.g. #/pdv -> /pdv)
export function getCleanPathFromHash(): string {
  const hash = window.location.hash;
  if (!hash) return '/dashboard'; // Default initial route
  const clean = hash.replace(/^#/, '');
  return clean.startsWith('/') ? clean : '/' + clean;
}

// Simple path match utility supporting wildcards and params (e.g. /pedidos/:id)
export function matchPath(pattern: string, path: string): { matches: boolean; params: Record<string, string> } {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return { matches: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const pathSeg = pathSegments[i];

    if (patternSeg.startsWith(':')) {
      const paramName = patternSeg.slice(1);
      params[paramName] = pathSeg;
    } else if (patternSeg.toLowerCase() !== pathSeg.toLowerCase()) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(getCleanPathFromHash());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getCleanPathFromHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Find active route and parse parameters
  let matchedConfig: RouteConfig | null = null;
  let parsedParams: Record<string, string> = {};

  for (const config of routeConfig) {
    const { matches, params } = matchPath(config.path, currentPath);
    if (matches) {
      matchedConfig = config;
      parsedParams = params;
      break;
    }
  }

  const navigate = (to: string) => {
    const formatted = to.startsWith('/') ? to : '/' + to;
    window.location.hash = formatted;
  };

  return (
    <RouterContext.Provider
      value={{
        path: currentPath,
        params: parsedParams,
        activeRouteConfig: matchedConfig,
        navigate,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

export interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  key?: string | number;
}

export function Link({ to, children, className = '', id, title }: LinkProps) {
  const { navigate, path } = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // If command/control click, let the browser handle it in a new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    
    e.preventDefault();
    navigate(to);
  };

  const isActive = path === to || (to !== '/' && path.startsWith(to));

  return (
    <a
      id={id}
      href={`#${to}`}
      onClick={handleClick}
      className={className}
      title={title}
      data-active={isActive ? 'true' : undefined}
    >
      {children}
    </a>
  );
}
