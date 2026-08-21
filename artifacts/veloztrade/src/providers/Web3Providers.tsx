import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import { useTheme } from "@/components/theme-provider";
import type { ReactNode } from "react";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = getDefaultConfig({
  appName: "VelozTrade",
  projectId: projectId || "fallback-placeholder",
  chains: [bsc, polygon],
  ssr: false,
});

export function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
    </WagmiProvider>
  );
}

export function RainbowKitWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <RainbowKitProvider theme={theme === "light" ? lightTheme() : darkTheme()}>
      {children}
    </RainbowKitProvider>
  );
}
