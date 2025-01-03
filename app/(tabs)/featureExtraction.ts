type ProcessedSignals = {
  [key: string]: {
    [axis: string]: number[];
  };
};

class FeatureExtractor {
  private calculateTimeFeatures(data: number[]): { [key: string]: number } {
    const features: { [key: string]: number } = {};
    const n = data.length;

    // Basic statistics
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const sortedData = [...data].sort((a, b) => a - b);
    const median = sortedData[Math.floor(n / 2)];
    const energy = data.reduce((a, b) => a + b * b, 0) / n;

    // Features
    features["mean()"] = mean;
    features["std()"] = std;
    features["mad()"] =
      data.map((x) => Math.abs(x - median)).reduce((a, b) => a + b, 0) / n;
    features["max()"] = Math.max(...data);
    features["min()"] = Math.min(...data);
    features["energy()"] = energy;

    // Interquartile Range (IQR)
    const q1 = sortedData[Math.floor(n * 0.25)];
    const q3 = sortedData[Math.floor(n * 0.75)];
    features["iqr()"] = q3 - q1;

    // Entropy
    const bins = new Array(10).fill(0);
    const minVal = features["min()"];
    const range = features["max()"] - minVal;
    data.forEach((val) => {
      const binIdx = Math.min(Math.floor(((val - minVal) / range) * 10), 9);
      bins[binIdx]++;
    });
    features["entropy()"] = -bins
      .map((count) => {
        const p = count / n;
        return p === 0 ? 0 : p * Math.log2(p);
      })
      .reduce((a, b) => a + b, 0);

    // AR Coefficients (Burg method)
    const arCoeffs = this.calculateARCoefficients(data);
    arCoeffs.forEach((coeff, i) => {
      features[`arCoeff()${i + 1}`] = coeff;
    });

    return features;
  }

