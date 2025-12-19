import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { readFromWalrus } from '@/lib/walrus';
import { PACKAGE_ID, MODULE_NAME } from '@/lib/constants';
import styles from '@/styles/Dashboard.module.css'; // Utilizing Dashboard styles for cards
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';

interface SurveyMetadata {
  title: string;
  description: string;
  questions: any[];
  deadline: string;
}

interface ResponseData {
  respondent: string;
  answers: Record<string, string | string[]>;
  timestamp: string;
}

export default function ViewResults() {
  const router = useRouter();
  const { id } = router.query;
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [metadata, setMetadata] = useState<SurveyMetadata | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeadline, setNewDeadline] = useState<Date | null>(new Date());
  
  useEffect(() => {
    if (id && typeof id === 'string' && account) {
      loadData(id);
    }
  }, [id, account]);

  const loadData = async (surveyId: string) => {
      const toastId = toast.loading('Loading results...');
      setLoading(true);
      try {
          // 1. Fetch Survey On-Chain Object
          const obj = await suiClient.getObject({
              id: surveyId,
              options: { showContent: true }
          });
          
          if (obj.error || !obj.data) throw new Error("Survey not found on-chain");

          const fields = (obj.data.content as any)?.fields;
          const owner = fields?.owner;
          const surveyBlobId = fields?.blob_id;

          if (owner !== account?.address) {
              toast.error("Access Denied: You are not the owner.", { id: toastId });
              router.push('/dashboard');
              return;
          }

          // 2. Fetch Survey Metadata (Questions, Title)
          const surveyData = await readFromWalrus(surveyBlobId);
          setMetadata(surveyData);
          if (surveyData.deadline) {
             setNewDeadline(new Date(surveyData.deadline));
          }

          // 3. Fetch Responses (Events)
          const events = await suiClient.queryEvents({
              query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } },
              order: "descending",
              limit: 50
          });

          const relevantEvents = events.data.filter((e: any) => 
               e.type.includes('::manta::ResponseSubmitted') && e.parsedJson.survey_id === surveyId
          );

          // 4. Fetch Response Content (Answers)
          const fetchedResponses = await Promise.all(relevantEvents.map(async (e: any) => {
              try {
                  const blobId = e.parsedJson.blob_id;
                  const data = await readFromWalrus(blobId);
                  return {
                      respondent: e.parsedJson.respondent,
                      answers: data.answers || {},
                      timestamp: data.timestamp || new Date().toISOString()
                  };
              } catch (err) {
                  return null;
              }
          }));

          setResponses(fetchedResponses.filter(Boolean) as ResponseData[]);
          toast.success("Results loaded", { id: toastId });

      } catch (e: any) {
          console.error(e);
          toast.error("Failed to load: " + e.message, { id: toastId });
      } finally {
          setLoading(false);
      }
  };

  const handleUpdateDeadline = async () => {
    if (!id || typeof id !== 'string' || !newDeadline) return;
    const ms = newDeadline.getTime();
    
    // Construct Tx
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::update_deadline`,
        arguments: [ tx.object(id), tx.pure.u64(ms) ]
    });

    const toastId = toast.loading('Updating deadline...');
    signAndExecute({ transaction: tx }, {
        onSuccess: () => {
             toast.success('Deadline updated!', { id: toastId });
        },
        onError: (e) => {
             toast.error('Failed: ' + e.message, { id: toastId });
        }
    });
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center'}}>Loading data...</div>;
  if (!metadata) return null;

  return (
    <>
      <Head>
        <title>Results | {metadata.title}</title>
      </Head>
      <div className={styles.container}>
         <div className={styles.header}>
             <h1 className={styles.title}>{metadata.title}</h1>
             <Link href="/dashboard" className={styles.backLink}>← Back</Link>
         </div>

         <div style={{
             display: 'grid', 
             gridTemplateColumns: '3fr 1fr', 
             gap: '2rem', 
             maxWidth: 'var(--container-width)', 
             margin: '0 auto'
         }}>
             
             {/* Left Column: Aggregated Results */}
             <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
                 {metadata.questions.map((q, idx) => {
                     // Aggregate Data for this Question
                     const answerCounts: Record<string, number> = {};
                     const textAnswers: string[] = [];

                     responses.forEach(r => {
                         const rawAns = r.answers[q.id];
                         if (!rawAns) return;

                         if (Array.isArray(rawAns)) {
                             rawAns.forEach(a => { answerCounts[a] = (answerCounts[a] || 0) + 1; });
                         } else {
                             if (q.type === 'text') {
                                 textAnswers.push(rawAns);
                             } else {
                                 answerCounts[rawAns] = (answerCounts[rawAns] || 0) + 1;
                             }
                         }
                     });
                     
                     const totalForQ = responses.length; // Approximate divisor

                     return (
                         <div key={q.id} className={styles.card} style={{padding: '2rem'}}>
                             <h3 style={{fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)'}}>
                                 {idx + 1}. {q.text}
                             </h3>

                             {(q.type === 'radio' || q.type === 'checkbox') ? (
                                 <div style={{display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
                                     {q.options.map((opt: string) => {
                                         const count = answerCounts[opt] || 0;
                                         const percent = totalForQ > 0 ? Math.round((count / totalForQ) * 100) : 0;
                                         
                                         return (
                                             <div key={opt}>
                                                 <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 4}}>
                                                     <span>{opt}</span>
                                                     <span style={{fontWeight: 600}}>{count} ({percent}%)</span>
                                                 </div>
                                                 <div style={{height: 8, background: '#f4f4f5', borderRadius: 4, overflow: 'hidden'}}>
                                                     <div style={{
                                                         height: '100%', 
                                                         width: `${percent}%`, 
                                                         background: 'var(--color-primary)', 
                                                         transition: 'width 0.5s ease'
                                                     }} />
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             ) : (
                                 <div style={{background: '#fcfcfc', border: '1px solid #f4f4f5', borderRadius: 8, padding: '1rem', maxHeight: 200, overflowY: 'auto'}}>
                                     {textAnswers.length === 0 && <span style={{color: '#999', fontStyle: 'italic'}}>No text responses yet.</span>}
                                     {textAnswers.map((txt, i) => (
                                         <div key={i} style={{
                                             borderBottom: i < textAnswers.length - 1 ? '1px solid #eee' : 'none', 
                                             paddingBottom: 8, 
                                             marginBottom: 8,
                                             fontSize: '0.95rem'
                                         }}>
                                             "{txt}"
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>

             {/* Right Column: Controls & Stats */}
             <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                 <div className={styles.card}>
                     <h3 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '1rem'}}>Overview</h3>
                     <div style={{marginBottom: '1rem'}}>
                         <div style={{fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)'}}>{responses.length}</div>
                         <div style={{fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>Total Responses</div>
                     </div>
                 </div>

                 <div className={styles.card}>
                     <h3 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '1rem'}}>Manage Survey</h3>
                     <label style={{display: 'block', fontSize: '0.85rem', marginBottom: 6}}>Extend Deadline</label>
                     <div style={{marginBottom: '1rem'}}>
                         <DatePicker 
                             selected={newDeadline} 
                             onChange={(date: Date | null) => setNewDeadline(date)} 
                             showTimeSelect
                             dateFormat="MMMM d, yyyy h:mm aa"
                             className={styles.input} // Reusing custom input style
                         />
                     </div>
                     <button className="btn btn-primary" onClick={handleUpdateDeadline} style={{width: '100%'}}>
                         Update Deadline
                     </button>
                 </div>

                 <div className={styles.card}>
                     <h3 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '1rem'}}>Export Data</h3>
                     <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                            if (!metadata || !responses.length) return toast.error("No data to export");
                            
                            const qHeaders = metadata.questions.map(q => `"${q.text.replace(/"/g, '""')}"`);
                            const headers = ['Respondent', 'Timestamp', ...qHeaders];
                            
                            const rows = responses.map(r => {
                                const answers = metadata.questions.map(q => {
                                    const val = r.answers[q.id];
                                    const str = Array.isArray(val) ? val.join('; ') : (val || '');
                                    return `"${str.replace(/"/g, '""')}"`;
                                });
                                return [r.respondent, r.timestamp, ...answers].join(',');
                            });
                            
                            const csvContent = [headers.join(','), ...rows].join('\n');
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `${metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            toast.success("CSV Downloaded");
                        }} 
                        style={{width: '100%', justifyContent: 'center'}}
                    >
                         Download CSV
                     </button>
                 </div>
             </div>
         </div>
      </div>
    </>
  );
}
