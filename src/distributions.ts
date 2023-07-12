export function sampleNormal(mean = 0, stdev = 1): number {
  // Taken from https://stackoverflow.com/a/36481059
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Transform to the desired mean and standard deviation:
  return z * stdev + mean;
}

export function sampleGamma(a: number): number {
  // Adapted from https://dl.acm.org/doi/pdf/10.1145/358407.358414
  const d = a - 1.0 / 3;
  const c = 1 / Math.sqrt(9 * d);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const x = sampleNormal();
    const v = Math.pow(1 + c * x, 3);
    const U = Math.random();
    if (U < 1 - 0.0331 * Math.pow(x, 4)) return d * v;
    else if (Math.log(U) < 0.5 * Math.pow(x, 2) + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(a: number, b: number): number {
  const X = sampleGamma(a);
  const Y = sampleGamma(b);
  return X / (X + Y);
}
