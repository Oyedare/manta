import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useEnokiFlow } from '@mysten/enoki/react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Home.module.css';
import { useState } from 'react';
import { LoginModal } from '@/components/LoginModal';

export default function Home() {
  const [isModalOpen, setModalOpen] = useState(false);
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const flow = useEnokiFlow();

  const handleDisconnect = async () => {
      // Disconnect both to be safe
      disconnect();
      try {
        await flow.logout();
      } catch (e) {
          console.error("Enoki logout error:", e);
      }
  };

  return (
    <>
      <Head>
        <title>Manta | Decentralized Surveys</title>
        <meta name="description" content="Privacy-first survey platform on Sui" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <LoginModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />

      <header className={styles.header}>
        <div className={styles.logo}>Manta 魟</div>
        <div className={styles.headerRight}>
             <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
             
             {account ? (
                 <button 
                     onClick={handleDisconnect}
                     title="Click to Disconnect"
                     style={{
                         display: 'flex', 
                         alignItems: 'center', 
                         gap: '8px', 
                         padding: '8px 16px', 
                         background: '#f7fafc', 
                         borderRadius: '20px', 
                         border: '1px solid #edf2f7',
                         fontSize: '0.9rem',
                         fontWeight: 500,
                         color: '#4a5568',
                         cursor: 'pointer',
                         transition: 'background 0.2s'
                     }}
                     onMouseOver={(e) => e.currentTarget.style.background = '#edf2f7'}
                     onMouseOut={(e) => e.currentTarget.style.background = '#f7fafc'}
                 >
                    <span style={{width: 8, height: 8, background: '#48bb78', borderRadius: '50%', display: 'inline-block'}}></span>
                    {account.address.slice(0, 4)}...{account.address.slice(-4)}
                 </button>
             ) : (
                 <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{padding: '0.5rem 1.25rem', fontSize: '0.9rem'}}>
                    Login / Connect
                 </button>
             )}
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.title}>
            Simplicity meets <br />
            <span className={styles.highlight}>Web3 Utility</span>.
          </h1>
          <p className={styles.subtitle}>
            Create encrypted, decentralized surveys in seconds. <br/>
            Store data on Walrus. Pure web3 privacy.
          </p>
          
          <div className={styles.ctaGroup}>
             <Link href="/create" className="btn btn-primary">
                Start Survey
             </Link>
             <Link href="/dashboard" className="btn btn-secondary">
                View Dashboard
             </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why Manta?</h2>
            <div className={styles.features}>
                <div className={styles.featureCard}>
                    <h3>🔒 Privacy by Default</h3>
                    <p>Responses are encrypted client-side and stored on decentralized Walrus storage. No centralized database.</p>
                </div>
                <div className={styles.featureCard}>
                    <h3>⚡ Instant & Gasless</h3>
                    <p>Participants can answer without a wallet or gas fees, thanks to Sponsored Transactions.</p>
                </div>
                <div className={styles.featureCard}>
                    <h3>💎 On-Chain Integrity</h3>
                    <p>Survey results are verifiable on the Sui blockchain. Immutable and transparent data.</p>
                </div>
            </div>
        </section>

        {/* How it Works */}
        <section className={styles.section}>
             <h2 className={styles.sectionTitle}>How it works</h2>
             <div className={styles.steps}>
                 <div className={styles.step}>
                     <div className={styles.stepNumber}>1</div>
                     <h3>Create</h3>
                     <p style={{marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>Design your questions using our simple builder.</p>
                 </div>
                 <div className={styles.step}>
                     <div className={styles.stepNumber}>2</div>
                     <h3>Share</h3>
                     <p style={{marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>Send the link. Respondents answer via wallet or generic link.</p>
                 </div>
                 <div className={styles.step}>
                     <div className={styles.stepNumber}>3</div>
                     <h3>Analyze</h3>
                     <p style={{marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>View real-time, aggregated results on your dashboard.</p>
                 </div>
             </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.footerCol}>
                    <h4>Manta</h4>
                    <p style={{fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>Decentralized Survey Infrastructure.</p>
                </div>
                <div className={styles.footerCol}>
                    <h4>Platform</h4>
                    <Link href="/create">Create Survey</Link>
                    <Link href="/dashboard">Dashboard</Link>
                </div>
                <div className={styles.footerCol}>
                    <h4>Community</h4>
                    <Link href="https://sui.io">Sui Network</Link>
                    <Link href="https://walrus.xyz">Walrus Storage</Link>
                    <Link href="https://github.com">GitHub</Link>
                </div>
            </div>
            <div className={styles.copyright}>
                © {new Date().getFullYear()} Manta. Built for Sui Overflow.
            </div>
        </footer>
      </main>
    </>
  );
}
