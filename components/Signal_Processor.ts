import FFT from "fft.js";

interface SensorReading {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface ProcessedSignals {
  time: {
    body: { x: number[]; y: number[]; z: number[]; magnitude: number[] };
    gravity: { x: number[]; y: number[]; z: number[]; magnitude: number[] };
    bodyJerk: { x: number[]; y: number[]; z: number[]; magnitude: number[] };
  };
  frequency: {
    body: {
      x: Float32Array;
      y: Float32Array;
      z: Float32Array;
      magnitude: number[];
    };
    bodyJerk: {
      x: Float32Array;
      y: Float32Array;
      z: Float32Array;
      magnitude: number[];
    };
  };
}

class SignalProcessor {
  private readonly samplingRate = 50; // 50 Hz
  private readonly windowSize = 128; // 2.56 seconds
  private readonly overlap = 64; // 50% overlap

  // Reusable Median Filter Implementation
  private medianFilter(data: number[], windowSize: number = 3): number[] {
    const filtered = [];
    for (let i = 0; i < data.length; i++) {
      const window = [];
      for (
        let j = Math.max(0, i - Math.floor(windowSize / 2));
        j < Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
        j++
      ) {
        window.push(data[j]);
      }
      window.sort((a, b) => a - b);
      filtered.push(window[Math.floor(window.length / 2)]);
    }
    return filtered;
  }

  // Reusable Butterworth Filter Implementation
  private butterworthFilter(
    data: number[],
    cutoffFreq: number,
    order: number = 3
  ): number[] {
    const wc = Math.tan((Math.PI * cutoffFreq) / this.samplingRate);
    const k1 = Math.sqrt(2) * wc;
    const k2 = wc * wc;
    const a = 1 + k1 + k2;

    const b0 = k2 / a;
    const b1 = 2 * b0;
    const b2 = b0;
    const a1 = (2 * (k2 - 1)) / a;
    const a2 = (1 - k1 + k2) / a;

    const filtered = new Array(data.length).fill(0);
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;

    for (let i = 0; i < data.length; i++) {
      const x0 = data[i];
      filtered[i] = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = filtered[i];
    }

    return filtered;
  }

  // Common Signal Processing Method
  private processAxis(
    data: number[],
    timestamps: number[],
    cutoffFreq: number
  ): {
    bodyComponent: number[];
    gravityComponent: number[];
    jerk: number[];
    frequencyDomain: Float32Array;
  } {
    const medianFiltered = this.medianFilter(data);
    const noiseFiltered = this.butterworthFilter(medianFiltered, cutoffFreq);
    const gravityComponent = this.butterworthFilter(noiseFiltered, 0.3);
    const bodyComponent = noiseFiltered.map(
      (val, i) => val - gravityComponent[i]
    );

    const jerk = this.calculateJerk(bodyComponent, timestamps);
    const frequencyDomain = this.fft(bodyComponent);

    return { bodyComponent, gravityComponent, jerk, frequencyDomain };
  }

  // Calculate Jerk Signals
  private calculateJerk(data: number[], timestamps: number[]): number[] {
    const jerk = new Array(data.length - 1);
    for (let i = 1; i < data.length; i++) {
      const dt = (timestamps[i] - timestamps[i - 1]) / 1000; // Convert to seconds
      jerk[i - 1] = (data[i] - data[i - 1]) / dt;
    }
    return jerk;
  }

  // Calculate Magnitude
  private calculateMagnitude(x: number[], y: number[], z: number[]): number[] {
    return x.map((_, i) => Math.sqrt(x[i] ** 2 + y[i] ** 2 + z[i] ** 2));
  }

  // FFT Transform
  private fft(data: number[]): Float32Array {
    const fftSize = Math.pow(2, Math.ceil(Math.log2(data.length)));
    const fftInstance = new FFT(fftSize);
    const padded = [...data, ...new Array(fftSize - data.length).fill(0)];
    const out = fftInstance.createComplexArray();
    const input = fftInstance.createComplexArray();

    padded.forEach((val, i) => {
      input[2 * i] = val;
      input[2 * i + 1] = 0;
    });

    fftInstance.transform(out, input);
    return new Float32Array(out);
  }

  // Main Processing Function
  public processSensorData(
    readings: SensorReading[],
    cutoffFreq: number = 20
  ): ProcessedSignals {
    // Implement windowing with overlap
    const windows: SensorReading[][] = [];
    for (
      let i = 0;
      i < readings.length - this.windowSize;
      i += this.windowSize / 2
    ) {
      windows.push(readings.slice(i, i + this.windowSize));
    }

    // Extract timestamps and axis data
    const timestamps = readings.map((r) => r.timestamp);
    const xData = readings.map((r) => r.x);
    const yData = readings.map((r) => r.y);
    const zData = readings.map((r) => r.z);

    // Process each axis
    const xProcessed = this.processAxis(xData, timestamps, cutoffFreq);
    const yProcessed = this.processAxis(yData, timestamps, cutoffFreq);
    const zProcessed = this.processAxis(zData, timestamps, cutoffFreq);

    // Calculate magnitudes for time domain signals
    const bodyMag = this.calculateMagnitude(
      xProcessed.bodyComponent,
      yProcessed.bodyComponent,
      zProcessed.bodyComponent
    );
    const gravityMag = this.calculateMagnitude(
      xProcessed.gravityComponent,
      yProcessed.gravityComponent,
      zProcessed.gravityComponent
    );
    const bodyJerkMag = this.calculateMagnitude(
      xProcessed.jerk,
      yProcessed.jerk,
      zProcessed.jerk
    );

    // Calculate magnitudes for frequency domain signals
    const bodyFreqMag = this.calculateMagnitude(
      Array.from(xProcessed.frequencyDomain),
      Array.from(yProcessed.frequencyDomain),
      Array.from(zProcessed.frequencyDomain)
    );

    return {
      time: {
        body: {
          x: xProcessed.bodyComponent,
          y: yProcessed.bodyComponent,
          z: zProcessed.bodyComponent,
          magnitude: bodyMag,
        },
        gravity: {
          x: xProcessed.gravityComponent,
          y: yProcessed.gravityComponent,
          z: zProcessed.gravityComponent,
          magnitude: gravityMag,
        },
        bodyJerk: {
          x: xProcessed.jerk,
          y: yProcessed.jerk,
          z: zProcessed.jerk,
          magnitude: bodyJerkMag,
        },
      },
      frequency: {
        body: {
          x: xProcessed.frequencyDomain,
          y: yProcessed.frequencyDomain,
          z: zProcessed.frequencyDomain,
          magnitude: bodyFreqMag,
        },
        bodyJerk: {
          x: xProcessed.frequencyDomain,
          y: yProcessed.frequencyDomain,
          z: zProcessed.frequencyDomain,
          magnitude: bodyFreqMag,
        },
      },
    };
  }
}
export default SignalProcessor;
