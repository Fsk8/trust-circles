import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, createConfig } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Trust Circles',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'TU_ID_DE_WALLET_CONNECT',
  chains: [avalancheFuji],
  ssr: true, // Muy importante para Next.js 16
  transports: {
    [avalancheFuji.id]: http(),
  },
});