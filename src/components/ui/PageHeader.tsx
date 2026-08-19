/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  id: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryAction,
  id,
}: PageHeaderProps) {
  return (
    <div id={id} className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between pb-5 border-b border-slate-100">
      <div className="flex flex-col gap-1">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 select-none mb-1">
            {breadcrumbs.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                {item.onClick ? (
                  <button
                    id={`${id}-breadcrumb-${idx}`}
                    onClick={item.onClick}
                    className="hover:text-slate-600 transition-colors focus:outline-none"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={idx === breadcrumbs.length - 1 ? 'text-slate-600 font-medium' : ''}>
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">{title}</h1>
        {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
      </div>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2.5 mt-2 md:mt-0">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
