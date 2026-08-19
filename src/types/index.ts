/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppRoute =
  | 'dashboard'
  | 'pdv'
  | 'pedidos'
  | 'mesas'
  | 'cozinha'
  | 'delivery'
  | 'caixa'
  | 'produtos'
  | 'categorias'
  | 'relatorios'
  | 'usuarios'
  | 'configuracoes';

export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'SINCRONIZANDO' | 'SINCRONIZADO';

export interface CompanyConfig {
  name: string;
  fullName: string;
  description: string;
  whatsappNumber: string;
  address: string;
  logo: string;
  primaryColor: string;
  businessHours: string;
  deliveryFee: number;
}
