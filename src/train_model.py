import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb

# Import our custom function from the other module
from data_processing import load_and_engineer_features

def train_pipeline():
    """
    Full pipeline to load data, preprocess, train, validate the model,
    and save the final artifacts.
    """
    # --- 1. Load and Process Data ---
    project_root = Path(__file__).resolve().parents[1]
    data_path = project_root / 'Data' / 'Raw' / 'vietnam_housing_dataset.csv'
    models_dir = project_root / 'models'
    models_dir.mkdir(exist_ok=True)
    df = load_and_engineer_features(str(data_path))

    # --- 2. Define Features (X) and Target (y) ---
    X = df.drop(columns=['Price'])
    y = df['Price']

    # --- 3. Create Train, Validation, and Test Splits ---
    print("Splitting data into training, validation, and testing sets...")
    
    # First, split into training (64%) and a temporary set (36%)
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.36, random_state=10)
    
    # Then, split the temporary set into validation (16%) and test (20%)
    # The test_size here is 0.555... which splits 36% into 16% and 20%
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.555, random_state=10)

    print(f"Training set size: {len(X_train)}")
    print(f"Validation set size: {len(X_val)}")
    print(f"Testing set size: {len(X_test)}")
    
    # --- 4. Create Preprocessing Pipeline ---
    print("\nDefining preprocessing steps...")
    numeric_features = [
        'log_Area', 'Floors', 'Bedrooms', 'Bathrooms', 'Frontage_missing', 
        'log_Frontage', 'log_access_road', 'AccessRoad_missing', 'bedrooms_per_bathroom'
    ]
    categorical_features = ['Legal status']

    # The preprocessor is defined but will be part of the final pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', Pipeline(steps=[
                ('imputer', SimpleImputer(strategy='constant', fill_value='Unknown')),
                ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
            ]), categorical_features),
            ('num', Pipeline(steps=[
                ('imputer', SimpleImputer(strategy='median')),
                ('scaler', StandardScaler())
            ]), numeric_features)
        ],
        remainder='drop'
    )
    
    # --- 5. Define the XGBoost Model with Early Stopping ---
    xgboost_model = xgb.XGBRegressor(
        n_estimators=1000,  # Increase n_estimators, early stopping will find the best one
        learning_rate=0.01,
        max_depth=6,
        eval_metric='rmse',
        early_stopping_rounds=50, # Stop if validation RMSE doesn't improve for 50 rounds
        random_state=42
    )

    # --- 6. Create the Full Model Pipeline ---
    print("Creating the full model pipeline...")
    model_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', xgboost_model)
    ])

    # --- 7. Train the Model with Validation Set for Early Stopping ---
    print("Training the model with early stopping...")

    # The regressor step needs access to the validation data.
    # We must preprocess the validation data before passing it to fit.
    # A temporary pipeline is used for this transformation.
    X_val_processed = model_pipeline.named_steps['preprocessor'].fit(X_train).transform(X_val)
    
    # The key is to pass the preprocessed validation data to the `fit` method
    # of the pipeline, targeting the 'regressor' step's eval_set parameter.
    model_pipeline.fit(X_train, y_train, 
                       regressor__eval_set=[(X_val_processed, y_val)],
                       regressor__verbose=False) # Use verbose=True to see the rounds

    # --- 8. Evaluate on All Datasets ---
    print("\n--- Model Evaluation ---")
    
    # Evaluate on Training set
    y_train_pred = model_pipeline.predict(X_train)
    rmse_train = np.sqrt(mean_squared_error(y_train, y_train_pred))
    r2_train = r2_score(y_train, y_train_pred)
    print(f"Train Set      | RMSE: {rmse_train:.3f} billion VND | R² Score: {r2_train:.3f}")

    # Evaluate on Validation set
    y_val_pred = model_pipeline.predict(X_val)
    rmse_val = np.sqrt(mean_squared_error(y_val, y_val_pred))
    r2_val = r2_score(y_val, y_val_pred)
    print(f"Validation Set | RMSE: {rmse_val:.3f} billion VND | R² Score: {r2_val:.3f}")

    # Evaluate on Test set
    y_test_pred = model_pipeline.predict(X_test)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_test_pred))
    r2_test = r2_score(y_test, y_test_pred)
    print(f"Test Set       | RMSE: {rmse_test:.3f} billion VND | R² Score: {r2_test:.3f}")

    # --- 9. Save the Pipeline and Preprocessor ---
    print("\nSaving the trained model pipeline and preprocessor...")
    joblib.dump(model_pipeline, models_dir / 'xgboost_pipeline.pkl')
    joblib.dump(model_pipeline.named_steps['preprocessor'], models_dir / 'preprocessor.pkl')
    
    print("\nTraining complete. Artifacts saved in 'models/' directory.")

# This allows the script to be run from the command line
if __name__ == '__main__':
    train_pipeline()