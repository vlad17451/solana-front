<template>
  <div class='sol'>
    <div v-if='provider && provider.publicKey' class='sol__btns'>
      <div>
        {{counter}}
      </div>
      <div>
        <button @click='executeDec'>
          Dec
        </button>
      </div>
      <div class='sol__btns'>
        <div>
          Value to set
          <input v-model='value' type='text'>
        </div>
        <button @click='executeSetValue'>
          Set value
        </button>
      </div>
    </div>
    <div v-else>
      <button @click='connect'>
        Connect! {{'{'}}{{isConnected}}{{'}'}}
      </button>
    </div>
  </div>
</template>

<script lang="ts">

// https://codesandbox.io/s/github/phantom-labs/sandbox?file=/src/App.tsx

import Vue from 'vue'

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram
} from '@solana/web3.js'


import BN from "bn.js"
import { counterProgramAddress } from '~/utils/config'
import {
  Counter,
  CounterIxOrder,
  counterSeed,
  decodeCounter,
  encodeCounter,
  encodeSetValue,
  settingsSeed
} from '~/utils/signatures'

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


const generateCounterUserInfo = (userAddress: string): Promise<PublicKey> => {
  return PublicKey.createWithSeed(
    new PublicKey(userAddress),
    counterSeed,
    new PublicKey(counterProgramAddress)
  )
}

const generateCounterSettings = async (): Promise<PublicKey> => {
  return (
    await PublicKey.findProgramAddress(
      [Buffer.from(settingsSeed, "utf-8")],
      new PublicKey(counterProgramAddress)
    )
  )[0]
}

const getProvider = async (): Promise<PhantomProvider | undefined> => {
  await new Promise((resolve) => setTimeout(resolve, 100))
  if ("solana" in window) {
    const anyWindow: any = window;
    const provider = anyWindow.solana;
    if (provider.isPhantom) {
      return provider;
    }
  } else {
    alert('Phantom is not installed')
  }
};


