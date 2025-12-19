import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, jwtToAddress, genAddressSeed, computeZkLoginAddress } from '@mysten/zklogin';
import { SuiClient } from '@mysten/sui/client';
import { jwtDecode } from 'jwt-decode';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = 'http://localhost:3000'; 

export const MAX_EPOCH = 2;

export interface ZkLoginSession {
    ephemeralPrivateKey: string;
    maxEpoch: number;
    randomness: string;
    nonce: string;
}

export async function prepareZkLogin(suiClient: SuiClient): Promise<string> {
    if (!GOOGLE_CLIENT_ID) throw new Error("Missing Google Client ID");

    const ephemeralKeypair = new Ed25519Keypair();
    const ephemeralPublicKey = ephemeralKeypair.getPublicKey();
    
    const { epoch } = await suiClient.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + MAX_EPOCH; 

    const randomness = generateRandomness();
    const nonce = generateNonce(ephemeralPublicKey, maxEpoch, randomness);

    const session: ZkLoginSession = {
        ephemeralPrivateKey: ephemeralKeypair.getSecretKey(),
        maxEpoch,
        randomness,
        nonce
    };
    localStorage.setItem('zk_session', JSON.stringify(session));

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: REDIRECT_URI,
        scope: 'openid email profile',
        nonce: nonce, 
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function completeZkLogin(idToken: string) {
    const sessionStr = localStorage.getItem('zk_session');
    if (!sessionStr) throw new Error("No zkLogin session found.");
    const session: ZkLoginSession = JSON.parse(sessionStr);

    const decoded: any = jwtDecode(idToken);
    if (!decoded.sub || !decoded.aud) throw new Error("Invalid JWT");

    let userSalt = localStorage.getItem(`zk_salt_${decoded.sub}`);
    if (!userSalt) {
        userSalt = generateRandomness();
        localStorage.setItem(`zk_salt_${decoded.sub}`, userSalt);
    }

    const zkAddress = jwtToAddress(idToken, userSalt);

    return {
        zkAddress,
        ephemeralPrivateKey: session.ephemeralPrivateKey,
        maxEpoch: session.maxEpoch,
        randomness: session.randomness,
        userSalt,
        jwt: idToken
    };
}

export async function createZkProof(jwt: string, ephemeralPublicKey: string, maxEpoch: number, jwtRandomness: string, userSalt: string) {
    const proverUrl = "https://prover-dev.mystenlabs.com/v1"; 

    const response = await fetch(proverUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
           jwt,
           extendedEphemeralPublicKey: ephemeralPublicKey,
           maxEpoch,
           jwtRandomness,
           salt: userSalt,
           keyClaimName: "sub"
        })
    });

    if (!response.ok) {
        throw new Error(`Prover failed: ${response.statusText}`);
    }

    return response.json().then(res => {
        console.log("Full Prover Response:", res);
        
        const issDetails = res.iss_base64_details || res.issBase64Details || {};
        
        let addressSeed = res.address_seed || res.addressSeed;
        if (!addressSeed) {
            console.log("Computing addressSeed manually...");
            const decoded: any = jwtDecode(jwt);
            console.log("JWT Claims:", { sub: decoded.sub, aud: decoded.aud, salt: userSalt });
            
            const audience = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;

            addressSeed = genAddressSeed(BigInt(userSalt), "sub", decoded.sub, audience).toString();
            console.log("Computed Seed:", addressSeed);
            
            // Verification: Compute address from params
            const derivedAddr = computeZkLoginAddress({
                claimName: "sub",
                claimValue: decoded.sub,
                iss: decoded.iss,
                aud: audience,
                userSalt: BigInt(userSalt)
            });
            console.log("Derived Address (Verification):", derivedAddr);
        }

        return {
            proofPoints: res.proof_points || res.proofPoints,
            issBase64Details: {
                value: issDetails.value,
                indexMod4: issDetails.index_mod_4 || issDetails.indexMod4
            },
            headerBase64: res.header_base64 || res.headerBase64,
            addressSeed: addressSeed
        };
    });
}
