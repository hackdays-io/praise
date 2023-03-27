// eslint-disable-next-line import/no-unresolved
import '@rainbow-me/rainbowkit/styles.css';
import {
  lightTheme,
  Theme as RainbowTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import merge from 'lodash/merge';
import { WagmiConfig, configureChains, createClient } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { mainnet } from 'wagmi/chains';
import { infuraProvider } from 'wagmi/providers/infura';

const { chains, provider } = configureChains(
  [mainnet],
  [
    infuraProvider({
      apiKey: '1f04715c0a10492483047083a5c3edd2',
    }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: 'Praise',
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

const customTheme = merge(lightTheme(), {
  colors: {
    accentColor: '#E1007F', // tailwind color gray-800
  },
  radii: {
    connectButton: '0.375rem', // tailwind radius 'rounded'
    modal: '0.375rem',
  },
} as RainbowTheme);

interface Web3ProviderProps {
  children: JSX.Element;
}

export function Web3Provider({ children }: Web3ProviderProps): JSX.Element {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        theme={customTheme}
        modalSize="compact"
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}