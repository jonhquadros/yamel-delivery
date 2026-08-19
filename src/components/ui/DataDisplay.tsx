/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, HTMLAttributes, MouseEvent } from 'react';

// CARD COMPONENT
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  id?: string;
  className?: string;
  key?: string | number | null;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function Card({ children, id, className = '', ...props }: CardProps) {
  return (
    <div
      id={id}
      className={`bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}

export function CardHeader({ title, subtitle, action, id, className = '' }: CardHeaderProps) {
  return (
    <div
      id={id}
      className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 ${className}`}
    >
      <div>
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export interface CardContentProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

export function CardContent({ children, id, className = '' }: CardContentProps) {
  return (
    <div id={id} className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

// BADGE COMPONENT
export interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  id?: string;
  className?: string;
}

export function Badge({ variant = 'secondary', children, id, className = '' }: BadgeProps) {
  const styles = {
    primary: 'bg-amber-50 text-amber-700 border-amber-200',
    secondary: 'bg-slate-50 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-300',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// TABS COMPONENT
export interface TabOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  options: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  id: string;
  className?: string;
}

export function Tabs({ options, activeTab, onChange, id, className = '' }: TabsProps) {
  return (
    <div id={id} className={`border-b border-slate-100 ${className}`}>
      <nav className="-mb-px flex gap-4 overflow-x-auto scrollbar-none" aria-label="Abas">
        {options.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`${id}-tab-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition-colors focus:outline-none ${
                isActive
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// TABLE COMPONENT
export interface TableProps {
  headers: ReactNode[];
  children: ReactNode;
  id: string;
  className?: string;
}

export function Table({ headers, children, id, className = '' }: TableProps) {
  return (
    <div id={`${id}-wrapper`} className={`w-full overflow-x-auto border border-slate-100 rounded-xl ${className}`}>
      <table id={id} className="w-full text-left border-collapse bg-white">
        <thead>
          <tr className="bg-slate-50/75 border-b border-slate-100">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-5 py-3 text-xs font-semibold text-slate-600 select-none"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
