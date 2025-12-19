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
  const jsonString = JSON.stringify(data);
  // Using /v1/blobs as per user's successful example in another project
  const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=1`, {
    method: "PUT",
    body: jsonString,
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

  return await response.json();
}
