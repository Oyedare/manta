import { ConnectButton } from '@mysten/dapp-kit';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Home.module.css';

export default function Home() {
  return (
    <>
      <Head>
        <title>Manta | Decentralized Surveys</title>
        <meta name="description" content="Privacy-first survey platform on Sui" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logo}>Manta 魟</div>
        <div className={styles.headerRight}>
             <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
             <ConnectButton />
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
