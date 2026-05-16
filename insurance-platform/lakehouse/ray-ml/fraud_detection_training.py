"""
Ray ML Fraud Detection Model Training

This script trains a fraud detection model using Ray for distributed training
and reads data from the lakehouse Silver layer.
"""

import ray
from ray import train
from ray.train import ScalingConfig
from ray.train.xgboost import XGBoostTrainer
from ray.data import read_parquet
import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import os
import joblib
from datetime import datetime


@ray.remote
class FraudDetectionModelTrainer:
    """Ray actor for training fraud detection model"""
    
    def __init__(self, data_path, model_output_path):
        self.data_path = data_path
        self.model_output_path = model_output_path
        self.model = None
        self.feature_columns = []
        
    def load_data(self):
        """Load training data from lakehouse"""
        print(f"Loading data from: {self.data_path}")
        
        # Read from Delta Lake/Parquet
        ds = read_parquet(self.data_path)
        df = ds.to_pandas()
        
        print(f"Loaded {len(df)} records")
        return df
    
    def engineer_features(self, df):
        """Engineer features for fraud detection"""
        print("Engineering features...")
        
        # Time-based features
        df['hour_of_day'] = pd.to_datetime(df['event_timestamp']).dt.hour
        df['day_of_week'] = pd.to_datetime(df['event_timestamp']).dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Amount-based features
        df['amount_log'] = np.log1p(df['amount'])
        df['amount_zscore'] = (df['amount'] - df['amount'].mean()) / df['amount'].std()
        
        # Customer behavior features (aggregated)
        customer_stats = df.groupby('customer_id').agg({
            'amount': ['mean', 'std', 'min', 'max', 'count'],
            'payment_id': 'count'
        }).reset_index()
        customer_stats.columns = ['customer_id', 'customer_avg_amount', 'customer_std_amount',
                                   'customer_min_amount', 'customer_max_amount', 
                                   'customer_amount_count', 'customer_payment_count']
        
        df = df.merge(customer_stats, on='customer_id', how='left')
        
        # Amount deviation from customer average
        df['amount_deviation_from_avg'] = (df['amount'] - df['customer_avg_amount']) / (df['customer_std_amount'] + 1)
        
        # Payment type encoding
        df['payment_type_encoded'] = df['payment_type'].astype('category').cat.codes
        
        # Payment method encoding
        df['payment_method_encoded'] = df['payment_method'].astype('category').cat.codes if 'payment_method' in df.columns else 0
        
        # Status encoding (for historical data with known outcomes)
        df['is_fraud'] = ((df['status'] == 'FAILED') & (df['failure_reason'].str.contains('fraud', case=False, na=False))).astype(int)
        
        # Feature columns
        self.feature_columns = [
            'amount', 'amount_log', 'amount_zscore',
            'hour_of_day', 'day_of_week', 'is_weekend',
            'customer_avg_amount', 'customer_std_amount',
            'customer_min_amount', 'customer_max_amount',
            'customer_payment_count', 'amount_deviation_from_avg',
            'payment_type_encoded', 'payment_method_encoded'
        ]
        
        # Fill missing values
        df[self.feature_columns] = df[self.feature_columns].fillna(0)
        
        print(f"Engineered {len(self.feature_columns)} features")
        return df
    
    def train_model(self, X_train, y_train, X_val, y_val):
        """Train XGBoost fraud detection model"""
        print("Training XGBoost model...")
        
        # Calculate scale_pos_weight for imbalanced dataset
        scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
        
        # XGBoost parameters
        params = {
            'objective': 'binary:logistic',
            'eval_metric': 'auc',
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 200,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'scale_pos_weight': scale_pos_weight,
            'tree_method': 'hist',
            'random_state': 42
        }
        
        # Train model
        self.model = xgb.XGBClassifier(**params)
        
        eval_set = [(X_train, y_train), (X_val, y_val)]
        self.model.fit(
            X_train, y_train,
            eval_set=eval_set,
            early_stopping_rounds=20,
            verbose=True
        )
        
        print("Model training completed")
        return self.model
    
    def evaluate_model(self, X_test, y_test):
        """Evaluate model performance"""
        print("Evaluating model...")
        
        # Predictions
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        # Metrics
        auc_score = roc_auc_score(y_test, y_pred_proba)
        print(f"ROC AUC Score: {auc_score:.4f}")
        
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        print("\nConfusion Matrix:")
        print(confusion_matrix(y_test, y_pred))
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_columns,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print("\nTop 10 Important Features:")
        print(feature_importance.head(10))
        
        return {
            'auc_score': auc_score,
            'feature_importance': feature_importance.to_dict()
        }
    
    def save_model(self):
        """Save trained model"""
        print(f"Saving model to: {self.model_output_path}")
        
        os.makedirs(self.model_output_path, exist_ok=True)
        
        # Save model
        model_file = os.path.join(self.model_output_path, 'fraud_detection_model.pkl')
        joblib.dump(self.model, model_file)
        
        # Save feature columns
        features_file = os.path.join(self.model_output_path, 'feature_columns.pkl')
        joblib.dump(self.feature_columns, features_file)
        
        # Save metadata
        metadata = {
            'model_type': 'XGBoost',
            'model_version': datetime.now().strftime('%Y%m%d_%H%M%S'),
            'feature_count': len(self.feature_columns),
            'features': self.feature_columns,
            'training_date': datetime.now().isoformat()
        }
        
        metadata_file = os.path.join(self.model_output_path, 'model_metadata.json')
        import json
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print("Model saved successfully")
    
    def run_training_pipeline(self):
        """Run complete training pipeline"""
        print("=" * 80)
        print("Fraud Detection Model Training Pipeline")
        print("=" * 80)
        
        # Load data
        df = self.load_data()
        
        # Engineer features
        df = self.engineer_features(df)
        
        # Prepare train/val/test split
        X = df[self.feature_columns]
        y = df['is_fraud']
        
        # Split data: 70% train, 15% validation, 15% test
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
        
        print(f"Train set: {len(X_train)} samples")
        print(f"Validation set: {len(X_val)} samples")
        print(f"Test set: {len(X_test)} samples")
        print(f"Fraud rate: {y.mean():.2%}")
        
        # Train model
        self.train_model(X_train, y_train, X_val, y_val)
        
        # Evaluate model
        metrics = self.evaluate_model(X_test, y_test)
        
        # Save model
        self.save_model()
        
        print("=" * 80)
        print("Training pipeline completed successfully")
        print(f"Model AUC Score: {metrics['auc_score']:.4f}")
        print("=" * 80)
        
        return metrics


