import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { uploadToWalrus } from '@/lib/walrus';
import { PACKAGE_ID, MODULE_NAME } from '@/lib/constants';
import styles from '@/styles/Create.module.css';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';

// Type Definitions
type QuestionType = 'text' | 'radio' | 'checkbox';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  page: number;
}

export default function CreateValidSurvey() {
  const router = useRouter();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activePage, setActivePage] = useState(1);

  // Helper Functions for Questions
  const addQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(),
      text: '',
      type: 'text',
      options: [],
      page: activePage
    };
    setQuestions([...questions, newQ]);
  };

  const addNewPage = () => {
    const newPage = activePage + 1;
    setActivePage(newPage);
    
    // Auto-add a question to the new page
    const newQ: Question = {
      id: crypto.randomUUID(),
      text: '',
      type: 'text',
      options: [],
      page: newPage
    };
    setQuestions(prev => [...prev, newQ]);
    toast.success('New page added', { icon: '📄' });
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const updateOption = (qId: string, idx: number, val: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOpts = [...q.options];
        newOpts[idx] = val;
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const removeOption = (qId: string, idx: number) => {
     setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOpts = q.options.filter((_, i) => i !== idx);
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    toast('Question removed', { icon: '🗑️' });
  };

  // Publishing Logic
  const handlePublish = async () => {
    if (!title || questions.length === 0) return toast.error('Please add a title and at least one question.');
    
    if (!account) return toast.error('Please connect your wallet.');

    // Validate options
    for (const q of questions) {
        if ((q.type === 'radio' || q.type === 'checkbox') && q.options.length < 2) {
            return toast.error(`Question "${q.text || 'Untitled'}" needs at least 2 options.`);
        }
        if (!q.text) return toast.error(`All questions must have text.`);
    }

    const deadlineDate = deadline; // Already a Date object
    if (isNaN(deadlineDate.getTime())) return toast.error('Invalid deadline date.');
    if (deadlineDate <= new Date()) return toast.error('Deadline must be in the future.');

    setIsPublishing(true);
    const toastId = toast.loading('Uploading to Walrus...');

    try {
      const surveyData = {
        title,
        description,
        questions,
        deadline: deadlineDate.toISOString(),
        createdAt: new Date().toISOString(),
        creator: account.address,
      };

      const blobId = await uploadToWalrus(surveyData);
      console.log("Walrus Blob ID:", blobId);
      
      toast.loading('Confirming transaction...', { id: toastId });

      // Build Transaction
      const tx = new Transaction();
      tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::create_survey`,
          arguments: [
              tx.pure.string(title),
              tx.pure.string(description),
              tx.pure.string(blobId),
              tx.pure.u64(deadlineDate.getTime())
          ]
      });

      // Sign and Execute
      signAndExecute({
          transaction: tx,
      }, {
          onSuccess: async (result) => {
              toast.loading('Finalizing on-chain...', { id: toastId });
              try {
                  const fullTx = await suiClient.waitForTransaction({ 
                      digest: result.digest, 
                      options: { showEvents: true, showEffects: true }
                  });
                  finalizeCreation(fullTx, blobId, toastId);
              } catch (e) {
                  console.error("Error waiting for tx:", e);
                  toast.success(`Survey created! (ID unknown)`, { id: toastId });
                  router.push('/dashboard');
              }
          },
          onError: (e) => {
              console.error(e);
              toast.error("Failed to create survey. " + e.message, { id: toastId });
          }
      });

    } catch (e: any) {
      console.error(e);
      toast.error('Failed to publish survey: ' + e.message, { id: toastId });
      setIsPublishing(false);
    }
  };

  const finalizeCreation = (txResp: any, blobId: string, toastId: string) => {
       const event = txResp.events?.find((e: any) => e.type.includes('::manta::SurveyCreated'));
       const parsedEvent = event?.parsedJson as any;
       const surveyId = parsedEvent?.survey_id;

       if (surveyId) {
           toast.success("Survey Published!", { id: toastId });
           router.push(`/survey/success?id=${surveyId}`);
       } else {
           toast.success("Survey Uploaded!", { id: toastId });
           router.push('/dashboard');
       }
       setIsPublishing(false);
  };

  return (
    <>
      <Head>
        <title>Create Survey | Manta</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
          <div style={{ fontWeight: 600 }}>Create New Survey</div>
        </div>

        <div className={styles.formArea}>
          <div className={styles.card}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Survey Title</label>
              <input 
                className={styles.input} 
                placeholder="e.g., Community Governance Proposal #12"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPublishing}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Description</label>
              <textarea 
                className={styles.textarea} 
                placeholder="What is this survey about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPublishing}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Survey closes at</label>
              <div style={{width: '100%'}}>
                  <DatePicker 
                    selected={deadline}
                    onChange={(date: Date | null) => date && setDeadline(date)}
                    showTimeSelect
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className={styles.input}
                    wrapperClassName="datePickerWrapper" 
                  />
              </div>
            </div>
          </div>

          <div className={styles.questionList}>
            {questions.map((q, idx) => {
              const properIdx = idx + 1;
              const isNewPage = idx === 0 || q.page > questions[idx - 1].page;
              
              return (
                <div key={q.id}>
                    {isNewPage && (
                        <div className={styles.pageHeader} style={{
                            margin: '30px 0 15px', 
                            paddingBottom: 10, 
                            borderBottom: '2px solid #eee',
                            color: '#666',
                            fontWeight: 600
                        }}>
                            Page {q.page}
                        </div>
                    )}
                    <div className={styles.questionCard}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                             <div className={styles.label}>Question {properIdx}</div>
                             <button className={styles.removeBtn} onClick={() => removeQuestion(q.id)} disabled={isPublishing}>Remove</button>
                        </div>
                        
                        <div className={styles.inputGroup}>
                        <input 
                            className={styles.input} 
                            placeholder="Enter your question here"
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                            disabled={isPublishing}
                        />
                        </div>
                        
                        <div className={styles.inputGroup}>
                        <label className={styles.label}>Type</label>
                        <select 
                            className={styles.select}
                            value={q.type}
                            onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}
                            disabled={isPublishing}
                        >
                            <option value="text">Free Text</option>
                            <option value="radio">Single Choice (Radio)</option>
                            <option value="checkbox">Multiple Choice (Checkbox)</option>
                        </select>
                        </div>

                        {(q.type === 'radio' || q.type === 'checkbox') && (
                        <div style={{ marginTop: 12 }}>
                            <label className={styles.label} style={{fontSize: '0.9rem', marginBottom: 8, display: 'block'}}>Options</label>
                            {q.options.map((opt, optIdx) => (
                                <div key={optIdx} style={{display: 'flex', gap: 8, marginBottom: 8}}>
                                    <input 
                                        className={styles.input}
                                        placeholder={`Option ${optIdx + 1}`}
                                        value={opt}
                                        onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                                        style={{padding: '6px 10px'}}
                                    />
                                    <button 
                                        onClick={() => removeOption(q.id, optIdx)}
                                        style={{background: 'none', border: 'none', color: 'red', cursor: 'pointer'}}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => addOption(q.id)}
                                style={{fontSize: '0.85rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0}}
                            >
                                + Add Option
                            </button>
                        </div>
                        )}
                    </div>
                </div>
              );
            })}

            <div style={{display: 'flex', gap: 16}}>
                <button className={styles.addBtn} onClick={addQuestion} disabled={isPublishing}>
                + Add Question
                </button>
                <button 
                    className={styles.addBtn} 
                    onClick={addNewPage} 
                    disabled={isPublishing}
                    style={{background: 'white', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)'}}
                >
                + New Page Section
                </button>
            </div>
          </div>

          <button 
            className={`btn btn-primary ${styles.publishBtn}`}
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish Survey'}
          </button>
        </div>
      </div>
    </>
  );
}
