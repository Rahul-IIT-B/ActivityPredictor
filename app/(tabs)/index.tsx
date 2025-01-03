import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Accelerometer, Gyroscope } from "expo-sensors";
import SignalProcessor from "../../components/Signal_Processor";
import FeatureExtractor from "../../components/featureExtraction";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface FeatureRow {
  [key: string]: number;
}

const normalizeFeatures = (featureRows: FeatureRow[]): FeatureRow[] => {
  const normalizedRows = [...featureRows];
  const featureKeys = Object.keys(featureRows[0]);

  const minMax = featureKeys.reduce((acc, key) => {
    const values = featureRows.map((row) => row[key]);
    acc[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
    return acc;
  }, {} as { [key: string]: { min: number; max: number } });

  return normalizedRows.map((row) => {
    const normalizedRow = { ...row };
    featureKeys.forEach((key) => {
      const { min, max } = minMax[key];
      if (max === min) {
        normalizedRow[key] = 0;
      } else {
        normalizedRow[key] = -1 + (2 * (row[key] - min)) / (max - min);
      }
      normalizedRow[key] = Number(normalizedRow[key]);
    });
    return normalizedRow;
  });
};

export default function App() {
  // State declarations
  const [accData, setAccData] = useState<SensorData[]>([]);
  const [gyroData, setGyroData] = useState<SensorData[]>([]);
  const [featureTable, setFeatureTable] = useState<FeatureRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataCollectionProgress, setDataCollectionProgress] = useState(0);

  // Constants
  const windowSize = 128;
  const slideSize = 64;
  const targetFeatureSets = 25;
  const samplingRate = 50; // Hz
  const requiredSamples = windowSize + slideSize * (targetFeatureSets - 1);

  // Class instances
  const signalProcessor = new SignalProcessor();
  const featureExtractor = new FeatureExtractor();

  // Feature list (complete list of 561 features in correct order)
  const feature_list = [
    "tBodyAcc-mean()-x",
    "tBodyAcc-mean()-y",
    "tBodyAcc-mean()-z",
    "tBodyAcc-std()-x",
    "tBodyAcc-std()-y",
    "tBodyAcc-std()-z",
    "tBodyAcc-mad()-x",
    "tBodyAcc-mad()-y",
    "tBodyAcc-mad()-z",
    "tBodyAcc-max()-x",
    "tBodyAcc-max()-y",
    "tBodyAcc-max()-z",
    "tBodyAcc-min()-x",
    "tBodyAcc-min()-y",
    "tBodyAcc-min()-z",
    "tBodyAcc-sma()",
    "tBodyAcc-energy()-x",
    "tBodyAcc-energy()-y",
    "tBodyAcc-energy()-z",
    "tBodyAcc-iqr()-x",
    "tBodyAcc-iqr()-y",
    "tBodyAcc-iqr()-z",
    "tBodyAcc-entropy()-x",
    "tBodyAcc-entropy()-y",
    "tBodyAcc-entropy()-z",
    "tBodyAcc-arCoeff()1-x",
    "tBodyAcc-arCoeff()2-x",
    "tBodyAcc-arCoeff()3-x",
    "tBodyAcc-arCoeff()4-x",
    "tBodyAcc-arCoeff()1-y",
    "tBodyAcc-arCoeff()2-y",
    "tBodyAcc-arCoeff()3-y",
    "tBodyAcc-arCoeff()4-y",
    "tBodyAcc-arCoeff()1-z",
    "tBodyAcc-arCoeff()2-z",
    "tBodyAcc-arCoeff()3-z",
    "tBodyAcc-arCoeff()4-z",
    "tBodyAcc-correlation()-x,y",
    "tBodyAcc-correlation()-x,z",
    "tBodyAcc-correlation()-y,z",
    "tGravityAcc-mean()-x",
    "tGravityAcc-mean()-y",
    "tGravityAcc-mean()-z",
    "tGravityAcc-std()-x",
    "tGravityAcc-std()-y",
    "tGravityAcc-std()-z",
    "tGravityAcc-mad()-x",
    "tGravityAcc-mad()-y",
    "tGravityAcc-mad()-z",
    "tGravityAcc-max()-x",
    "tGravityAcc-max()-y",
    "tGravityAcc-max()-z",
    "tGravityAcc-min()-x",
    "tGravityAcc-min()-y",
    "tGravityAcc-min()-z",
    "tGravityAcc-sma()",
    "tGravityAcc-energy()-x",
    "tGravityAcc-energy()-y",
    "tGravityAcc-energy()-z",
    "tGravityAcc-iqr()-x",
    "tGravityAcc-iqr()-y",
    "tGravityAcc-iqr()-z",
    "tGravityAcc-entropy()-x",
    "tGravityAcc-entropy()-y",
    "tGravityAcc-entropy()-z",
    "tGravityAcc-arCoeff()1-x",
    "tGravityAcc-arCoeff()2-x",
    "tGravityAcc-arCoeff()3-x",
    "tGravityAcc-arCoeff()4-x",
    "tGravityAcc-arCoeff()1-y",
    "tGravityAcc-arCoeff()2-y",
    "tGravityAcc-arCoeff()3-y",
    "tGravityAcc-arCoeff()4-y",
    "tGravityAcc-arCoeff()1-z",
    "tGravityAcc-arCoeff()2-z",
    "tGravityAcc-arCoeff()3-z",
    "tGravityAcc-arCoeff()4-z",
    "tGravityAcc-correlation()-x,y",
    "tGravityAcc-correlation()-x,z",
    "tGravityAcc-correlation()-y,z",
    "tBodyAccJerk-mean()-x",
    "tBodyAccJerk-mean()-y",
    "tBodyAccJerk-mean()-z",
    "tBodyAccJerk-std()-x",
    "tBodyAccJerk-std()-y",
    "tBodyAccJerk-std()-z",
    "tBodyAccJerk-mad()-x",
    "tBodyAccJerk-mad()-y",
    "tBodyAccJerk-mad()-z",
    "tBodyAccJerk-max()-x",
    "tBodyAccJerk-max()-y",
    "tBodyAccJerk-max()-z",
    "tBodyAccJerk-min()-x",
    "tBodyAccJerk-min()-y",
    "tBodyAccJerk-min()-z",
    "tBodyAccJerk-sma()",
    "tBodyAccJerk-energy()-x",
    "tBodyAccJerk-energy()-y",
    "tBodyAccJerk-energy()-z",
    "tBodyAccJerk-iqr()-x",
    "tBodyAccJerk-iqr()-y",
    "tBodyAccJerk-iqr()-z",
    "tBodyAccJerk-entropy()-x",
    "tBodyAccJerk-entropy()-y",
    "tBodyAccJerk-entropy()-z",
    "tBodyAccJerk-arCoeff()1-x",
    "tBodyAccJerk-arCoeff()2-x",
    "tBodyAccJerk-arCoeff()3-x",
    "tBodyAccJerk-arCoeff()4-x",
    "tBodyAccJerk-arCoeff()1-y",
    "tBodyAccJerk-arCoeff()2-y",
    "tBodyAccJerk-arCoeff()3-y",
    "tBodyAccJerk-arCoeff()4-y",
    "tBodyAccJerk-arCoeff()1-z",
    "tBodyAccJerk-arCoeff()2-z",
    "tBodyAccJerk-arCoeff()3-z",
    "tBodyAccJerk-arCoeff()4-z",
    "tBodyAccJerk-correlation()-x,y",
    "tBodyAccJerk-correlation()-x,z",
    "tBodyAccJerk-correlation()-y,z",
    "tBodyGyro-mean()-x",
    "tBodyGyro-mean()-y",
    "tBodyGyro-mean()-z",
    "tBodyGyro-std()-x",
    "tBodyGyro-std()-y",
    "tBodyGyro-std()-z",
    "tBodyGyro-mad()-x",
    "tBodyGyro-mad()-y",
    "tBodyGyro-mad()-z",
    "tBodyGyro-max()-x",
    "tBodyGyro-max()-y",
    "tBodyGyro-max()-z",
    "tBodyGyro-min()-x",
    "tBodyGyro-min()-y",
    "tBodyGyro-min()-z",
    "tBodyGyro-sma()",
    "tBodyGyro-energy()-x",
    "tBodyGyro-energy()-y",
    "tBodyGyro-energy()-z",
    "tBodyGyro-iqr()-x",
    "tBodyGyro-iqr()-y",
    "tBodyGyro-iqr()-z",
    "tBodyGyro-entropy()-x",
    "tBodyGyro-entropy()-y",
    "tBodyGyro-entropy()-z",
    "tBodyGyro-arCoeff()1-x",
    "tBodyGyro-arCoeff()2-x",
    "tBodyGyro-arCoeff()3-x",
    "tBodyGyro-arCoeff()4-x",
    "tBodyGyro-arCoeff()1-y",
    "tBodyGyro-arCoeff()2-y",
    "tBodyGyro-arCoeff()3-y",
    "tBodyGyro-arCoeff()4-y",
    "tBodyGyro-arCoeff()1-z",
    "tBodyGyro-arCoeff()2-z",
    "tBodyGyro-arCoeff()3-z",
    "tBodyGyro-arCoeff()4-z",
    "tBodyGyro-correlation()-x,y",
    "tBodyGyro-correlation()-x,z",
    "tBodyGyro-correlation()-y,z",
    "tBodyGyroJerk-mean()-x",
    "tBodyGyroJerk-mean()-y",
    "tBodyGyroJerk-mean()-z",
    "tBodyGyroJerk-std()-x",
    "tBodyGyroJerk-std()-y",
    "tBodyGyroJerk-std()-z",
    "tBodyGyroJerk-mad()-x",
    "tBodyGyroJerk-mad()-y",
    "tBodyGyroJerk-mad()-z",
    "tBodyGyroJerk-max()-x",
    "tBodyGyroJerk-max()-y",
    "tBodyGyroJerk-max()-z",
    "tBodyGyroJerk-min()-x",
    "tBodyGyroJerk-min()-y",
    "tBodyGyroJerk-min()-z",
    "tBodyGyroJerk-sma()",
    "tBodyGyroJerk-energy()-x",
    "tBodyGyroJerk-energy()-y",
    "tBodyGyroJerk-energy()-z",
    "tBodyGyroJerk-iqr()-x",
    "tBodyGyroJerk-iqr()-y",
    "tBodyGyroJerk-iqr()-z",
    "tBodyGyroJerk-entropy()-x",
    "tBodyGyroJerk-entropy()-y",
    "tBodyGyroJerk-entropy()-z",
    "tBodyGyroJerk-arCoeff()1-x",
    "tBodyGyroJerk-arCoeff()2-x",
    "tBodyGyroJerk-arCoeff()3-x",
    "tBodyGyroJerk-arCoeff()4-x",
    "tBodyGyroJerk-arCoeff()1-y",
    "tBodyGyroJerk-arCoeff()2-y",
    "tBodyGyroJerk-arCoeff()3-y",
    "tBodyGyroJerk-arCoeff()4-y",
    "tBodyGyroJerk-arCoeff()1-z",
    "tBodyGyroJerk-arCoeff()2-z",
    "tBodyGyroJerk-arCoeff()3-z",
    "tBodyGyroJerk-arCoeff()4-z",
    "tBodyGyroJerk-correlation()-x,y",
    "tBodyGyroJerk-correlation()-x,z",
    "tBodyGyroJerk-correlation()-y,z",
    "tBodyAccMag-mean()",
    "tBodyAccMag-std()",
    "tBodyAccMag-mad()",
    "tBodyAccMag-max()",
    "tBodyAccMag-min()",
    "tBodyAccMag-sma()",
    "tBodyAccMag-energy()",
    "tBodyAccMag-iqr()",
    "tBodyAccMag-entropy()",
    "tBodyAccMag-arCoeff()1",
    "tBodyAccMag-arCoeff()2",
    "tBodyAccMag-arCoeff()3",
    "tBodyAccMag-arCoeff()4",
    "tGravityAccMag-mean()",
    "tGravityAccMag-std()",
    "tGravityAccMag-mad()",
    "tGravityAccMag-max()",
    "tGravityAccMag-min()",
    "tGravityAccMag-sma()",
    "tGravityAccMag-energy()",
    "tGravityAccMag-iqr()",
    "tGravityAccMag-entropy()",
    "tGravityAccMag-arCoeff()1",
    "tGravityAccMag-arCoeff()2",
    "tGravityAccMag-arCoeff()3",
    "tGravityAccMag-arCoeff()4",
    "tBodyAccJerkMag-mean()",
    "tBodyAccJerkMag-std()",
    "tBodyAccJerkMag-mad()",
    "tBodyAccJerkMag-max()",
    "tBodyAccJerkMag-min()",
    "tBodyAccJerkMag-sma()",
    "tBodyAccJerkMag-energy()",
    "tBodyAccJerkMag-iqr()",
    "tBodyAccJerkMag-entropy()",
    "tBodyAccJerkMag-arCoeff()1",
    "tBodyAccJerkMag-arCoeff()2",
    "tBodyAccJerkMag-arCoeff()3",
    "tBodyAccJerkMag-arCoeff()4",
    "tBodyGyroMag-mean()",
    "tBodyGyroMag-std()",
    "tBodyGyroMag-mad()",
    "tBodyGyroMag-max()",
    "tBodyGyroMag-min()",
    "tBodyGyroMag-sma()",
    "tBodyGyroMag-energy()",
    "tBodyGyroMag-iqr()",
    "tBodyGyroMag-entropy()",
    "tBodyGyroMag-arCoeff()1",
    "tBodyGyroMag-arCoeff()2",
    "tBodyGyroMag-arCoeff()3",
    "tBodyGyroMag-arCoeff()4",
    "tBodyGyroJerkMag-mean()",
    "tBodyGyroJerkMag-std()",
    "tBodyGyroJerkMag-mad()",
    "tBodyGyroJerkMag-max()",
    "tBodyGyroJerkMag-min()",
    "tBodyGyroJerkMag-sma()",
    "tBodyGyroJerkMag-energy()",
    "tBodyGyroJerkMag-iqr()",
    "tBodyGyroJerkMag-entropy()",
    "tBodyGyroJerkMag-arCoeff()1",
    "tBodyGyroJerkMag-arCoeff()2",
    "tBodyGyroJerkMag-arCoeff()3",
    "tBodyGyroJerkMag-arCoeff()4",
    "fBodyAcc-mean()-x",
    "fBodyAcc-mean()-y",
    "fBodyAcc-mean()-z",
    "fBodyAcc-std()-x",
    "fBodyAcc-std()-y",
    "fBodyAcc-std()-z",
    "fBodyAcc-mad()-x",
    "fBodyAcc-mad()-y",
    "fBodyAcc-mad()-z",
    "fBodyAcc-max()-x",
    "fBodyAcc-max()-y",
    "fBodyAcc-max()-z",
    "fBodyAcc-min()-x",
    "fBodyAcc-min()-y",
    "fBodyAcc-min()-z",
    "fBodyAcc-sma()",
    "fBodyAcc-energy()-x",
    "fBodyAcc-energy()-y",
    "fBodyAcc-energy()-z",
    "fBodyAcc-iqr()-x",
    "fBodyAcc-iqr()-y",
    "fBodyAcc-iqr()-z",
    "fBodyAcc-entropy()-x",
    "fBodyAcc-entropy()-y",
    "fBodyAcc-entropy()-z",
    "fBodyAcc-maxInds-x",
    "fBodyAcc-maxInds-y",
    "fBodyAcc-maxInds-z",
    "fBodyAcc-meanFreq()-x",
    "fBodyAcc-meanFreq()-y",
    "fBodyAcc-meanFreq()-z",
    "fBodyAcc-skewness()-x",
    "fBodyAcc-kurtosis()-x",
    "fBodyAcc-skewness()-y",
    "fBodyAcc-kurtosis()-y",
    "fBodyAcc-skewness()-z",
    "fBodyAcc-kurtosis()-z",
    "fBodyAcc-bandsEnergy()-1,8-x",
    "fBodyAcc-bandsEnergy()-9,16-x",
    "fBodyAcc-bandsEnergy()-17,24-x",
    "fBodyAcc-bandsEnergy()-25,32-x",
    "fBodyAcc-bandsEnergy()-33,40-x",
    "fBodyAcc-bandsEnergy()-41,48-x",
    "fBodyAcc-bandsEnergy()-49,56-x",
    "fBodyAcc-bandsEnergy()-57,64-x",
    "fBodyAcc-bandsEnergy()-1,16-x",
    "fBodyAcc-bandsEnergy()-17,32-x",
    "fBodyAcc-bandsEnergy()-33,48-x",
    "fBodyAcc-bandsEnergy()-49,64-x",
    "fBodyAcc-bandsEnergy()-1,24-x",
    "fBodyAcc-bandsEnergy()-25,48-x",
    "fBodyAcc-bandsEnergy()-1,8-y",
    "fBodyAcc-bandsEnergy()-9,16-y",
    "fBodyAcc-bandsEnergy()-17,24-y",
    "fBodyAcc-bandsEnergy()-25,32-y",
    "fBodyAcc-bandsEnergy()-33,40-y",
    "fBodyAcc-bandsEnergy()-41,48-y",
    "fBodyAcc-bandsEnergy()-49,56-y",
    "fBodyAcc-bandsEnergy()-57,64-y",
    "fBodyAcc-bandsEnergy()-1,16-y",
    "fBodyAcc-bandsEnergy()-17,32-y",
    "fBodyAcc-bandsEnergy()-33,48-y",
    "fBodyAcc-bandsEnergy()-49,64-y",
    "fBodyAcc-bandsEnergy()-1,24-y",
    "fBodyAcc-bandsEnergy()-25,48-y",
    "fBodyAcc-bandsEnergy()-1,8-z",
    "fBodyAcc-bandsEnergy()-9,16-z",
    "fBodyAcc-bandsEnergy()-17,24-z",
    "fBodyAcc-bandsEnergy()-25,32-z",
    "fBodyAcc-bandsEnergy()-33,40-z",
    "fBodyAcc-bandsEnergy()-41,48-z",
    "fBodyAcc-bandsEnergy()-49,56-z",
    "fBodyAcc-bandsEnergy()-57,64-z",
    "fBodyAcc-bandsEnergy()-1,16-z",
    "fBodyAcc-bandsEnergy()-17,32-z",
    "fBodyAcc-bandsEnergy()-33,48-z",
    "fBodyAcc-bandsEnergy()-49,64-z",
    "fBodyAcc-bandsEnergy()-1,24-z",
    "fBodyAcc-bandsEnergy()-25,48-z",
    "fBodyAccJerk-mean()-x",
    "fBodyAccJerk-mean()-y",
    "fBodyAccJerk-mean()-z",
    "fBodyAccJerk-std()-x",
    "fBodyAccJerk-std()-y",
    "fBodyAccJerk-std()-z",
    "fBodyAccJerk-mad()-x",
    "fBodyAccJerk-mad()-y",
    "fBodyAccJerk-mad()-z",
    "fBodyAccJerk-max()-x",
    "fBodyAccJerk-max()-y",
    "fBodyAccJerk-max()-z",
    "fBodyAccJerk-min()-x",
    "fBodyAccJerk-min()-y",
    "fBodyAccJerk-min()-z",
    "fBodyAccJerk-sma()",
    "fBodyAccJerk-energy()-x",
    "fBodyAccJerk-energy()-y",
    "fBodyAccJerk-energy()-z",
    "fBodyAccJerk-iqr()-x",
    "fBodyAccJerk-iqr()-y",
    "fBodyAccJerk-iqr()-z",
    "fBodyAccJerk-entropy()-x",
    "fBodyAccJerk-entropy()-y",
    "fBodyAccJerk-entropy()-z",
    "fBodyAccJerk-maxInds-x",
    "fBodyAccJerk-maxInds-y",
    "fBodyAccJerk-maxInds-z",
    "fBodyAccJerk-meanFreq()-x",
    "fBodyAccJerk-meanFreq()-y",
    "fBodyAccJerk-meanFreq()-z",
    "fBodyAccJerk-skewness()-x",
    "fBodyAccJerk-kurtosis()-x",
    "fBodyAccJerk-skewness()-y",
    "fBodyAccJerk-kurtosis()-y",
    "fBodyAccJerk-skewness()-z",
    "fBodyAccJerk-kurtosis()-z",
    "fBodyAccJerk-bandsEnergy()-1,8-x",
    "fBodyAccJerk-bandsEnergy()-9,16-x",
    "fBodyAccJerk-bandsEnergy()-17,24-x",
    "fBodyAccJerk-bandsEnergy()-25,32-x",
    "fBodyAccJerk-bandsEnergy()-33,40-x",
    "fBodyAccJerk-bandsEnergy()-41,48-x",
    "fBodyAccJerk-bandsEnergy()-49,56-x",
    "fBodyAccJerk-bandsEnergy()-57,64-x",
    "fBodyAccJerk-bandsEnergy()-1,16-x",
    "fBodyAccJerk-bandsEnergy()-17,32-x",
    "fBodyAccJerk-bandsEnergy()-33,48-x",
    "fBodyAccJerk-bandsEnergy()-49,64-x",
    "fBodyAccJerk-bandsEnergy()-1,24-x",
    "fBodyAccJerk-bandsEnergy()-25,48-x",
    "fBodyAccJerk-bandsEnergy()-1,8-y",
    "fBodyAccJerk-bandsEnergy()-9,16-y",
    "fBodyAccJerk-bandsEnergy()-17,24-y",
    "fBodyAccJerk-bandsEnergy()-25,32-y",
    "fBodyAccJerk-bandsEnergy()-33,40-y",
    "fBodyAccJerk-bandsEnergy()-41,48-y",
    "fBodyAccJerk-bandsEnergy()-49,56-y",
    "fBodyAccJerk-bandsEnergy()-57,64-y",
    "fBodyAccJerk-bandsEnergy()-1,16-y",
    "fBodyAccJerk-bandsEnergy()-17,32-y",
    "fBodyAccJerk-bandsEnergy()-33,48-y",
    "fBodyAccJerk-bandsEnergy()-49,64-y",
    "fBodyAccJerk-bandsEnergy()-1,24-y",
    "fBodyAccJerk-bandsEnergy()-25,48-y",
    "fBodyAccJerk-bandsEnergy()-1,8-z",
    "fBodyAccJerk-bandsEnergy()-9,16-z",
    "fBodyAccJerk-bandsEnergy()-17,24-z",
    "fBodyAccJerk-bandsEnergy()-25,32-z",
    "fBodyAccJerk-bandsEnergy()-33,40-z",
    "fBodyAccJerk-bandsEnergy()-41,48-z",
    "fBodyAccJerk-bandsEnergy()-49,56-z",
    "fBodyAccJerk-bandsEnergy()-57,64-z",
    "fBodyAccJerk-bandsEnergy()-1,16-z",
    "fBodyAccJerk-bandsEnergy()-17,32-z",
    "fBodyAccJerk-bandsEnergy()-33,48-z",
    "fBodyAccJerk-bandsEnergy()-49,64-z",
    "fBodyAccJerk-bandsEnergy()-1,24-z",
    "fBodyAccJerk-bandsEnergy()-25,48-z",
    "fBodyGyro-mean()-x",
    "fBodyGyro-mean()-y",
    "fBodyGyro-mean()-z",
    "fBodyGyro-std()-x",
    "fBodyGyro-std()-y",
    "fBodyGyro-std()-z",
    "fBodyGyro-mad()-x",
    "fBodyGyro-mad()-y",
    "fBodyGyro-mad()-z",
    "fBodyGyro-max()-x",
    "fBodyGyro-max()-y",
    "fBodyGyro-max()-z",
    "fBodyGyro-min()-x",
    "fBodyGyro-min()-y",
    "fBodyGyro-min()-z",
    "fBodyGyro-sma()",
    "fBodyGyro-energy()-x",
    "fBodyGyro-energy()-y",
    "fBodyGyro-energy()-z",
    "fBodyGyro-iqr()-x",
    "fBodyGyro-iqr()-y",
    "fBodyGyro-iqr()-z",
    "fBodyGyro-entropy()-x",
    "fBodyGyro-entropy()-y",
    "fBodyGyro-entropy()-z",
    "fBodyGyro-maxInds-x",
    "fBodyGyro-maxInds-y",
    "fBodyGyro-maxInds-z",
    "fBodyGyro-meanFreq()-x",
    "fBodyGyro-meanFreq()-y",
    "fBodyGyro-meanFreq()-z",
    "fBodyGyro-skewness()-x",
    "fBodyGyro-kurtosis()-x",
    "fBodyGyro-skewness()-y",
    "fBodyGyro-kurtosis()-y",
    "fBodyGyro-skewness()-z",
    "fBodyGyro-kurtosis()-z",
    "fBodyGyro-bandsEnergy()-1,8-x",
    "fBodyGyro-bandsEnergy()-9,16-x",
    "fBodyGyro-bandsEnergy()-17,24-x",
    "fBodyGyro-bandsEnergy()-25,32-x",
    "fBodyGyro-bandsEnergy()-33,40-x",
    "fBodyGyro-bandsEnergy()-41,48-x",
    "fBodyGyro-bandsEnergy()-49,56-x",
    "fBodyGyro-bandsEnergy()-57,64-x",
    "fBodyGyro-bandsEnergy()-1,16-x",
    "fBodyGyro-bandsEnergy()-17,32-x",
    "fBodyGyro-bandsEnergy()-33,48-x",
    "fBodyGyro-bandsEnergy()-49,64-x",
    "fBodyGyro-bandsEnergy()-1,24-x",
    "fBodyGyro-bandsEnergy()-25,48-x",
    "fBodyGyro-bandsEnergy()-1,8-y",
    "fBodyGyro-bandsEnergy()-9,16-y",
    "fBodyGyro-bandsEnergy()-17,24-y",
    "fBodyGyro-bandsEnergy()-25,32-y",
    "fBodyGyro-bandsEnergy()-33,40-y",
    "fBodyGyro-bandsEnergy()-41,48-y",
    "fBodyGyro-bandsEnergy()-49,56-y",
    "fBodyGyro-bandsEnergy()-57,64-y",
    "fBodyGyro-bandsEnergy()-1,16-y",
    "fBodyGyro-bandsEnergy()-17,32-y",
    "fBodyGyro-bandsEnergy()-33,48-y",
    "fBodyGyro-bandsEnergy()-49,64-y",
    "fBodyGyro-bandsEnergy()-1,24-y",
    "fBodyGyro-bandsEnergy()-25,48-y",
    "fBodyGyro-bandsEnergy()-1,8-z",
    "fBodyGyro-bandsEnergy()-9,16-z",
    "fBodyGyro-bandsEnergy()-17,24-z",
    "fBodyGyro-bandsEnergy()-25,32-z",
    "fBodyGyro-bandsEnergy()-33,40-z",
    "fBodyGyro-bandsEnergy()-41,48-z",
    "fBodyGyro-bandsEnergy()-49,56-z",
    "fBodyGyro-bandsEnergy()-57,64-z",
    "fBodyGyro-bandsEnergy()-1,16-z",
    "fBodyGyro-bandsEnergy()-17,32-z",
    "fBodyGyro-bandsEnergy()-33,48-z",
    "fBodyGyro-bandsEnergy()-49,64-z",
    "fBodyGyro-bandsEnergy()-1,24-z",
    "fBodyGyro-bandsEnergy()-25,48-z",
    "fBodyAccMag-mean()",
    "fBodyAccMag-std()",
    "fBodyAccMag-mad()",
    "fBodyAccMag-max()",
    "fBodyAccMag-min()",
    "fBodyAccMag-sma()",
    "fBodyAccMag-energy()",
    "fBodyAccMag-iqr()",
    "fBodyAccMag-entropy()",
    "fBodyAccMag-maxInds",
    "fBodyAccMag-meanFreq()",
    "fBodyAccMag-skewness()",
    "fBodyAccMag-kurtosis()",
    "fBodyBodyAccJerkMag-mean()",
    "fBodyBodyAccJerkMag-std()",
    "fBodyBodyAccJerkMag-mad()",
    "fBodyBodyAccJerkMag-max()",
    "fBodyBodyAccJerkMag-min()",
    "fBodyBodyAccJerkMag-sma()",
    "fBodyBodyAccJerkMag-energy()",
    "fBodyBodyAccJerkMag-iqr()",
    "fBodyBodyAccJerkMag-entropy()",
    "fBodyBodyAccJerkMag-maxInds",
    "fBodyBodyAccJerkMag-meanFreq()",
    "fBodyBodyAccJerkMag-skewness()",
    "fBodyBodyAccJerkMag-kurtosis()",
    "fBodyBodyGyroMag-mean()",
    "fBodyBodyGyroMag-std()",
    "fBodyBodyGyroMag-mad()",
    "fBodyBodyGyroMag-max()",
    "fBodyBodyGyroMag-min()",
    "fBodyBodyGyroMag-sma()",
    "fBodyBodyGyroMag-energy()",
    "fBodyBodyGyroMag-iqr()",
    "fBodyBodyGyroMag-entropy()",
    "fBodyBodyGyroMag-maxInds",
    "fBodyBodyGyroMag-meanFreq()",
    "fBodyBodyGyroMag-skewness()",
    "fBodyBodyGyroMag-kurtosis()",
    "fBodyBodyGyroJerkMag-mean()",
    "fBodyBodyGyroJerkMag-std()",
    "fBodyBodyGyroJerkMag-mad()",
    "fBodyBodyGyroJerkMag-max()",
    "fBodyBodyGyroJerkMag-min()",
    "fBodyBodyGyroJerkMag-sma()",
    "fBodyBodyGyroJerkMag-energy()",
    "fBodyBodyGyroJerkMag-iqr()",
    "fBodyBodyGyroJerkMag-entropy()",
    "fBodyBodyGyroJerkMag-maxInds",
    "fBodyBodyGyroJerkMag-meanFreq()",
    "fBodyBodyGyroJerkMag-skewness()",
    "fBodyBodyGyroJerkMag-kurtosis()",
    "angle(tBodyAccMean,gravity)",
    "angle(tBodyAccJerkMean,gravityMean)",
    "angle(tBodyGyroMean,gravityMean)",
    "angle(tBodyGyroJerkMean,gravityMean)",
    "angle(x,gravityMean)",
    "angle(y,gravityMean)",
    "angle(z,gravityMean)",
  ];

  useEffect(() => {
    const accSubscription = Accelerometer.addListener((accelerometerData) => {
      setAccData((prevData) => {
        const updatedData = [...prevData, accelerometerData];
        if (updatedData.length > requiredSamples) updatedData.shift();
        setDataCollectionProgress(
          Math.min((updatedData.length / requiredSamples) * 100, 100)
        );
        return updatedData;
      });
    });

    const gyroSubscription = Gyroscope.addListener((gyroscopeData) => {
      setGyroData((prevData) => {
        const updatedData = [...prevData, gyroscopeData];
        if (updatedData.length > requiredSamples) updatedData.shift();
        return updatedData;
      });
    });

    Accelerometer.setUpdateInterval(1000 / samplingRate);
    Gyroscope.setUpdateInterval(1000 / samplingRate);

    return () => {
      accSubscription && accSubscription.remove();
      gyroSubscription && gyroSubscription.remove();
    };
  }, []);

  const processSignalWindow = (
    accWindow: SensorData[],
    gyroWindow: SensorData[]
  ): FeatureRow => {
    const accProcessedSignals = signalProcessor.processSensorData(accWindow);
    const gyroProcessedSignals = signalProcessor.processSensorData(gyroWindow);

    const combinedProcessedSignals = {
      tBodyAcc: {
        x: accProcessedSignals.time.body.x,
        y: accProcessedSignals.time.body.y,
        z: accProcessedSignals.time.body.z,
      },
      tGravityAcc: {
        x: accProcessedSignals.time.gravity.x,
        y: accProcessedSignals.time.gravity.y,
        z: accProcessedSignals.time.gravity.z,
      },
      tBodyAccJerk: {
        x: accProcessedSignals.time.bodyJerk.x,
        y: accProcessedSignals.time.bodyJerk.y,
        z: accProcessedSignals.time.bodyJerk.z,
      },
      tBodyGyro: {
        x: gyroProcessedSignals.time.body.x,
        y: gyroProcessedSignals.time.body.y,
        z: gyroProcessedSignals.time.body.z,
      },
      tBodyGyroJerk: {
        x: gyroProcessedSignals.time.bodyJerk.x,
        y: gyroProcessedSignals.time.bodyJerk.y,
        z: gyroProcessedSignals.time.bodyJerk.z,
      },
      tBodyAccMag: { mag: accProcessedSignals.time.body.magnitude },
      tGravityAccMag: { mag: accProcessedSignals.time.gravity.magnitude },
      tBodyAccJerkMag: { mag: accProcessedSignals.time.bodyJerk.magnitude },
      tBodyGyroMag: { mag: gyroProcessedSignals.time.body.magnitude },
      tBodyGyroJerkMag: { mag: gyroProcessedSignals.time.bodyJerk.magnitude },
      fBodyAcc: {
        x: Array.from(accProcessedSignals.frequency.body.x),
        y: Array.from(accProcessedSignals.frequency.body.y),
        z: Array.from(accProcessedSignals.frequency.body.z),
      },
      fBodyAccJerk: {
        x: Array.from(accProcessedSignals.frequency.bodyJerk.x),
        y: Array.from(accProcessedSignals.frequency.bodyJerk.y),
        z: Array.from(accProcessedSignals.frequency.bodyJerk.z),
      },
      fBodyGyro: {
        x: Array.from(gyroProcessedSignals.frequency.body.x),
        y: Array.from(gyroProcessedSignals.frequency.body.y),
        z: Array.from(gyroProcessedSignals.frequency.body.z),
      },
      fBodyAccMag: { mag: accProcessedSignals.frequency.body.magnitude },
      fBodyBodyAccJerkMag: {
        mag: accProcessedSignals.frequency.bodyJerk.magnitude,
      },
      fBodyBodyGyroMag: { mag: gyroProcessedSignals.frequency.body.magnitude },
      fBodyBodyGyroJerkMag: {
        mag: gyroProcessedSignals.frequency.bodyJerk.magnitude,
      },
    };

    const features = featureExtractor.extractFeatures(combinedProcessedSignals);
    const angleFeatures = featureExtractor.extractAngleFeatures(
      combinedProcessedSignals
    );

    return {
      ...features,
      ...angleFeatures,
    };
  };

  const processMultipleSignals = async () => {
    if (accData.length < requiredSamples || gyroData.length < requiredSamples) {
      Alert.alert(
        "Insufficient Data",
        `Please wait while collecting sensor data. Progress: ${dataCollectionProgress.toFixed(
          1
        )}%`
      );
      return;
    }

    setIsProcessing(true);
    const newFeatures: FeatureRow[] = [];

    try {
      for (let i = 0; i < targetFeatureSets; i++) {
        const startIdx = i * slideSize;
        const endIdx = startIdx + windowSize;

        const accWindow = accData.slice(startIdx, endIdx);
        const gyroWindow = gyroData.slice(startIdx, endIdx);

        const windowFeatures = processSignalWindow(accWindow, gyroWindow);
        newFeatures.push(windowFeatures);
      }

      const normalizedFeatures = normalizeFeatures(newFeatures);
      setFeatureTable(normalizedFeatures);
      await saveFeaturesToFile(normalizedFeatures);
      Alert.alert(
        "Success",
        `Generated and saved ${targetFeatureSets} feature sets`
      );
    } catch (error) {
      console.error("Error processing signals:", error);
      Alert.alert("Error", "Failed to process signals");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveFeaturesToFile = async (features: FeatureRow[]) => {
    // Reorder features to match correct sequence
    const reorderedFeatures = features.map((row) => {
      const reorderedRow: { [key: string]: number } = {};
      feature_list.forEach((feature) => {
        reorderedRow[feature] = row[feature] || 0;
      });
      return reorderedRow;
    });

    // Convert each row to space-separated scientific notation with the specified format
    const formattedRows = reorderedFeatures.map(
      (row) =>
        " " +
        feature_list
          .map((feature) => {
            const value = row[feature];
            const formattedValue =
              value >= 0
                ? ` ${value.toExponential(7)}` // Add a leading space for positive values
                : `${value.toExponential(7)}`; // Keep the negative sign for negative values
            return formattedValue.replace(
              /e([+-])(\d{1,2})$/,
              "e$1" + "$2".padStart(4, "0")
            );
          })
          .join(" ") // Join features with spaces
    );

    const fileContent = formattedRows.join("\n");
    const filePath = `${FileSystem.documentDirectory}features.txt`;

    try {
      // Write to file
      await FileSystem.writeAsStringAsync(filePath, fileContent);

      // Get the local file URI
      const fileUri = FileSystem.documentDirectory + "features.txt";

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle: "Save Features",
        UTI: "public.plain-text",
      });
    } catch (error) {
      console.error("Error saving/sharing file:", error);
      throw error;
    }
  };
  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Data Collection: {dataCollectionProgress.toFixed(1)}%
        </Text>
        <ActivityIndicator
          animating={dataCollectionProgress < 100}
          color="#0000ff"
        />
      </View>

      <Button
        title={isProcessing ? "Processing..." : "Generate Feature Sets"}
        onPress={processMultipleSignals}
        disabled={isProcessing || dataCollectionProgress < 100}
      />

      <ScrollView horizontal={true} style={styles.horizontalScroll}>
        {featureTable.length > 0 ? (
          <View>
            <View style={styles.headerRow}>
              {feature_list.map((feature) => (
                <Text key={feature} style={styles.headerCell}>
                  {feature}
                </Text>
              ))}
            </View>
            <ScrollView style={styles.verticalScroll}>
              {featureTable.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.dataRow}>
                  {feature_list.map((feature) => (
                    <Text key={feature} style={styles.dataCell}>
                      {row[feature].toExponential(5)}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <Text style={styles.noDataText}>No features recorded yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusText: {
    marginRight: 10,
  },
  horizontalScroll: {
    marginTop: 20,
    width: "100%",
  },
  verticalScroll: {
    maxHeight: 300,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  headerCell: {
    minWidth: 120,
    fontWeight: "bold",
    textAlign: "center",
    padding: 5,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dataCell: {
    minWidth: 120,
    textAlign: "center",
    padding: 5,
  },
  noDataText: {
    textAlign: "center",
    marginTop: 20,
  },
});
