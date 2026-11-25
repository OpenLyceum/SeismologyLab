/** Convert the generator's base64 little-endian Int16 samples to display amplitudes. */
export function decodeSamples(base64: string): Float32Array {
  const binary = atob(base64);
  if (binary.length % 2 !== 0) {
    throw new Error("Incomplete Int16 waveform");
  }
  return Float32Array.from({ length: binary.length / 2 }, (_, index) => {
    const low = binary.charCodeAt(2 * index);
    const high = binary.charCodeAt(2 * index + 1);
    const signed = (((high << 8) | low) << 16) >> 16;
    return Math.max(-1, signed / 32767);
  });
}
