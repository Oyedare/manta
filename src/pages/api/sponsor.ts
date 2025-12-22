import type { NextApiRequest, NextApiResponse } from 'next';
import { EnokiClient } from '@mysten/enoki';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const ENOKI_API_KEY = process.env.ENOKI_PRIVATE_KEY;
  if (!ENOKI_API_KEY) {
      console.error("Missing ENOKI_PRIVATE_KEY");
      return res.status(500).json({ message: 'Server misconfiguration: Missing Enoki Key' });
  }

  console.log("BACKEND RECVD BODY:", JSON.stringify(req.body));
  
  const { 
      network, 
      transactionBlockKindBytes, 
      sender,
      digest,
      signature
  } = req.body;

  // --- EXECUTE PHASE ---
  // If we have digest and signature, we are asking Enoki to finalize/execute
  if (digest && signature) {
      console.log("EXECUTE PHASE: Digest", digest);
      try {
          // Verify request to Enoki to get Sponsor Signature
          const enokiResponse = await fetch(`https://api.enoki.mystenlabs.com/v1/transaction-blocks/sponsor/${digest}`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${ENOKI_API_KEY}`
              },
              body: JSON.stringify({ signature })
          });

          if (!enokiResponse.ok) {
              const errText = await enokiResponse.text();
              console.error("Enoki Execute Error:", errText);
              throw new Error(`Enoki Execution Failed: ${errText}`);
          }

          const data = await enokiResponse.json();
          console.log("Enoki Execute Response:", data);
          
          return res.status(200).json(data);

      } catch (error: any) {
          console.error("Execute Failed:", error);
          return res.status(500).json({ message: error.message });
      }
  }

  // --- CREATE PHASE ---
  // If we have transaction bytes, we are asking Enoki to sponsor (add gas)
  if (transactionBlockKindBytes && sender) {
      try {
        const enoki = new EnokiClient({ apiKey: ENOKI_API_KEY });
        
        // Note: Enoki SDK expects 'transactionKindBytes' property, but we sent 'transactionBlockKindBytes'
        // We map it here.
        const sponsored = await enoki.createSponsoredTransaction({
            network: network || 'testnet',
            transactionKindBytes: transactionBlockKindBytes,
            sender: sender,
            allowedAddresses: [sender], 
            allowedMoveCallTargets: [`${process.env.NEXT_PUBLIC_PACKAGE_ID}::manta::submit_response`]
        });
        console.log("Enoki Create Response:", sponsored);
        return res.status(200).json(sponsored);
      } catch (error: any) {
         console.error("Enoki Create Failed:", error);
         // Detailed Logging
         if (error.response) {
            console.error('Enoki API Error Detail:', JSON.stringify(error.response.data));
         }
         return res.status(500).json({ message: error.message || 'Sponsorship creation failed' });
      }
  }

  return res.status(400).json({ message: 'Invalid request: Missing parameters for either Create or Execute phase.' });
}
