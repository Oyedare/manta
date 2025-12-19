import type { NextApiRequest, NextApiResponse } from 'next';

const PUBLISHER_URL = "https://wal-publisher-testnet.staketab.org";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    // Forward the request to Walrus
    // Note: Walrus expects the body to be the raw data (or JSON string).
    // Since we are sending JSON from client, req.body might be an object if parsed,
    // or string if not.
    
    // We'll trust the client sends the data structure they want stored.
    // If it's an object, we JSON.stringify it.
    const bodyToSend = typeof data === 'string' ? data : JSON.stringify(data);

    const walrusResponse = await fetch(`${PUBLISHER_URL}/v1/store?epochs=1`, {
      method: "PUT",
      body: bodyToSend,
    });

    if (!walrusResponse.ok) {
        const errorText = await walrusResponse.text();
        console.error("Walrus Error:", errorText);
        return res.status(walrusResponse.status).json({ message: errorText });
    }

    const result = await walrusResponse.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
