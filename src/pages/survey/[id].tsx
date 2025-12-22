import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { readFromWalrus, uploadToWalrus } from '@/lib/walrus';
import { PACKAGE_ID, MODULE_NAME } from '@/lib/constants';
import styles from '@/styles/Survey.module.css';
import toast from 'react-hot-toast';

interface SurveyData {
  title: string;
  description: string;
  questions: any[];
  creator: string;
}

export default function TakeSurvey() {
  const router = useRouter();
  const { id } = router.query;
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isClosed, setIsClosed] = useState(false);
  const [deadline, setDeadline] = useState<number>(0);

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchSurvey(id);
    }
  }, [id]);

  const fetchSurvey = async (objectId: string) => {
    try {
      setLoading(true);
      // 1. Fetch Object from Sui
      const obj = await suiClient.getObject({
        id: objectId,
        options: { showContent: true },
      });

      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields as any;
        const blobId = fields.blob_id;
        const deadlineMs = Number(fields.deadline_ms);
        
        setDeadline(deadlineMs);
        if (Date.now() > deadlineMs) {
            setIsClosed(true);
        }
        
        // 2. Fetch Metadata from Walrus
        console.log("Fetching metadata from Walrus...", blobId);
        const data = await readFromWalrus(blobId);
        setSurveyData(data);
      } else {
        setStatus('Survey not found on chain.');
      }
    } catch (e) {
      console.error(e);
      setStatus('Failed to load survey.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
      setAnswers(prev => {
          const current = (prev[questionId] as string[]) || [];
          if (checked) {
              return { ...prev, [questionId]: [...current, option] };
          } else {
              return { ...prev, [questionId]: current.filter(item => item !== option) };
          }
      });
  };

  const handleSubmit = async () => {
    if (!id || typeof id !== 'string') return;

    setSubmitting(true);
    const toastId = toast.loading('Submitting response...');

    try {
      // 1. Determine sender
      let senderAddr = account ? account.address : "Gasless_User"; 

      // 2. Upload Answers to Walrus
      const responsePayload = {
        surveyId: id,
        respondent: senderAddr, 
        answers,
        timestamp: new Date().toISOString()
      };
      
      const responseBlobId = await uploadToWalrus(responsePayload);
      console.log("Response Blob ID:", responseBlobId);
      
      toast.loading('Confirming transaction...', { id: toastId });

      const tx = new Transaction();
      tx.moveCall({
         target: `${PACKAGE_ID}::${MODULE_NAME}::submit_response`,
         arguments: [
             tx.object(id),
             tx.pure.string(responseBlobId),
             tx.object('0x6') // SUI Clock Object
         ]
      });

      if (account) {
          // --- STANDARD WALLET FLOW ---
          signAndExecute({
              transaction: tx,
          }, {
              onSuccess: () => {
                  toast.success("Response Submitted!", { id: toastId });
                  router.push('/');
              },
              onError: (e) => {
                  console.error(e);
                  toast.error("Submission failed.", { id: toastId });
              }
          });
      } else {
          // --- GASLESS FLOW (Ephemeral + Sponsor) ---
          console.log("No wallet connected. Initiating Anon Gasless Transaction...");
          
          const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
          const ephemeralKeypair = new Ed25519Keypair();
          const ephemeralAddr = ephemeralKeypair.getPublicKey().toSuiAddress();
          console.log("Ephemeral Address:", ephemeralAddr);

          // tx.setSender(ephemeralAddr); // Removed to avoid conflict

          const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
          const txBase64 = Buffer.from(txBytes).toString('base64');

          // Step 1: Request Sponsorship
          const sponsorRes = await fetch('/api/sponsor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  network: 'testnet',
                  transactionBlockKindBytes: txBase64,
                  sender: ephemeralAddr
              })
          });

          if (!sponsorRes.ok) {
              const errData = await sponsorRes.json().catch(() => ({}));
              throw new Error("Sponsorship request failed: " + (errData.message || sponsorRes.statusText));
          }
          
          const sponsorData = await sponsorRes.json();
          const sponsoredBytes = Uint8Array.from(Buffer.from(sponsorData.bytes, 'base64'));

          // Step 2: Sign with Ephemeral Key
          const { signature: ephemeralSignature } = await ephemeralKeypair.signTransaction(sponsoredBytes);

          // Step 3: Execute via Backend
          toast.loading('Submitting to Enoki...', { id: toastId });
          const executeRes = await fetch('/api/sponsor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  digest: sponsorData.digest,
                  signature: ephemeralSignature
              })
          });

          const executeData = await executeRes.json();
          
          if (!executeRes.ok) throw new Error("Enoki Execution Failed: " + (executeData.message || 'Unknown error'));

          // Enoki returns { data: { digest: "..." } } on success
          if (executeData.effects?.status.status === 'success' || executeData.digest || executeData.data?.digest) {
              toast.success("Response Submitted (Gasless)!", { id: toastId });
              router.push('/');
          } else {
              throw new Error("Gasless execution status unknown. Response: " + JSON.stringify(executeData));
          }
      }

    } catch (e: any) {
      console.error(e);
      toast.error("Error submitting response: " + e.message, { id: toastId });
    } finally {
      if (!account) setSubmitting(false); // Only unset if not handled by hook callback
    }
  };

  if (loading) return <div className={styles.container}>Loading Survey...</div>;
  if (!surveyData) return <div className={styles.container}>{status || "Survey not found"}</div>;

  const totalPages = surveyData.questions.reduce((max, q) => Math.max(max, q.page || 1), 1);
  const currentQuestions = surveyData.questions.filter((q: any) => (q.page || 1) === currentPage);
  const progress = (currentPage / totalPages) * 100;

  return (
    <>
      <Head>
        <title>{surveyData.title}</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
            <Link href="/" className={styles.backLink}>← Back</Link>
            <div style={{color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>Page {currentPage} of {totalPages}</div>
        </div>
        
        <div className={styles.surveyParams}>
             <h1 className={styles.title}>{surveyData.title}</h1>
             <p className={styles.description}>{surveyData.description}</p>
             {isClosed && (
                <div style={{
                    padding: '1.5rem', 
                    background: '#fff5f5', 
                    border: '1px solid #fed7d7', 
                    borderRadius: 'var(--radius-md)', 
                    color: '#c53030', 
                    marginTop: '1.5rem',
                    fontWeight: 600,
                    textAlign: 'center'
                }}>
                    ⛔ This survey has closed and is no longer accepting responses.
                </div>
             )}
        </div>

        <div className={styles.formArea}>
            <div style={{height: 4, background: '#eee', marginBottom: '2rem', borderRadius: 2}}>
                <div style={{height: '100%', width: `${progress}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 0.3s'}}></div>
            </div>

            {currentQuestions.map((q: any, idx: number) => (
                <div key={q.id} className={styles.questionCard} style={{opacity: isClosed ? 0.6 : 1, pointerEvents: isClosed ? 'none' : 'auto'}}>
                    <label className={styles.label}>{q.text}</label>
                    
                    {q.type === 'text' && (
                        <input 
                            className={styles.input}
                            value={(answers[q.id] as string) || ''}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            placeholder="Type your answer..."
                            disabled={isClosed}
                        />
                    )}

                    {q.type === 'radio' && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                            {q.options?.map((opt: string, i: number) => (
                                <label key={i} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                                    <input 
                                        type="radio"
                                        name={q.id}
                                        value={opt}
                                        checked={(answers[q.id] as string) === opt}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className={styles.optionInput}
                                        disabled={isClosed}
                                    />
                                    <span style={{color: 'var(--color-text-main)', fontSize: '1.05rem'}}>{opt}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {q.type === 'checkbox' && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                            {q.options?.map((opt: string, i: number) => (
                                <label key={i} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                                    <input 
                                        type="checkbox"
                                        value={opt}
                                        checked={((answers[q.id] as string[]) || []).includes(opt)}
                                        onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                                        className={styles.optionInput}
                                        disabled={isClosed}
                                    />
                                    <span style={{color: 'var(--color-text-main)', fontSize: '1.05rem'}}>{opt}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            <div className={styles.controls}>
                <button 
                    className="btn btn-secondary" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    style={{visibility: currentPage === 1 ? 'hidden' : 'visible'}}
                >
                    Previous
                </button>

                {currentPage < totalPages ? (
                     <button 
                        className="btn btn-primary" 
                        onClick={() => setCurrentPage(p => p + 1)}
                    >
                        Next
                    </button>
                ) : (
                    <button 
                        className={styles.submitBtn}
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        {submitting ? 'Submitting...' : 'Submit Response'}
                    </button>
                )}
            </div>
        </div>
      </div>
    </>
  );
}
