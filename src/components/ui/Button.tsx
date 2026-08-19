/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ButtonHTMLAttributes, ReactNode, MouseEvent, Key } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  key?: Key;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  children,
  id,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500',
    outline: 'border border-slate-200 text-slate-700 bg-transparent hover:bg-slate-50 focus:ring-slate-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus:ring-slate-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      id={id}
      type={type}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
