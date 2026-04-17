import 'react-native-get-random-values'
import * as ExpoCrypto from 'expo-crypto'

const g = globalThis as typeof globalThis & { crypto?: Crypto & { subtle?: SubtleCrypto } }

if (!g.crypto) {
  g.crypto = {} as Crypto & { subtle?: SubtleCrypto }
}

if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = function <T extends ArrayBufferView | null>(array: T): T {
    if (array == null) return array
    const bytes = ExpoCrypto.getRandomBytes((array as unknown as Uint8Array).byteLength)
    ;(array as unknown as Uint8Array).set(bytes)
    return array
  }
}

if (!g.crypto.subtle) {
  const subtleShim = {
    async digest(
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const algo =
        typeof algorithm === 'string' ? algorithm : (algorithm as Algorithm).name
      const normalized = algo.replace('-', '').toUpperCase()
      if (normalized !== 'SHA256') {
        throw new Error(`crypto.subtle.digest: unsupported algorithm ${algo}`)
      }
      const uint8 =
        data instanceof Uint8Array
          ? data
          : new Uint8Array(
              data instanceof ArrayBuffer ? data : data.buffer,
            )
      const hex = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...Array.from(uint8)),
        { encoding: ExpoCrypto.CryptoEncoding.HEX },
      )
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      }
      return bytes.buffer
    },
  } as SubtleCrypto

  try {
    Object.defineProperty(g.crypto, 'subtle', {
      value: subtleShim,
      writable: true,
      configurable: true,
    })
  } catch {
    (g.crypto as any).subtle = subtleShim
  }
}
