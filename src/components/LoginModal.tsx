import React from 'react';
import { useEnokiFlow } from '@mysten/enoki/react';
import { ConnectButton } from '@mysten/dapp-kit';
import styles from '@/styles/LoginModal.module.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const flow = useEnokiFlow();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
      try {
        window.location.href = await flow.createAuthorizationURL({
            provider: 'google',
            network: 'testnet',
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            redirectUrl: window.location.origin + '/dashboard', 
            extraParams: {
                scope: ['openid', 'email', 'profile']
            }
        });
      } catch (e) {
          console.error("Google Login Error:", e);
      }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.subtitle}>Connect your wallet or sign in with Google.</p>

        <div className={styles.options}>
            {/* Option 1: Standard Wallet */}
            <div className={styles.walletBtnWrapper}>
                 <ConnectButton className={styles.dappConnect} />
            </div>

            <div className={styles.divider}>OR</div>

            {/* Option 2: Social Login */}
            <button className={styles.socialBtn} onClick={handleGoogleLogin}>
                <img src="https://authjs.dev/img/providers/google.svg" alt="Google" width={20} height={20} />
                <span>Continue with Google</span>
            </button>
        </div>
      </div>
    </div>
  );
};
