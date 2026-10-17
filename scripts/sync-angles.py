#!/usr/bin/env python3
"""Find the time offset between two camera angles by cross-correlating their audio.

    python3 scripts/sync-angles.py media/angle-a.mp4 media/angle-b.mp4

Prints JSON: {"offsetSeconds": L, "confidence": C}
Meaning: angle B time = angle A time + L. Feed L to plan.media.angleOffsetSeconds.b.
Confidence is the correlation peak over the median correlation. Under 8 is weak: check by ear.
Needs ffmpeg and numpy.
"""
import json
import subprocess
import sys

import numpy as np

RATE = 8000
MAX_LAG_SECONDS = 20
ANALYZE_SECONDS = 90


def load(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-t", str(ANALYZE_SECONDS), "-vn", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if x.size < RATE:
        raise SystemExit(f"{path}: under 1 second of audio")
    x = x - x.mean()
    # high-pass feel: emphasize speech transients so room tone does not dominate
    x = np.diff(x, prepend=x[0])
    return x / (np.abs(x).max() + 1e-9)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    a, b = load(sys.argv[1]), load(sys.argv[2])
    n = 1 << int(np.ceil(np.log2(a.size + b.size)))
    fa, fb = np.fft.rfft(a, n), np.fft.rfft(b, n)
    corr = np.fft.irfft(np.conj(fa) * fb, n)  # corr[L] = sum a[t] * b[t + L]
    max_lag = MAX_LAG_SECONDS * RATE
    lags = np.concatenate([np.arange(0, max_lag + 1), np.arange(-max_lag, 0)])
    vals = np.concatenate([corr[0 : max_lag + 1], corr[n - max_lag : n]])
    k = int(np.argmax(vals))
    peak = vals[k]
    conf = float(peak / (np.median(np.abs(vals)) + 1e-12))
    print(json.dumps({"offsetSeconds": round(float(lags[k]) / RATE, 3), "confidence": round(conf, 1)}))


if __name__ == "__main__":
    main()
