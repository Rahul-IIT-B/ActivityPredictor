# ActivityPredictor

ActivityPredictor is a React Native application that processes accelerometer and gyroscope signals from a smartphone to calculate features for activity recognition. The app aims to predict human activities by analyzing signal data using various signal processing techniques and machine learning.

## Features Implemented

1. **Real-Time Data Collection**:

   - Collects accelerometer and gyroscope data using `expo-sensors`.
   - Signals are updated at a 20ms interval.

2. **Signal Processing**:

   - Processes accelerometer and gyroscope data to compute time-domain and frequency-domain features using techniques such as statistical analysis, Fourier Transform for frequency analysis, and magnitude computation for signal interpretation.
   - Supports features like magnitude, jerk, and frequency components.

3. **Feature Extraction**:

   - Extracts statistical and axis-based features using a custom feature extractor.

4. **Feature Export**:

   - The app allows exporting the extracted features. When the "Generate Feature Set" button is pressed, it opens the sharing dialogue for exporting the data conveniently.

## Project Structure

- **SignalProcessor.js**: Handles preprocessing of sensor data.
- **FeatureExtractor.js**: Extracts meaningful features from the processed signals.
- **App**: Main application folder containing the file index.tsx that integrates all components.

## Tech Stack

- **React Native**: Frontend framework for building cross-platform apps.
- **Expo**: Toolchain for React Native development.
- **expo-sensors**: Library for accessing accelerometer and gyroscope data.
- **expo-file-system**: For file export functionality.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ActivityPredictor.git
   ```
2. Navigate to the project directory:
   ```bash
   cd ActivityPredictor
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   expo start
   ```

## Future Features

1. **Feature Scaling**:

   - Improve the current feature scaling implementation. A final scaling method is yet to be determined.

2. **Activity Prediction**:

   - Integrate a pre-trained machine learning model, such as a Support Vector Machine (SVM) or Logistic Regression, trained on the UCI HAR Dataset (a completed project) to predict human activities based on extracted features.

3. **Enhanced User Interface**:

   - Add visualizations to display signal data (e.g., line charts for accelerometer and gyroscope readings) and extracted features (e.g., bar charts for feature comparisons).
   - Create activity prediction results with a user-friendly interface.

4. **Advanced Export Options**:

   - Allow exporting feature sets in various formats, such as CSV or JSON, with options for both raw and processed data to suit different use cases.

## Acknowledgments

- The UCI HAR Dataset used for training the machine learning model.
- Expo documentation and community support for seamless React Native development.

---

**Note**: Ensure all dependencies are installed, and necessary libraries for signal processing and feature extraction are updated before running the application.

