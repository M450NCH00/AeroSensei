import numpy as np
import pandas as pd
import joblib
from tqdm import tqdm

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from lightgbm import LGBMRegressor, early_stopping, log_evaluation
from xgboost import XGBRegressor

def prepare_features(df, target_col):
    df = df.copy()

    target_cols = [col for col in df.columns if col.startswith("target_")]

    y = df[target_col]
    X = df.drop(columns=target_cols)

    X = X.drop(columns=["time"])

    # Keep lat_km/lon_km, drop raw lat/lon
    X = X.drop(columns=["latitude", "longitude"], errors="ignore")

    # One-hot encoding for location and region
    categorical_cols = [
        col for col in ["location"]
        if col in X.columns
    ]

    X = pd.get_dummies(X, columns=categorical_cols, drop_first=False)

    return X, y


def chronological_split(df, X, y):
    sorted_times = np.sort(df["time"].unique())

    train_cutoff = sorted_times[int(0.70 * len(sorted_times))]
    val_cutoff = sorted_times[int(0.85 * len(sorted_times))]

    train_idx = df["time"] <= train_cutoff
    val_idx = (df["time"] > train_cutoff) & (df["time"] <= val_cutoff)
    test_idx = df["time"] > val_cutoff

    return (
        X.loc[train_idx],
        y.loc[train_idx],
        X.loc[val_idx],
        y.loc[val_idx],
        X.loc[test_idx],
        y.loc[test_idx],
    )


def regression_metrics(y_true, y_pred):
    mse = mean_squared_error(y_true, y_pred)

    return {
        "MAE": mean_absolute_error(y_true, y_pred),
        "MSE": mse,
        "RMSE": np.sqrt(mse),
        "R2": r2_score(y_true, y_pred),
        "Bias": np.mean(y_pred - y_true),
    }

time_list = [1]