def train_fraud_detection_model_distributed():
    """Train fraud detection model using Ray for distributed training"""
    
    # Initialize Ray
    if not ray.is_initialized():
        ray.init(address='auto', ignore_reinit_error=True)
    
    print("Ray cluster initialized")
    print(f"Available resources: {ray.available_resources()}")
    
    # Configuration
    data_path = "s3a://lakehouse/silver/payment_events"
    model_output_path = "/models/fraud_detection"
    
    # Create trainer actor
    trainer = FraudDetectionModelTrainer.remote(data_path, model_output_path)
    
    # Run training pipeline
    metrics = ray.get(trainer.run_training_pipeline.remote())
    
    print("Distributed training completed")
    return metrics


def main():
    """Main function"""
    
    # Set environment variables
    os.environ['AWS_ACCESS_KEY_ID'] = os.getenv('S3_ACCESS_KEY', 'minioadmin')
    os.environ['AWS_SECRET_ACCESS_KEY'] = os.getenv('S3_SECRET_KEY', 'minioadmin')
    os.environ['AWS_ENDPOINT_URL'] = os.getenv('S3_ENDPOINT', 'http://minio:9000')
    
    # Train model
    metrics = train_fraud_detection_model_distributed()
    
    print(f"\nFinal Model Performance:")
    print(f"AUC Score: {metrics['auc_score']:.4f}")


if __name__ == "__main__":
    main()
