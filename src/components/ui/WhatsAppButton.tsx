/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageCircle, HelpCircle } from 'lucide-react';
import { Button } from './Button';

export interface WhatsAppButtonProps {
  id: string;
  text?: string;
  message?: string;
  phone?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  showHelpIcon?: boolean;
}

export function WhatsAppButton({
  id,
  text = 'Falar com a Yamel pelo WhatsApp',
  message = '',
  phone = '+55 91 98370-0095',
  size = 'md',
  variant = 'primary',
  showHelpIcon = false,
}: WhatsAppButtonProps) {
  // We do not actually perform window.open or external calls here, per instructions ("NÃO enviar mensagens, apenas preparar o componente visual")
  const handleClick = () => {
    console.log(`[WhatsAppButton Mock] To phone: ${phone}, Message: "${message}"`);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500';
      case 'secondary':
        return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 focus:ring-emerald-400';
      case 'outline':
        return 'border border-emerald-600 text-emerald-700 bg-transparent hover:bg-emerald-50 focus:ring-emerald-500';
      case 'ghost':
        return 'text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-500';
      default:
        return 'bg-emerald-600 hover:bg-emerald-700 text-white';
    }
  };

  return (
    <Button
      id={id}
      onClick={handleClick}
      size={size}
      className={`font-semibold inline-flex items-center gap-2 transition-all shadow-xs ${getVariantStyles()}`}
    >
      {showHelpIcon ? <HelpCircle className="w-4 h-4 opacity-80" /> : <MessageCircle className="w-4 h-4" />}
      <span>{text}</span>
      <span className="text-xs opacity-75 font-normal">({phone})</span>
    </Button>
  );
}
