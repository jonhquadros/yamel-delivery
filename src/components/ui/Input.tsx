/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ChangeEvent,
  FocusEvent,
  KeyboardEvent
} from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id: string;
  className?: string;
  placeholder?: string;
  value?: string | number | readonly string[];
  disabled?: boolean;
  type?: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoFocus?: boolean;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:bg-slate-50 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  id: string;
  options: { value: string; label: string }[];
  className?: string;
  value?: string | number | readonly string[];
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFocus?: (e: FocusEvent<HTMLSelectElement>) => void;
  onBlur?: (e: FocusEvent<HTMLSelectElement>) => void;
}

export function Select({ label, error, id, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:bg-slate-50 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  id: string;
  className?: string;
  placeholder?: string;
  value?: string | number | readonly string[];
  disabled?: boolean;
  rows?: number;
  name?: string;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
}

export function Textarea({ label, error, id, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700 select-none">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={3}
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:bg-slate-50 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}