  private calculateFrequencyFeatures(fftData: number[]): {
    [key: string]: number;
  } {
    const features: { [key: string]: number } = {};
    const n = fftData.length;

    // Basic statistics
    const mean = fftData.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(fftData.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const sortedData = [...fftData].sort((a, b) => a - b);
    const median = sortedData[Math.floor(n / 2)];
    const energy = fftData.reduce((a, b) => a + b * b, 0) / n;

    // Features
    features["mean()"] = mean;
    features["std()"] = std;
    features["mad()"] =
      fftData.map((x) => Math.abs(x - median)).reduce((a, b) => a + b, 0) / n;
    features["max()"] = Math.max(...fftData);
    features["min()"] = Math.min(...fftData);
    features["energy()"] = energy;

    // Interquartile Range (IQR)
    const q1 = sortedData[Math.floor(n * 0.25)];
    const q3 = sortedData[Math.floor(n * 0.75)];
    features["iqr()"] = q3 - q1;

    // Entropy
    const bins = new Array(10).fill(0);
    const minVal = features["min()"];
    const range = features["max()"] - minVal;
    fftData.forEach((val) => {
      const binIdx = Math.min(Math.floor(((val - minVal) / range) * 10), 9);
      bins[binIdx]++;
    });
    features["entropy()"] = -bins
      .map((count) => {
        const p = count / n;
        return p === 0 ? 0 : p * Math.log2(p);
      })
      .reduce((a, b) => a + b, 0);

    const magnitudes = new Array(fftData.length / 2);

    // Calculate magnitude spectrum
    for (let i = 0; i < fftData.length / 2; i++) {
      magnitudes[i] = Math.sqrt(fftData[2 * i] ** 2 + fftData[2 * i + 1] ** 2);
    }

    // Mean Frequency (weighted average)
    let weightedSum = 0;
    let totalMagnitude = 0;
    magnitudes.forEach((mag, i) => {
      weightedSum += mag * i;
      totalMagnitude += mag;
    });
    features["meanFreq()"] = weightedSum / totalMagnitude;

    // Max Frequency Index
    features["maxInds"] = magnitudes.indexOf(Math.max(...magnitudes));

    // Skewness
    const magmean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const magstd = Math.sqrt(
      magnitudes.reduce((a, b) => a + (b - magmean) ** 2, 0) / magnitudes.length
    );
    features["skewness()"] =
      magnitudes.reduce((a, b) => a + ((b - magmean) / magstd) ** 3, 0) /
      magnitudes.length;

    // Kurtosis
    features["kurtosis()"] =
      magnitudes.reduce((a, b) => a + ((b - magmean) / magstd) ** 4, 0) /
        magnitudes.length -
      3;

    return features;
  }

  private calculateARCoefficients(data: number[], order: number = 4): number[] {
    const N = data.length;
    const ar = new Array(order).fill(0);
    const f = [...data];
    const b = [...data];

    for (let m = 0; m < order; m++) {
      let num = 0;
      let den = 0;
      for (let n = m + 1; n < N; n++) {
        num += f[n] * b[n - 1];
        den += f[n] ** 2 + b[n - 1] ** 2;
      }
      const k = (-2 * num) / den;
      ar[m] = k;

      for (let n = m + 1; n < N; n++) {
        const temp = f[n];
        f[n] += k * b[n - 1];
        b[n - 1] = b[n - 1] + k * temp;
      }
    }

    return ar;
  }

  // Correlation between two signals
  public calculateCorrelation(signal1: number[], signal2: number[]): number {
    const mean1 = signal1.reduce((a, b) => a + b, 0) / signal1.length;
    const mean2 = signal2.reduce((a, b) => a + b, 0) / signal2.length;
    const numerator = signal1.reduce(
      (sum, x, i) => sum + (x - mean1) * (signal2[i] - mean2),
      0
    );
    const denominator = Math.sqrt(
      signal1.reduce((sum, x) => sum + (x - mean1) ** 2, 0) *
        signal2.reduce((sum, x) => sum + (x - mean2) ** 2, 0)
    );
    return numerator / denominator;
  }

  private calculateBandsEnergy(
    magnitudes: number[],
    numBands: number
  ): { [key: string]: number } {
    const features: { [key: string]: number } = {};
    const bandSize = Math.floor(magnitudes.length / numBands);

    // Compute energies for predefined bands
    const bands = [
      { start: 0, end: 8 },
      { start: 8, end: 16 },
      { start: 16, end: 24 },
      { start: 24, end: 32 },
      { start: 32, end: 40 },
      { start: 40, end: 48 },
      { start: 48, end: 56 },
      { start: 56, end: 64 },
      { start: 0, end: 16 },
      { start: 16, end: 32 },
      { start: 32, end: 48 },
      { start: 48, end: 64 },
      { start: 0, end: 24 },
      { start: 24, end: 48 },
    ];

    // Calculate energy for each band
    bands.forEach((band, index) => {
      const start = band.start * bandSize;
      const end = band.end * bandSize;
      const energy =
        magnitudes.slice(start, end).reduce((sum, mag) => sum + mag ** 2, 0) /
        (end - start);
      features[`bandsEnergy()-${band.start + 1},${band.end}`] = energy;
    });

    return features;
  }

  public extractFeatures(processedSignals: ProcessedSignals): {
    [key: string]: number;
  } {
    const features: { [key: string]: number } = {};

    // Time domain features
    [
      "tBodyAcc",
      "tGravityAcc",
      "tBodyAccJerk",
      "tBodyGyro",
      "tBodyGyroJerk",
    ].forEach((signalType) => {
      let sma = 0; // Initialize SMA for the signal type

      ["x", "y", "z"].forEach((axis) => {
        if (processedSignals[signalType][axis]) {
          const axisData = processedSignals[signalType][axis];

          // Calculate SMA contribution for the current axis
          sma += axisData.reduce(
            (sum: number, val: number) => sum + Math.abs(val),
            0
          );

          // Calculate and add time-domain features for the axis
          const timeFeatures = this.calculateTimeFeatures(axisData);
          Object.entries(timeFeatures).forEach(([feature, value]) => {
            features[`${signalType}-${feature}-${axis}`] = value;
          });
        }
      });

      // Finalize and add SMA feature
      const n = processedSignals[signalType]["x"].length; // Use length of 'x' as representative
      features[`${signalType}-sma()`] = sma / n;

      // Add correlation features for each pair of axes
      features[`${signalType}-correlation()-x,y`] = this.calculateCorrelation(
        processedSignals[signalType]["x"],
        processedSignals[signalType]["y"]
      );
      features[`${signalType}-correlation()-x,z`] = this.calculateCorrelation(
        processedSignals[signalType]["x"],
        processedSignals[signalType]["z"]
      );
      features[`${signalType}-correlation()-y,z`] = this.calculateCorrelation(
        processedSignals[signalType]["y"],
        processedSignals[signalType]["z"]
      );
    });

    [
      "tBodyAccMag",
      "tGravityAccMag",
      "tBodyAccJerkMag",
      "tBodyGyroMag",
      "tBodyGyroJerkMag",
    ].forEach((signalType) => {
      let sma = 0; // Initialize SMA for the signal type

      if (processedSignals[signalType]["mag"]) {
        const axisData = processedSignals[signalType]["mag"];

        // Calculate SMA contribution for the current axis
        sma += axisData.reduce(
          (sum: number, val: number) => sum + Math.abs(val),
          0
        );

        // Calculate and add time-domain features for the axis
        const timeFeatures = this.calculateTimeFeatures(axisData);
        Object.entries(timeFeatures).forEach(([feature, value]) => {
          features[`${signalType}-${feature}`] = value;
        });
      }

      // Finalize and add SMA feature
      const n = processedSignals[signalType]["mag"].length; 
      features[`${signalType}-sma()`] = sma / n;
    });

    // Frequency domain features
    ["fBodyAcc", "fBodyAccJerk", "fBodyGyro"].forEach((signalType) => {
      let sma = 0;
      ["x", "y", "z"].forEach((axis) => {
        if (processedSignals[signalType][axis]) {
          // Calculate SMA contribution for the current axis
          sma += processedSignals[signalType][axis].reduce(
            (sum: number, val: number) => sum + Math.abs(val),
            0
          );
          const freqFeatures = this.calculateFrequencyFeatures(
            processedSignals[signalType][axis]
          );
          Object.entries(freqFeatures).forEach(([feature, value]) => {
            features[`${signalType}-${feature}-${axis}`] = value;
          });

          // Finalize and add SMA feature
          const n = processedSignals[signalType]["x"].length; // Use length of 'x' as representative
          features[`${signalType}-sma()`] = sma / n;

          const magnitudes = new Array(
            processedSignals[signalType][axis].length / 2
          );

          // Calculate magnitude spectrum
          for (
            let i = 0;
            i < processedSignals[signalType][axis].length / 2;
            i++
          ) {
            magnitudes[i] = Math.sqrt(
              processedSignals[signalType][axis][2 * i] ** 2 +
                processedSignals[signalType][axis][2 * i + 1] ** 2
            );
          }
          // Add band energy features
          const bandFeatures = this.calculateBandsEnergy(magnitudes, 64);
          Object.entries(bandFeatures).forEach(([feature, value]) => {
            features[`${signalType}-${feature}-${axis}`] = value;
          });
        }
      });
    });

    [
        "fBodyAccMag",
        "fBodyBodyAccJerkMag",
        "fBodyBodyGyroMag",
        "fBodyBodyGyroJerkMag",
      ].forEach((signalType) => {
        let sma = 0; // Initialize SMA for the signal type
  
        if (processedSignals[signalType]["mag"]) {
          const axisData = processedSignals[signalType]["mag"];
  
          // Calculate SMA contribution for the current axis
          sma += axisData.reduce(
            (sum: number, val: number) => sum + Math.abs(val),
            0
          );
  
          // Calculate and add freq-domain features for the axis
          const timeFeatures = this.calculateFrequencyFeatures(axisData);
          Object.entries(timeFeatures).forEach(([feature, value]) => {
            features[`${signalType}-${feature}`] = value;
          });
        }
  
        // Finalize and add SMA feature
        const n = processedSignals[signalType]["mag"].length; // Use length of 'x' as representative
        features[`${signalType}-sma()`] = sma / n;
      });

    return features;
  }
  // Method to calculate the angles
  private calculateAngle(vector1: number[], vector2: number[]): number {
    const dotProduct = vector1.reduce(
      (sum, val, i) => sum + val * vector2[i],
      0
    );
    const magnitude1 = Math.sqrt(
      vector1.reduce((sum, val) => sum + val ** 2, 0)
    );
    const magnitude2 = Math.sqrt(
      vector2.reduce((sum, val) => sum + val ** 2, 0)
    );
    return Math.acos(dotProduct / (magnitude1 * magnitude2));
  }

  // Method to extract angle features
  public extractAngleFeatures(processedSignals: ProcessedSignals): {
    [key: string]: number;
  } {
    const features: { [key: string]: number } = {};

    // Extract relevant vectors
    const gravity = [
      processedSignals["tGravityAcc"]["x"][0],
      processedSignals["tGravityAcc"]["y"][0],
      processedSignals["tGravityAcc"]["z"][0],
    ];
    const gravityMean = [
      processedSignals["tGravityAcc"]["x"].reduce(
        (a: any, b: any) => a + b,
        0
      ) / processedSignals["tGravityAcc"]["x"].length,
      processedSignals["tGravityAcc"]["y"].reduce(
        (a: any, b: any) => a + b,
        0
      ) / processedSignals["tGravityAcc"]["y"].length,
      processedSignals["tGravityAcc"]["z"].reduce(
        (a: any, b: any) => a + b,
        0
      ) / processedSignals["tGravityAcc"]["y"].length,
    ];

    const tBodyAccMean = [
      processedSignals["tBodyAcc"]["x"].reduce((a: any, b: any) => a + b, 0) /
        processedSignals["tBodyAcc"]["x"].length,
      processedSignals["tBodyAcc"]["y"].reduce((a: any, b: any) => a + b, 0) /
        processedSignals["tBodyAcc"]["y"].length,
      processedSignals["tBodyAcc"]["z"].reduce((a: any, b: any) => a + b, 0) /
        processedSignals["tBodyAcc"]["z"].length,
    ];

    const tBodyAccJerkMean = [
        processedSignals["tBodyAccJerk"]["x"].reduce((a, b) => a + b, 0) / processedSignals["tBodyAccJerk"]["x"].length,
        processedSignals["tBodyAccJerk"]["y"].reduce((a, b) => a + b, 0) / processedSignals["tBodyAccJerk"]["y"].length,
        processedSignals["tBodyAccJerk"]["z"].reduce((a, b) => a + b, 0) / processedSignals["tBodyAccJerk"]["z"].length,
      ];
    

      const tBodyGyroMean = [
        processedSignals["tBodyGyro"]["x"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyro"]["x"].length,
        processedSignals["tBodyGyro"]["y"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyro"]["y"].length,
        processedSignals["tBodyGyro"]["z"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyro"]["z"].length,
      ];

    const tBodyGyroJerkMean = [
        processedSignals["tBodyGyroJerk"]["x"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyroJerk"]["x"].length,
        processedSignals["tBodyGyroJerk"]["y"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyroJerk"]["y"].length,
        processedSignals["tBodyGyroJerk"]["z"].reduce((a, b) => a + b, 0) / processedSignals["tBodyGyroJerk"]["z"].length,
      ];
    

    // Calculate angles
    features["angle(tBodyAccMean,gravity)"] = this.calculateAngle(
      tBodyAccMean,
      gravity
    );
    features["angle(tBodyAccJerkMean,gravityMean)"] = this.calculateAngle(
      tBodyAccJerkMean,
      gravityMean
    );
    features["angle(tBodyGyroMean,gravityMean)"] = this.calculateAngle(
      tBodyGyroMean,
      gravityMean
    );
    features["angle(tBodyGyroJerkMean,gravityMean)"] = this.calculateAngle(
      tBodyGyroJerkMean,
      gravityMean
    );
    features["angle(x,gravityMean)"] = this.calculateAngle(
      [1, 0, 0],
      gravityMean
    );
    features["angle(y,gravityMean)"] = this.calculateAngle(
      [0, 1, 0],
      gravityMean
    );
    features["angle(z,gravityMean)"] = this.calculateAngle(
      [0, 0, 1],
      gravityMean
    );

    return features;
  }
}
export default FeatureExtractor;
