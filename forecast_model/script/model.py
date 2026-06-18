import logging
import os
import joblib
import pandas as pd

# Set up logging for better production visibility
logger = logging.getLogger(__name__)

class ForecastModel:
    def __init__(self, pm=25, hr=1):
        """
        Initializes the forecast model by loading the joblib bundle.
        pm = 25 for PM2.5, 10 for PM10
        hr = forecast horizon in hours (1, 3, 6, 12 or 24)
        """
        self.model_path = f"air_quality_models_pm{pm}_{hr}h.joblib"

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model bundle not found at: {self.model_path}")
            
        try:
            # Load the bundle and attach directly to self
            bundle = joblib.load(self.model_path)
            
            # Use .get() to avoid KeyError if the bundle structure changes
            self.models = bundle.get("models", {})
            self.weights = bundle.get("weights", {})
            self.feature_columns = bundle.get("feature_columns", [])
            self.target = bundle.get("target", None)
            
            if not self.models or not self.weights:
                raise ValueError("Model bundle is missing 'models' or 'weights'.")
                
        except Exception as e:
            logger.error(f"Failed to load or initialize the ForecastModel: {e}")
            raise

    def prepare_features(self, df):
        df = df.copy()

        X = df.drop(columns=["time"])

        # Keep lat_km/lon_km, drop raw lat/lon
        X = X.drop(columns=["latitude", "longitude"], errors="ignore")

        # One-hot encoding for location and region
        categorical_cols = [
            col for col in ["location", "region"]
            if col in X.columns
        ]

        X = pd.get_dummies(X, columns=categorical_cols, drop_first=False)

        return X

    def predict(self, new_X):
        """
        new_X must already have the same feature engineering and one-hot columns.
        """
        # Make sure columns match training columns
        new_X = new_X.reindex(columns=self.feature_columns, fill_value=0)

        pred = sum(
            self.weights[name] * self.models[name].predict(new_X)
            for name in self.models.keys()
        )

        return pred 

if __name__ == '__main__':
    model = ForecastModel()
    print(model.feature_columns)