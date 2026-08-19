/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

// DIALOG COMPONENT
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Dialog({ isOpen, onClose, title, children, id, size = 'md' }: DialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          {/* Backdrop */}
          <motion.div
            id={`${id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            id={`${id}-content`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className={`relative w-full ${sizeClasses[size]} bg-white border border-slate-100 rounded-2xl shadow-2xl z-10 flex flex-col max-h-[92vh] overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
              <button
                id={`${id}-close`}
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// DRAWER COMPONENT
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id: string;
  position?: 'right' | 'left';
}

export function Drawer({ isOpen, onClose, title, children, id, position = 'right' }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const slideVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            id={`${id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
          />

          {/* Drawer Panel */}
          <div className={`fixed inset-y-0 ${position === 'right' ? 'right-0' : 'left-0'} flex max-w-full`}>
            <motion.div
              id={`${id}-panel`}
              variants={slideVariants[position]}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'tween', duration: 0.2 }}
              className="w-screen max-w-md bg-white border-l border-slate-100 shadow-xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <button
                  id={`${id}-close`}
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

// DROPDOWN/POPOVER MENU COMPONENT
export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  id: string;
  align?: 'right' | 'left';
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function Dropdown({ trigger, children, id, align = 'right', isOpen, onToggle, onClose }: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative inline-block text-left" id={id}>
      <div onClick={onToggle} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`${id}-menu`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.12 }}
            className={`absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } mt-2 w-48 rounded-lg border border-slate-100 bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-40 overflow-hidden`}
          >
            <div className="py-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// TOOLTIP COMPONENT
export interface TooltipProps {
  content: string;
  children: ReactNode;
  id: string;
}

export function Tooltip({ content, children, id }: TooltipProps) {
  return (
    <div id={id} className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-slate-900 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap">
          {content}
        </div>
        <div className="w-2 h-2 bg-slate-900 rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1" />
      </div>
    </div>
  );
}
