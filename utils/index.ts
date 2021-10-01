
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram
} from '@solana/web3.js'


import BN from "bn.js"
import { counterProgramAddress } from '~/utils/config'
import { decodeCounter, encodeCounter } from '~/utils/signatures'

type DisplayEncoding = "utf8" | "hex";
type PhantomEvent = "disconnect" | "connect";
type PhantomRequestMethod =
  | "connect"
  | "disconnect"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
  isPhantom: boolean;
}

enum CounterIxOrder {
  Inc = 0,
  Dec = 1,
  UpdateSettings = 2,
}

const counterSeed = "counter"
const settingsSeed = "settings"

let connection: Connection | undefined
let provider: PhantomProvider | undefined



const generateCounterUserInfo = (userAddress: string) => {
  return PublicKey.createWithSeed(
    new PublicKey(userAddress),
    counterSeed,
    new PublicKey(counterProgramAddress)
  )
}

const generateCounterSettings = async () => {
  return (
    await PublicKey.findProgramAddress(
      [Buffer.from(settingsSeed, "utf-8")],
      new PublicKey(counterProgramAddress)
    )
  )[0]
}

export const init = () => {
  connection = new Connection("https://api.testnet.solana.com", "confirmed")
}


export const connect = async () => {
  if (provider) {
    console.error('already connected')
    return false
  }
  if ('solana' in window) {
    const anyWindow: any = window;
    provider = anyWindow.solana as PhantomProvider;
    if (provider.isPhantom) {
      await provider.connect();
      console.log('connect', provider)
      return true
    }
  } else {
    window.open("https://phantom.app/", "_blank");
  }
  return false
}

export const fetchCounterInfo = async () => { // FETCH AT LAYOUT
  if (!connection || !provider!?.publicKey) {
    console.error("not connected")
    return
  }

  const userAddress = provider.publicKey
  const counterUserAddress = await generateCounterUserInfo(userAddress.toBase58())

  const account = await connection.getAccountInfo(counterUserAddress)
  if (!account) {
    console.error("counter account is not found")
    return
  }
  return decodeCounter(account.data)
}

const createCounterUser = async () => {
  if (!connection || !provider!?.publicKey) {
    console.error("not connected")
    return
  }
  const data = encodeCounter({
    counter: 0,
    value:new BN(0)
  })
  const counterUserAddress = await generateCounterUserInfo(provider.publicKey.toBase58())
  const lamports = await connection.getMinimumBalanceForRentExemption(data.length)
  const ix = SystemProgram.createAccountWithSeed({
    fromPubkey: provider.publicKey,
    basePubkey: provider.publicKey,
    seed: counterSeed,
    newAccountPubkey: counterUserAddress,
    space: data.length,
    lamports,
    programId: new PublicKey(counterProgramAddress),
  })
  const tx = new Transaction().add(ix)
  tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  tx.feePayer = provider.publicKey
  const signedTransaction = await provider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());
  console.log('signature: ', signature)
  console.log('wait confirm....')
  await connection.confirmTransaction(signature)
  console.log('done')
}

export const executeMethod = async () => { // EXECUTE BTN IN LAYOUT
  if (!provider || !connection || !provider!?.publicKey) {
    console.error("not connected")
    return
  }
  const counterSettings = await generateCounterSettings()
  const counterUserAddress = await generateCounterUserInfo(provider.publicKey.toBase58())

  const counterUserAccount = await connection.getAccountInfo(counterUserAddress)
  if (!counterUserAccount) {
    console.error("counter account is not found")
    await createCounterUser()
  }

  const ix = new TransactionInstruction({
    programId: new PublicKey(counterProgramAddress),
    keys: [
      {
        pubkey: provider.publicKey,
        isSigner: true,
        isWritable: false,
      },
      { pubkey: counterUserAddress, isSigner: false, isWritable: true },
      { pubkey: counterSettings, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([CounterIxOrder.Dec]),
  })
  const tx = new Transaction().add(ix)
  tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  tx.feePayer = provider.publicKey


  const signedTransaction = await provider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());

  console.log('signature: ', signature)
  console.log('wait confirm....')
  await connection.confirmTransaction(signature)
  console.log('done')
}