for i in time_list:
  print(f"===========Training {i}h model=================")
  try:
    del(models)
    print("Model refreshed")
  except:
    print("No model to refresh")
    
  DATA_PATH = f"data/vietnam_training_table_{i}h_long.csv"
  TARGET = f"target_pm2_5_tplus_{i}h"

  df = pd.read_csv(DATA_PATH)
  df["time"] = pd.to_datetime(df["time"])

  df_cleaned = df.dropna(subset=['aq_pm2_5', 'aq_pm10'])
  print(f"Original DataFrame shape: {df.shape}")
  print(f"Cleaned DataFrame shape: {df_cleaned.shape}")

  for col in df_cleaned.columns:
      if pd.api.types.is_numeric_dtype(df_cleaned[col]):
          # Calculate mean only from non-NaN values
          mean_value = df_cleaned[col].mean()
          # Fill NaN values with the calculated mean
          df_cleaned[col].fillna(mean_value, inplace=True)
          #df_cleaned[col].fillna(0, inplace=True)
      else:
          print(f"Skipping non-numeric column: {col}")

  print("NaN values have been replaced with the mean of their respective columns.")
  # Display a summary of NaN values after cleaning
  print("\nNaN values count after imputation:")
  print(df_cleaned.isnull().sum()[df_cleaned.isnull().sum() > 0])

  X, y = prepare_features(df_cleaned, TARGET)
  
  print(X.columns)
  X_train, y_train, X_val, y_val, X_test, y_test = chronological_split(df_cleaned, X, y)

  X_train = X_train.drop(columns=["time"], errors="ignore")
  X_val = X_val.drop(columns=["time"], errors="ignore")
  X_test = X_test.drop(columns=["time"], errors="ignore")

  rf_model = RandomForestRegressor(
      n_estimators=800,
      max_depth=24,
      min_samples_leaf=2,
      min_samples_split=4,
      max_features="sqrt",
      bootstrap=True,
      random_state=42,
      n_jobs=-1,
  )

  lgbm_model = LGBMRegressor(
      n_estimators=3000,
      learning_rate=0.01,
      num_leaves=63,
      max_depth=-1,
      min_child_samples=30,
      subsample=0.85,
      subsample_freq=1,
      colsample_bytree=0.85,
      reg_alpha=0.2,
      reg_lambda=1.0,
      objective="regression",
      random_state=42,
      n_jobs=-1,
  )

  xgb_model = XGBRegressor(
      n_estimators=2500,
      learning_rate=0.015,
      max_depth=7,
      min_child_weight=5,
      subsample=0.85,
      colsample_bytree=0.85,
      reg_alpha=0.1,
      reg_lambda=1.5,
      gamma=0.05,
      objective="reg:squarederror",
      tree_method="hist",
      random_state=42,
      n_jobs=-1,
  )


  models = {}
  val_predictions = {}
  test_predictions = {}
  results = []


  print("Training Random Forest...")
  rf_model.fit(X_train, y_train)
  models["Random Forest"] = rf_model

  val_predictions["Random Forest"] = rf_model.predict(X_val)
  test_predictions["Random Forest"] = rf_model.predict(X_test)


  print("Training LightGBM...")
  lgbm_model.fit(
      X_train,
      y_train,
      eval_set=[(X_val, y_val)],
      eval_metric="rmse",
      callbacks=[
          early_stopping(stopping_rounds=150),
          log_evaluation(period=200),
      ],
  )

  models["LightGBM"] = lgbm_model

  val_predictions["LightGBM"] = lgbm_model.predict(X_val)
  test_predictions["LightGBM"] = lgbm_model.predict(X_test)


  print("Training XGBoost...")
  xgb_model.fit(
      X_train,
      y_train,
      eval_set=[(X_val, y_val)],
      verbose=200,
  )

  models["XGBoost"] = xgb_model

  val_predictions["XGBoost"] = xgb_model.predict(X_val)
  test_predictions["XGBoost"] = xgb_model.predict(X_test)


  for name in models:
      results.append({
          "Model": name,
          "Dataset": "Validation",
          **regression_metrics(y_val, val_predictions[name]),
      })

      results.append({
          "Model": name,
          "Dataset": "Test",
          **regression_metrics(y_test, test_predictions[name]),
      })


  # Simple average ensemble
  simple_val = np.mean(
      np.column_stack([val_predictions[name] for name in models]),
      axis=1,
  )

  simple_test = np.mean(
      np.column_stack([test_predictions[name] for name in models]),
      axis=1,
  )

  results.append({
      "Model": "Simple Average Ensemble",
      "Dataset": "Validation",
      **regression_metrics(y_val, simple_val),
  })

  results.append({
      "Model": "Simple Average Ensemble",
      "Dataset": "Test",
      **regression_metrics(y_test, simple_test),
  })


  # RMSE-weighted ensemble
  val_rmse = {
      name: np.sqrt(mean_squared_error(y_val, val_predictions[name]))
      for name in models
  }

  inv_rmse = {
      name: 1.0 / rmse
      for name, rmse in val_rmse.items()
  }

  total = sum(inv_rmse.values())

  weights = {
      name: inv_rmse[name] / total
      for name in models
  }

  weighted_val = sum(
      weights[name] * val_predictions[name]
      for name in models
  )

  weighted_test = sum(
      weights[name] * test_predictions[name]
      for name in models
  )

  results.append({
      "Model": "Weighted Ensemble",
      "Dataset": "Validation",
      **regression_metrics(y_val, weighted_val),
  })

  results.append({
      "Model": "Weighted Ensemble",
      "Dataset": "Test",
      **regression_metrics(y_test, weighted_test),
  })


  results_df = pd.DataFrame(results)
  test_results = results_df[results_df["Dataset"] == "Test"].sort_values("RMSE")

  print("\nTest results:")
  print(test_results)

  print("\nWeighted ensemble weights:")
  print(weights)


  joblib.dump(
      {
          "models": models,
          "weights": weights,
          "feature_columns": list(X.columns),
          "target": TARGET,
      },
      f"air_quality_models_pm25_{i}h.joblib",
  )

  results_df.to_csv(f"improved_model_comparison_results_{i}h.csv", index=False)

  print("\nSaved:")
  print(f"air_quality_models_pm25_{i}h.joblib")
  print(f"model_comparison_results_{i}h.csv")