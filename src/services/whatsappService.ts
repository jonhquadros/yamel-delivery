/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WhatsAppMessagePayload {
  orderId?: string;
  customerName?: string;
  itemsSummary?: string;
  total?: number;
  deliveryAddress?: string;
  customText?: string;
}

export class WhatsAppService {
  private defaultPhone: string;

  constructor(defaultPhone: string = '+55 91 98370-0095') {
    this.defaultPhone = this.cleanPhoneNumber(defaultPhone);
  }

  /**
   * Cleans a phone number string to keep only digits.
   */
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Generates a WhatsApp Click to Chat URL.
   */
  public generateChatUrl(text: string, customPhone?: string): string {
    const targetPhone = customPhone ? this.cleanPhoneNumber(customPhone) : this.defaultPhone;
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${targetPhone}?text=${encodedText}`;
  }

  /**
   * Formats a structured delivery or order message to send over WhatsApp.
   */
  public formatOrderMessage(payload: WhatsAppMessagePayload): string {
    let message = `*Yamel — Pedido* 🍔\n\n`;
    
    if (payload.orderId) {
      message += `*Pedido:* #${payload.orderId}\n`;
    }
    if (payload.customerName) {
      message += `*Cliente:* ${payload.customerName}\n`;
    }
    message += `-----------------------------\n`;
    if (payload.itemsSummary) {
      message += `${payload.itemsSummary}\n`;
    }
    message += `-----------------------------\n`;
    if (payload.total !== undefined) {
      message += `*Total:* R$ ${payload.total.toFixed(2)}\n`;
    }
    if (payload.deliveryAddress) {
      message += `📍 *Endereço de Entrega:*\n${payload.deliveryAddress}\n`;
    }
    if (payload.customText) {
      message += `\n${payload.customText}`;
    }
    
    message += `\n\nAgradecemos a preferência! 😊`;
    return message;
  }

  /**
   * Triggers the redirection to WhatsApp.
   */
  public sendOrderMessage(payload: WhatsAppMessagePayload, customPhone?: string): void {
    const formattedText = this.formatOrderMessage(payload);
    const url = this.generateChatUrl(formattedText, customPhone);
    // Use safe window navigation
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}

export const whatsappService = new WhatsAppService();
