/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { ConnectionState } from '../../types';

export type RealConnectionState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'AWAITING_SYNC' | 'FAILED';

export interface ConnectionStatusProps {
  status: RealConnectionState;
  id: string;
}

export function ConnectionStatus({ status, id }: ConnectionStatusProps) {
  const configs = {
    ONLINE: {
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <Wifi className="w-4 h-4 text-emerald-500" />,
      label: 'Conectado',
    },
    OFFLINE: {
      color: 'text-amber-700 bg-amber-50 border-amber-200 shadow-xs',
      icon: <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" />,
      label: 'Sem conexão — operação local disponível',
    },
    SYNCING: {
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
      label: 'Sincronizando',
    },
    SYNCED: {
      color: 'text-teal-700 bg-teal-50 border-teal-200',
      icon: <CheckCircle2 className="w-4 h-4 text-teal-500" />,
      label: 'Sincronizado',
    },
    AWAITING_SYNC: {
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      label: 'Aguardando sincronização',
    },
    FAILED: {
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
      label: 'Falha na Sincronização',
    }
  };

  const active = configs[status] || configs.ONLINE;

  return (
    <div
      id={id}
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${active.color} transition-colors duration-200 select-none`}
    >
      {active.icon}
      <span>{active.label}</span>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  id: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, id, action }: EmptyStateProps) {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl"
    >
      <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-xs mb-3">
        <Inbox className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

export interface LoadingStateProps {
  message?: string;
  id: string;
}

export function LoadingState({ message = 'Carregando dados...', id }: LoadingStateProps) {
  return (
    <div id={id} className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
      <span className="text-xs font-semibold text-slate-500">{message}</span>
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  id: string;
}

export function ErrorState({
  title = 'Ocorreu um erro',
  message = 'Não foi possível carregar as informações.',
  onRetry,
  id,
}: ErrorStateProps) {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center text-center p-6 border border-red-100 bg-red-50/30 rounded-xl"
    >
      <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg mb-3">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          id={`${id}-retry-btn`}
          onClick={onRetry}
          className="px-3.5 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-200 rounded-lg shadow-2xs hover:bg-red-50 transition-colors focus:outline-none"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
}
