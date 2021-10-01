// @ts-ignore
import lo from "buffer-layout"
import BN from "bn.js"

interface Counter {
  counter: number
  value: BN
}

export const counterSchema = lo.struct([lo.u32("counter"), lo.ns64("value")])

export function encodeCounter(counter: Counter): Buffer {
  const b = Buffer.alloc(4 + 8)
  counterSchema.encode(counter, b)
  return b
}

export function decodeCounter(data: Buffer): Counter {
  return counterSchema.decode(data)
}
