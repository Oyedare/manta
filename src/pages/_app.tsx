import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { EnokiFlowProvider } from '@mysten/enoki/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inter } from 'next/font/google';
import '@mysten/dapp-kit/dist/index.css';
import { Toaster } from 'react-hot-toast';
import 'react-datepicker/dist/react-datepicker.css';
import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });
const queryClient = new QueryClient();
const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={inter.className}>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networks} defaultNetwork="testnet">
          <EnokiFlowProvider apiKey={process.env.NEXT_PUBLIC_ENOKI_API_KEY || "enoki_public_key_placeholder"}>
            <WalletProvider>
              <Toaster 
                  position="top-center"
                  toastOptions={{
                      style: {
                          background: 'var(--color-bg-card)', // or just '#fff' since we are light mode only now
                          color: 'var(--color-text-main)',
                          border: '1px solid var(--color-border)',
                          fontFamily: 'var(--font-family)',
                          fontSize: '0.95rem',
                          borderRadius: 'var(--radius-full)',
                          padding: '12px 24px',
                      },
                      success: {
                          iconTheme: {
                              primary: 'var(--color-text-main)',
                              secondary: 'var(--color-bg-card)',
                          },
                      },
                  }}
              />
              <Component {...pageProps} />
            </WalletProvider>
          </EnokiFlowProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </div>
  );
}
