import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactConfetti from 'react-confetti';
import toast from 'react-hot-toast';
import styles from '@/styles/Home.module.css'; // Reusing Home styles for consistency or maybe create a new one?
// Let's use inline styles tailored to the minimalist aesthetic to ensure it looks perfect without a new module file yet.

export default function SurveySuccess() {
  const router = useRouter();
  const { id } = router.query;
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [surveyLink, setSurveyLink] = useState('');

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    if (id) {
        setSurveyLink(`${window.location.origin}/survey/${id}`);
    }
  }, [id]);

  const copyToClipboard = () => {
      navigator.clipboard.writeText(surveyLink);
      toast.success('Link copied to clipboard!');
  };

  if (!id) return null; // Should probably redirect if no ID

  return (
    <>
      <Head>
        <title>Survey Published! | Manta</title>
      </Head>
      <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />
      
      <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--color-bg)',
          textAlign: 'center'
      }}>
          <div style={{
              background: 'white',
              padding: '3rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: '600px',
              width: '100%',
              animation: 'fadeInUp 0.6s ease-out'
          }}>
              <div style={{fontSize: '4rem', marginBottom: '1rem'}}>🎉</div>
              <h1 style={{
                  fontSize: '2.5rem', 
                  fontWeight: 700, 
                  color: 'var(--color-text-main)',
                  marginBottom: '1rem'
              }}>Survey Published!</h1>
              
              <p style={{
                  fontSize: '1.1rem', 
                  color: 'var(--color-text-muted)',
                  marginBottom: '3rem',
                  lineHeight: 1.6
              }}>
                  Your survey is now live on the Sui blockchain. <br/>
                  Share the link below to verify humanity.
              </p>

              <div style={{
                  display: 'flex', 
                  gap: '1rem', 
                  marginBottom: '2rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-primary-subtle)',
                  borderRadius: 'var(--radius-md)',
                  alignItems: 'center'
              }}>
                  <input 
                    readOnly 
                    value={surveyLink} 
                    style={{
                        background: 'transparent',
                        border: 'none',
                        width: '100%',
                        fontSize: '1rem',
                        color: 'var(--color-text-main)',
                        fontFamily: 'monospace'
                    }}
                  />
                  <button 
                    onClick={copyToClipboard}
                    style={{
                        background: 'white',
                        border: '1px solid var(--color-border)',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                  >
                      Copy
                  </button>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  <Link href="/dashboard" className="btn btn-primary" style={{width: '100%', justifyContent: 'center'}}>
                      Go to Dashboard
                  </Link>
                  <Link href={`/survey/${id}`} className="btn btn-secondary" style={{width: '100%', justifyContent: 'center'}}>
                      Preview Survey
                  </Link>
              </div>
          </div>
      </div>
    </>
  );
}
