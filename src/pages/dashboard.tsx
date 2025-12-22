import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSuiClient, useCurrentAccount, useResolveSuiNSName } from '@mysten/dapp-kit';
import { PACKAGE_ID, MODULE_NAME } from '@/lib/constants';
import styles from '@/styles/Dashboard.module.css';
import toast from 'react-hot-toast';

interface SurveySummary {
  id: string;
  title: string;
  responseCount: number;
  owner?: string;
  isActive: boolean;
  deadline: number;
}

export default function Dashboard() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const { data: suiNsName } = useResolveSuiNSName(account?.address);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (account) {
      fetchSurveys();
    } else {
      setLoading(false);
    }
  }, [account]);

  const fetchSurveys = async () => {
    if (!account) return;
    try {
      setLoading(true);
      // Fetch 'SurveyCreated' events
      const events = await suiClient.queryEvents({
          query: {
              MoveModule: {
                  package: PACKAGE_ID,
                  module: MODULE_NAME
              }
          },
          order: "descending",
          limit: 50
      });

      // Extract unique IDs properly
      const seenIds = new Set();
      const items = [];
      
      for (const e of events.data) {
          const parsed: any = e.parsedJson;
          if (e.type.includes('::manta::SurveyCreated') && !seenIds.has(parsed.survey_id)) {
              seenIds.add(parsed.survey_id);
              items.push({
                  id: parsed.survey_id,
                  _temp_owner: parsed.creator || e.sender // Event might not have creator field depending on contract version, fallback to sender
              });
          }
      }

      const hydrated = await Promise.all(items.map(async (item) => {
          try {
              const obj = await suiClient.getObject({
                  id: item.id,
                  options: { showContent: true }
              });
              const fields = (obj.data?.content as any)?.fields;
              const deadline = Number(fields?.deadline_ms || 0);
              return {
                  id: item.id,
                  title: fields?.title || "Untitled Survey",
                  responseCount: Number(fields?.response_count || 0),
                  owner: fields?.owner, // Use on-chain owner
                  isActive: Date.now() < deadline,
                  deadline
              };
          } catch {
              return null;
          }
      }));

      const finalSurveys = hydrated.filter(Boolean) as SurveySummary[];
      setSurveys(finalSurveys);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  const mySurveys = surveys.filter(s => account && s.owner === account.address);

  const copyLink = (id: string) => {
      const url = `${window.location.origin}/survey/${id}`;
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
  };

  return (
    <>
      <Head>
        <title>Dashboard | Manta</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
            <div>
                <h1 className={styles.title} style={{marginBottom: 8}}>
                  Welcome, {suiNsName || (account?.address ? `${account.address.slice(0,6)}...${account.address.slice(-4)}` : 'Guest')}
                </h1>
                <p style={{color: 'var(--color-text-muted)'}}>Manage your active surveys and analyzing results.</p>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                 <Link href="/" className={styles.backLink}>Home</Link>
            </div>
        </div>

        {!account ? (
             <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: 'var(--radius-lg)' }}>
                 <h2>Connect your wallet to view your dashboard</h2>
             </div>
        ) : (
             <div className={styles.grid}>
                 {/* Create New Card (Always First) */}
                 <Link href="/create" className={styles.card} style={{
                     border: '2px dashed var(--color-border)', 
                     alignItems: 'center', 
                     justifyContent: 'center',
                     background: 'transparent',
                     boxShadow: 'none',
                     cursor: 'pointer',
                     minHeight: '250px'
                 }}>
                     <div style={{
                         width: 50, height: 50, 
                         background: 'var(--color-primary)', 
                         borderRadius: '50%', 
                         color: 'white', 
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         fontSize: '1.5rem', marginBottom: '1rem'
                     }}>+</div>
                     <span style={{fontWeight: 600, color: 'var(--color-primary)'}}>Create New Survey</span>
                 </Link>

                 {loading ? (
                      <div className={styles.card} style={{alignItems: 'center', justifyContent: 'center'}}>Loading...</div>
                 ) : mySurveys.map(s => (
                     <div key={s.id} className={styles.card} style={{position: 'relative'}}>
                         <div style={{
                             position: 'absolute', top: 16, right: 16, 
                             fontSize: '0.75rem', fontWeight: 600, 
                             color: s.isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
                             background: s.isActive ? '#ecfdf5' : '#f4f4f5',
                             padding: '2px 8px', borderRadius: 10
                         }}>
                             {s.isActive ? 'Active' : 'Closed'}
                         </div>
                         
                         <h3 className={styles.cardTitle} style={{marginTop: 10}}>{s.title}</h3>
                         
                         <div className={styles.stat} style={{marginTop: 0, marginBottom: 'auto'}}>
                             {s.responseCount} Responses
                         </div>

                         <div className={styles.actions} style={{flexDirection: 'column', alignItems: 'stretch', gap: 8}}>
                              <Link href={`/results/${s.id}`} className="btn btn-primary" style={{
                                  fontSize: '0.9rem', justifyContent: 'center', width: '100%', height: 'auto', padding: '0.5rem'
                              }}>
                                  View Results
                              </Link>
                              
                              <div style={{display: 'flex', gap: 8}}>
                                  <Link href={`/survey/${s.id}`} className="btn btn-secondary" style={{
                                    flex: 1, fontSize: '0.85rem', justifyContent: 'center', padding: '0.5rem'
                                  }}>
                                    Preview
                                  </Link>
                                  <button onClick={() => copyLink(s.id)} className={styles.copyBtn} style={{flex: 1, justifyContent: 'center'}}>
                                     Copy
                                  </button>
                              </div>
                         </div>
                     </div>
                 ))}
             </div>
        )}
      </div>
    </>
  );
}