export default Vue.extend({
  data: () => ({
    isConnected: false,
    connection: new Connection("https://api.testnet.solana.com", "confirmed"),
    provider: undefined as PhantomProvider | undefined,
    value: 10,
    counter: {} as Counter
  }),
  async mounted() {
    this.provider = await getProvider()
    if (this.provider) {
      this.provider.on("connect", async () => {
        const provider = this.provider as PhantomProvider
        const publicKey = provider.publicKey as PublicKey
        this.isConnected = true
        await this.fetchCounterInfo()
        // callback invoke whenever the specified account changes
        this.connection.onAccountChange(await generateCounterUserInfo(publicKey.toBase58()), (account) => {
          this.counter = decodeCounter(account.data)
        })
      });
      this.provider.on("disconnect", () => {
        this.isConnected = false
      });
      this.provider.connect({ onlyIfTrusted: true });
    }


  },
  methods: {
    async connect() {
      if (!this.provider) {
        console.error("undefined provider")
        return
      }
      try {
        await this.provider.connect();
      } catch (e) {
        console.log(e)
      }
    },
    async createCounterUser() {
      try {
        if (!this.connection || !this.provider!?.publicKey) {
          console.error("not connected")
          return
        }
        const data = encodeCounter({
          counter: 0,
          value: new BN(0)
        })
        const counterUserAddress = await generateCounterUserInfo(this.provider.publicKey.toBase58())
        const lamports = await this.connection.getMinimumBalanceForRentExemption(data.length)
        const ix = SystemProgram.createAccountWithSeed({
          fromPubkey: this.provider.publicKey,
          basePubkey: this.provider.publicKey,
          seed: counterSeed,
          newAccountPubkey: counterUserAddress,
          space: data.length,
          lamports,
          programId: new PublicKey(counterProgramAddress),
        })
        const tx = new Transaction().add(ix)
        tx.recentBlockhash = (await this.connection.getRecentBlockhash()).blockhash;
        tx.feePayer = this.provider.publicKey
        const signedTransaction = await this.provider.signTransaction(tx);
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
        console.log('signature: ', signature)
        console.log('wait confirm....')
        await this.connection.confirmTransaction(signature)
        console.log('done')
      } catch (e) {
        console.log(e)
      }
    },
    async fetchCounterInfo() {
      try {
        if (!this.connection || !this.provider!?.publicKey) {
          console.error("not connected")
          return
        }

        const userAddress = this.provider.publicKey
        const counterUserAddress = await generateCounterUserInfo(userAddress.toBase58())

        const account = await this.connection.getAccountInfo(counterUserAddress)
        if (!account) {
          console.error("counter account is not found")
          return
        }
        this.counter = decodeCounter(account.data)
      } catch (e) {
        console.log(e)
      }
    },
    async executeDec() {
      try {
        if (!this.provider || !this.connection || !this.provider!?.publicKey) {
          console.error("not connected")
          return
        }
        const counterSettings = await generateCounterSettings()
        const counterUserAddress = await generateCounterUserInfo(this.provider.publicKey.toBase58())

        const counterUserAccount = await this.connection.getAccountInfo(counterUserAddress)
        if (!counterUserAccount) {
          console.error("counter account is not found")
          await this.createCounterUser()
        }

        const ix = new TransactionInstruction({
          programId: new PublicKey(counterProgramAddress),
          keys: [
            {
              pubkey: this.provider.publicKey,
              isSigner: true,
              isWritable: false,
            },
            { pubkey: counterUserAddress, isSigner: false, isWritable: true },
            { pubkey: counterSettings, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([CounterIxOrder.Dec]),
        })
        const tx = new Transaction().add(ix)
        tx.recentBlockhash = (await this.connection.getRecentBlockhash()).blockhash;
        tx.feePayer = this.provider.publicKey


        const signedTransaction = await this.provider.signTransaction(tx);
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

        console.log('signature: ', signature)
        console.log('wait confirm....')
        await this.connection.confirmTransaction(signature)
        console.log('done')
      } catch (e) {
        console.log(e)
      }
    },
    async executeSetValue() {
      try {
        if (!this.provider || !this.connection || !this.provider!?.publicKey) {
          console.error("not connected")
          return
        }

        const counterUserAddress = await generateCounterUserInfo(this.provider.publicKey.toBase58())
        const counterUserAccount = await this.connection.getAccountInfo(counterUserAddress)
        if (!counterUserAccount) {
          console.error("counter account is not found")
          await this.createCounterUser()
        }

        const ix = new TransactionInstruction({
          programId: new PublicKey(counterProgramAddress),
          keys: [
            {
              pubkey: this.provider.publicKey,
              isSigner: true,
              isWritable: false,
            },
            { pubkey: counterUserAddress, isSigner: false, isWritable: true }
          ],
          data: encodeSetValue(new BN(this.value)),
        })
        const tx = new Transaction().add(ix)
        tx.recentBlockhash = (await this.connection.getRecentBlockhash()).blockhash;
        tx.feePayer = this.provider.publicKey

        const signedTransaction = await this.provider.signTransaction(tx);
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());

        console.log('signature: ', signature)
        console.log('wait confirm....')
        await this.connection.confirmTransaction(signature)
        console.log('done')
      } catch (e) {
        console.log(e)
      }
    }
  }
})
</script>
<style>
body {
  margin: 0;
}
.sol {
  color: white;
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui;
  font-weight: 600;
  font-size: 18px;
}

.sol__btns {
  display: flex;
  align-items: center;
  flex-direction: column;
  grid-gap: 10px;
}

button {
  height: 50px;
  width: 180px;
  background: #6f66e1;
  border-color: black;
  border-radius: 500px;
  color: inherit;
  font-family: inherit;
  font-weight: inherit;
  font-size: inherit;
}
</style>
