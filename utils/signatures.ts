// @ts-ignore
import lo from "buffer-layout"
import BN from "bn.js"

export interface Counter {
  counter: number
  value: BN
}


export enum CounterIxOrder {
  Inc = 0,
  Dec = 1,
  UpdateSettings = 2,
  SetValue = 3
}

export const counterSeed = "counter"
export const settingsSeed = "settings"

export const counterSchema = lo.struct([lo.u32("counter"), lo.ns64("value")])

export function encodeCounter(counter: Counter): Buffer {
  const b = Buffer.alloc(4 + 8)
  counterSchema.encode(counter, b)
  return b
}

export function encodeSetValue(
  value: BN,
): Buffer {
  const schema = lo.struct([ lo.ns64("value")])
  const b = Buffer.alloc(8)
  schema.encode({ value }, b)
  return Buffer.from([CounterIxOrder.SetValue, ...b])
}

export function decodeCounter(data: Buffer): Counter {
  return counterSchema.decode(data)
}
