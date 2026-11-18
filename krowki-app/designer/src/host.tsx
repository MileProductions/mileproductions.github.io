import { createContext, useContext } from 'react';
import type { AuthProvider, OrderProvider } from './adapters';

export interface HostConfig {
  auth: AuthProvider;
  orders: OrderProvider;
  /** emituje zdarzenie do strony-rodzica (CustomEvent na elemencie modułu / postMessage w iframe) */
  emit: (name: string, detail?: unknown) => void;
  /** kontener dla okien (portal) – w Shadow DOM musi być wewnątrz modułu */
  portalRoot?: HTMLElement;
  showCustomerForm: boolean;
}

export const HostContext = createContext<HostConfig>(null as unknown as HostConfig);
export const useHost = () => useContext(HostContext);
