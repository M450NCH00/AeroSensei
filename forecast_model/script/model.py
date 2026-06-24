import logging
import os
import joblib
import time
import pandas as pd
import numpy as np
#import onnxruntime as rt

os.environ["OMP_NUM_THREADS"] = "2"      # OpenMP (XGBoost, LightGBM)
os.environ["MKL_NUM_THREADS"] = "2"      # MKL (sklearn)

# Set up logging for better production visibility
logger = logging.getLogger(__name__)

class ForecastModel:
    def __init__(self, pm=25, hr=1):
        """
        Initializes the forecast model by loading the joblib bundle.
        pm = 25 for PM2.5, 10 for PM10
        hr = forecast horizon in hours (1, 3, 6, 12 or 24)
        """
        self.pm = pm
        self.hr = hr
        self.base = f"./forecast_model/model/air_quality_models_pm{pm}_{hr}h.joblib"
        self.model_path = os.path.abspath(self.base)

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model bundle not found at: {self.model_path}")
            
        try:
            # Load the bundle and attach directly to self
            print("Loading model...")
            start_time = time.time()
            bundle = joblib.load(self.model_path)
            
            # Use .get() to avoid KeyError if the bundle str
            # ucture changes
            self.models = bundle.get("models", {})
            self.weights = bundle.get("weights", {})
            self.feature_columns = bundle.get("feature_columns", [])
            self.target = bundle.get("target", None)

            print("Model loaded. Time taken: ",time.time()-start_time,"s")
            
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
        start = time.time()

        if self.pm == 25:
            new_X = new_X.drop(columns=["aq_pm10"], errors="ignore")
        elif self.pm == 10:
            new_X = new_X.drop(columns=["aq_pm2_5"], errors="ignore")

        # Deduplicate feature columns (keep first occurrence)
        seen = set()
        unique_feature_cols = []
        for col in self.feature_columns:
            if col not in seen:
                unique_feature_cols.append(col)
                seen.add(col)

        # Also deduplicate new_X columns
        new_X = new_X.loc[:, ~new_X.columns.duplicated()]

        new_X = new_X.reindex(columns=unique_feature_cols, fill_value=0)

        pred = sum(
            self.weights[name] * self.models[name].predict(new_X)
            for name in self.models.keys()
        )

        print("Inference time: ", time.time() - start, "s")
        return pred
    
# class ForecastModel_ONNX:
#     def __init__(self, pm=25, hr=1):
#         """
#         Initializes the forecast model by loading ONNX model files.
#         pm = 25 for PM2.5, 10 for PM10
#         hr = forecast horizon in hours (1, 3, 6, 12 or 24)

#         Expects a bundle .onnx file per model named:
#             air_quality_models_pm{pm}_{hr}h_{model_name}.onnx
#         And a metadata file:
#             air_quality_models_pm{pm}_{hr}h_meta.joblib
#         """
#         self.base_path = f"air_quality_models_pm{pm}_{hr}h"
#         self.meta_path = f"{self.base_path}_meta.joblib"

#         if not os.path.exists(self.meta_path):
#             raise FileNotFoundError(f"Metadata bundle not found at: {self.meta_path}")

#         try:
#             print("Loading ONNX models...")
#             start_time = time.time()

#             # Load metadata (weights, feature_columns, target, model names)
#             import joblib
#             meta = joblib.load(self.meta_path)

#             self.weights = meta.get("weights", {})
#             self.feature_columns = meta.get("feature_columns", [])
#             self.target = meta.get("target", None)
#             model_names = list(self.weights.keys())

#             if not model_names or not self.weights:
#                 raise ValueError("Metadata bundle is missing 'weights' or model names.")

#             # Load each ONNX model as an InferenceSession
#             self.sessions = {}
#             for name in model_names:
#                 onnx_path = f"{self.base_path}_{name}.onnx"
#                 if not os.path.exists(onnx_path):
#                     raise FileNotFoundError(f"ONNX model not found: {onnx_path}")
#                 self.sessions[name] = rt.InferenceSession(
#                     onnx_path,
#                     providers=["CPUExecutionProvider"]
#                 )

#             print(f"ONNX models loaded. Time taken: {time.time() - start_time:.3f}s")

#         except Exception as e:
#             logger.error(f"Failed to load or initialize ForecastModel_ONNX: {e}")
#             raise

#     def predict(self, new_X):
#         start = time.time()

#         # Deduplicate feature columns (keep first occurrence)
#         seen = set()
#         unique_feature_cols = []
#         for col in self.feature_columns:
#             if col not in seen:
#                 unique_feature_cols.append(col)
#                 seen.add(col)

#         # Deduplicate and align input columns
#         new_X = new_X.loc[:, ~new_X.columns.duplicated()]
#         new_X = new_X.reindex(columns=unique_feature_cols, fill_value=0)

#         # ONNX Runtime requires float32
#         X_array = new_X.to_numpy(dtype=np.float32)

#         # Weighted ensemble prediction across all ONNX sessions
#         pred = sum(
#             self.weights[name] * self._run_session(self.sessions[name], X_array)
#             for name in self.sessions.keys()
#         )

#         print(f"Inference time: {time.time() - start:.3f}s")
#         return pred

#     def _run_session(self, session, X_array):
#         """Runs inference on a single ONNX session and returns a 1D numpy array."""
#         input_name = session.get_inputs()[0].name
#         result = session.run(None, {input_name: X_array})[0]
#         return result.flatten()

if __name__ == '__main__':
    model = ForecastModel()
    print(model.feature_columns)