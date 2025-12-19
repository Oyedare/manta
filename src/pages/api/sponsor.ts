import type { NextApiRequest, NextApiResponse } from 'next';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';

// Initialize Sponsor
const SPONSOR_SECRET_KEY = process.env.SPONSOR_SECRET_KEY;
const NETWORK = 'testnet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!SPONSOR_SECRET_KEY) {
    return res.status(500).json({ message: 'Sponsor key not configured' });
  }

  try {
    const { sender, bytes } = req.body;

    if (!sender || !bytes) {
      return res.status(400).json({ message: 'Missing sender or transaction bytes' });
    }

    // 1. Setup Sponsor
    let keypair: Ed25519Keypair;
    try {
        if (SPONSOR_SECRET_KEY.startsWith('suiprivkey')) {
            const { secretKey } = decodeSuiPrivateKey(SPONSOR_SECRET_KEY);
            keypair = Ed25519Keypair.fromSecretKey(secretKey);
        } else {
            // Fallback for hex/base64 generic secrets if used
            keypair = Ed25519Keypair.fromSecretKey(SPONSOR_SECRET_KEY);
        }
    } catch (e) {
        throw new Error("Invalid Sponsor Key format. Ensure it starts with 'suiprivkey' or is valid.");
    }
    
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    const sponsorAddress = keypair.getPublicKey().toSuiAddress();

    // 2. Reconstruct Transaction
    // 'bytes' from client are TransactionKind (because onlyTransactionKind: true)
    let tx: Transaction;
    try {
        tx = Transaction.fromKind(Buffer.from(bytes, 'base64'));
    } catch (e) {
        // Fallback or retry if fromKind doesn't exist (it should in recent SDK)
        // If fromKind is missing, we might need to construct via add() which is harder.
        // Let's assume fromKind exists.
        console.log("Transaction.fromKind failed, trying Transaction.from");
        tx = Transaction.from(Buffer.from(bytes, 'base64'));
    }
    
    // 3. Configure Gas (Sponsored)
    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);
    
    // Fetch gas payment objects for sponsor
    // Note: In production we'd manage coins carefully. For MVP we fetch dynamically.
    const coins = await client.getCoins({ owner: sponsorAddress, limit: 5 });
    if (coins.data.length === 0) {
        throw new Error("Sponsor wallet empty");
    }
    
    const paymentCoins = coins.data.map(c => ({
        objectId: c.coinObjectId,
        version: c.version,
        digest: c.digest
    }));
    
    tx.setGasPayment(paymentCoins);
    tx.setGasBudget(50000000); // 0.05 SUI Budget

    // 4. Build & Sign by Sponsor
    const buildBytes = await tx.build({ client, onlyTransactionKind: false });
    const { signature: sponsorSignature } = await keypair.signTransaction(buildBytes);

    // 5. Return details for User to sign
    res.status(200).json({
        sponsoredBytes: Buffer.from(buildBytes).toString('base64'),
        sponsorSignature,
        sponsorAddress
    });

  } catch (error: any) {
    console.error('SERVER SIDE ERROR in /api/sponsor:', error);
    res.status(500).json({ message: error.message || 'Sponsorship processing failed', stack: error.stack });
  }
}
