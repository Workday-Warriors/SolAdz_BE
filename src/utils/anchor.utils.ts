import { AnchorProvider, BN, Idl, Program, utils } from "@coral-xyz/anchor";
import * as seed from '../server_signer.json';
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as IDL from '../idl/soladz.json';

const secretKey = Uint8Array.from(seed);
const keypair = Keypair.fromSecretKey(secretKey);
const signer = new NodeWallet(keypair);
const connection = new Connection(clusterApiUrl('devnet'));
const provider = new AnchorProvider(connection, signer);
const program = new Program(IDL as Idl, provider);

export const getReward = async (address: string) => {
    try {
        const investorAccount = PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode("investor"),
                new PublicKey(address).toBuffer()
            ],
            program.programId
        )[0];
        const reward = await program.methods.rewardView().accounts({
            investorAccount
        }).view();
        return Number(reward) / LAMPORTS_PER_SOL;
    } catch (e) {
        return 0;
    }
}

export const getLastClaim = async (address: string) => {
    try {
        const investor = PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode("investor"),
                new PublicKey(address).toBuffer()
            ],
            program.programId
        )[0];
        // @ts-ignore
        const investorAccount = await program.account.investor.fetch(investor);
        return Number(investorAccount.lastUpdateCommission);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}

export const createClaimCommissionTxn = async (address: string, amount: number) => {
    const investor = new PublicKey(address);
    const ixn = await program.methods.claimDirectCommision(new BN(amount * LAMPORTS_PER_SOL))
        .accounts({
            investor
        })
        .signers([signer.payer]).instruction();
    const instructions = [ixn];
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
        payerKey: investor,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);
    transaction.sign([signer.payer]);
    const serialzed = Buffer.from(transaction.serialize()).toString('base64');
    return serialzed;
}

export const processTopSponsorPool = async (address: string, amount: number) => {
    const ixn = await program.methods.runDistribution().accounts({
        receiver: new PublicKey(address)
    }).signers([signer.payer]).instruction();
    const instructions = [ixn];
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
        payerKey: signer.publicKey,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);
    const signed = await signer.signTransaction(transaction);
    await connection.sendTransaction(signed);
}

export const getTopSponsorPoolAmount = async () => {
    const appStats = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("app-stats")
        ],
        program.programId
    )[0];
    // @ts-ignore
    const statsAccount = await program.account.appStats.fetch(appStats);
    return Number(statsAccount.topSponserPool) / LAMPORTS_PER_SOL;
}