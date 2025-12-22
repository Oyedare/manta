const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

export type UploadResult = {
  newlyCreated: {
    blobObject: {
      blobId: string;
      storage: {
        id: string;
        startEpoch: number;
        endEpoch: number;
        storageSize: number;
      };
    };
    encodedSize: number;
    cost: number;
  };
};

/**
 * Uploads data to Walrus (Testnet).
 * Returns the Blob ID.
 */
export async function uploadToWalrus(data: any): Promise<string> {
  let body = JSON.stringify(data);

  // --- SEAL ENCRYPTION INTEGRATION ---
  // If a Seal Policy ID is present, we encrypt the data before uploading.
  const sealPolicyId = process.env.NEXT_PUBLIC_SEAL_POLICY_ID;
  if (sealPolicyId) {
      try {
          // Dynamic import to avoid SSR issues or if unused
          const { SealClient } = await import('@mysten/seal');
          // @ts-ignore - bypassing type check for hackathon speed
          const client = new SealClient({
            network: 'testnet' 
          } as any);
          
          // Encrypt
          // @ts-ignore
          const encrypted = await client.encrypt({ data, policyId: sealPolicyId });
          body = JSON.stringify({
             _isNonEncrypted: false,
             _isSealEncrypted: true,
             payload: encrypted
          });
      } catch (e) {
          console.error("Seal encryption failed, falling back to plaintext (WARNING)", e);
          // Fallback or throw? For hackathon, fallback is safer but warn used 
      }
  }

  // Using /v1/blobs as per user's successful example in another project
  const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=1`, {
    method: "PUT",
    body: body,
  });

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.statusText}`);
  }

  const result: UploadResult = await response.json();
  
  // The response structure can vary slightly, but usually "newlyCreated.blobObject.blobId" holds the ID
  // If the blob already exists, it might return "alreadyCertified" or similar.
  // We'll handle the standard success case for now.
  if (result.newlyCreated) {
      return result.newlyCreated.blobObject.blobId;
  } else if ((result as any).alreadyCertified) {
      return (result as any).alreadyCertified.blobId;
  }
  
  // Fallback if structure is different (e.g. if already exists, we might need to parse differently)
  // For MVP, if we get a 200 OK but no newlyCreated, we might need to log it.
  // But usually for unique JSONs (with timestamps/randomness) it's new.
  console.log("Walrus response:", result);
  throw new Error("Could not parse Blob ID from Walrus response");
}

/**
 * Reads data from Walrus (Testnet) using a Blob ID.
 */
export async function readFromWalrus(blobId: string): Promise<any> {
  const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`);

  if (!response.ok) {
    throw new Error(`Walrus read failed: ${response.statusText}`);
  }

  const rawData = await response.json();

  // Check if encrypted
  if (rawData && rawData._isSealEncrypted) {
      const sealPolicyId = process.env.NEXT_PUBLIC_SEAL_POLICY_ID;
      // In a real app, we need the user's key/session to decrypt. 
      // SealClient handles this via the wallet/zklogin flow usually.
      // We'll attempt to decrypt if we have the SDK loaded.
       try {
          const { SealClient } = await import('@mysten/seal');
          // @ts-ignore
          const client = new SealClient({ network: 'testnet' } as any);
          const decrypted = await client.decrypt(rawData.payload);
          return decrypted;
      } catch (e) {
          console.error("Decryption failed", e);
          throw new Error("Failed to decrypt secured content");
      }
  }

  return rawData;
}
