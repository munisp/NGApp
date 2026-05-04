#!/usr/bin/env python3
"""
ML Model Trainer for Fraud Prevention System
"""

import os
import json
import time
import logging
import pickle
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.pipeline import Pipeline
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("model_trainer")

class ModelTrainer:
    """ML Model Trainer for Fraud Detection"""
    
    def __init__(self, model_dir: str = "models"):
        """Initialize the model trainer"""
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        
    def load_data(self, data_path: str) -> pd.DataFrame:
        """Load transaction data from CSV or Parquet file"""
        logger.info(f"Loading data from {data_path}")
        
        if data_path.endswith(".csv"):
            df = pd.read_csv(data_path)
        elif data_path.endswith(".parquet"):
            df = pd.read_parquet(data_path)
        else:
            raise ValueError("Unsupported file format. Use CSV or Parquet.")
        
        logger.info(f"Loaded {len(df)} records")
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Preprocess the data for training"""
        logger.info("Preprocessing data")
        
        # Check required columns
        required_columns = [
            "transaction_amount", 
            "transaction_hour", 
            "transaction_day_of_week",
            "transaction_count_24h", 
            "transaction_amount_24h",
            "new_location", 
            "new_merchant", 
            "transaction_velocity_1h",
            "is_fraud"  # Target variable
        ]
        
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"Required column {col} not found in dataset")
        
        # Convert boolean columns to integers
        bool_columns = ["new_location", "new_merchant", "is_fraud"]
        for col in bool_columns:
            if df[col].dtype == bool:
                df[col] = df[col].astype(int)
        
        # Extract features and target
        X = df.drop("is_fraud", axis=1)
        y = df["is_fraud"]
        
        logger.info(f"Preprocessed data: {X.shape[0]} samples, {X.shape[1]} features")
        return X, y
    
    def train_model(self, X: pd.DataFrame, y: pd.Series, model_name: str = "default", test_size: float = 0.2, random_state: int = 42) -> Dict[str, Any]:
        """Train a fraud detection model"""
        logger.info(f"Training model {model_name}")
        start_time = time.time()
        
        # Split data into train and test sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        logger.info(f"Training set: {X_train.shape[0]} samples, Test set: {X_test.shape[0]} samples")
        
        # Create a pipeline with scaling and model
        scaler = StandardScaler()
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=random_state,
            class_weight="balanced",
            n_jobs=-1
        )
        
        # Fit the scaler
        X_train_scaled = scaler.fit_transform(X_train)
        
        # Train the model
        model.fit(X_train_scaled, y_train)
        
        # Evaluate the model
        X_test_scaled = scaler.transform(X_test)
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)
        cm = confusion_matrix(y_test, y_pred)
        
        # Calculate feature importance
        feature_importance = dict(zip(X.columns, model.feature_importances_))
        
        # Save the model and scaler
        joblib.dump(model, os.path.join(self.model_dir, f"{model_name}.pkl"))
        joblib.dump(scaler, os.path.join(self.model_dir, f"{model_name}_scaler.pkl"))
        
        # Save model metadata
        metadata = {
            "model_name": model_name,
            "model_type": model.__class__.__name__,
            "training_date": datetime.now().isoformat(),
            "training_time": time.time() - start_time,
            "feature_count": X.shape[1],
            "sample_count": X.shape[0],
            "metrics": {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "auc": auc,
                "confusion_matrix": cm.tolist()
            },
            "feature_importance": feature_importance,
            "model_parameters": model.get_params(),
            "features": list(X.columns)
        }
        
        with open(os.path.join(self.model_dir, f"{model_name}_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Model training completed in {time.time() - start_time:.2f} seconds")
        logger.info(f"Model metrics: Accuracy={accuracy:.4f}, Precision={precision:.4f}, Recall={recall:.4f}, F1={f1:.4f}, AUC={auc:.4f}")
        
        return metadata
    
    def hyperparameter_tuning(self, X: pd.DataFrame, y: pd.Series, model_name: str = "tuned", test_size: float = 0.2, random_state: int = 42) -> Dict[str, Any]:
        """Perform hyperparameter tuning for the model"""
        logger.info(f"Performing hyperparameter tuning for model {model_name}")
        start_time = time.time()
        
        # Split data into train and test sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # Create a pipeline with scaling and model
        pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', RandomForestClassifier(random_state=random_state))
        ])
        
        # Define hyperparameter grid
        param_grid = {
            'classifier__n_estimators': [50, 100, 200],
            'classifier__max_depth': [5, 10, 15, None],
            'classifier__min_samples_split': [2, 5, 10],
            'classifier__min_samples_leaf': [1, 2, 4],
            'classifier__class_weight': ['balanced', None]
        }
        
        # Perform grid search
        grid_search = GridSearchCV(
            pipeline,
            param_grid=param_grid,
            cv=5,
            scoring='f1',
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        # Get best model
        best_model = grid_search.best_estimator_
        best_params = grid_search.best_params_
        
        # Extract the scaler and classifier from the pipeline
        scaler = best_model.named_steps['scaler']
        classifier = best_model.named_steps['classifier']
        
        # Evaluate the model
        y_pred = best_model.predict(X_test)
        y_prob = best_model.predict_proba(X_test)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)
        cm = confusion_matrix(y_test, y_pred)
        
        # Calculate feature importance
        feature_importance = dict(zip(X.columns, classifier.feature_importances_))
        
        # Save the model and scaler
        joblib.dump(classifier, os.path.join(self.model_dir, f"{model_name}.pkl"))
        joblib.dump(scaler, os.path.join(self.model_dir, f"{model_name}_scaler.pkl"))
        
        # Save model metadata
        metadata = {
            "model_name": model_name,
            "model_type": classifier.__class__.__name__,
            "training_date": datetime.now().isoformat(),
            "training_time": time.time() - start_time,
            "feature_count": X.shape[1],
            "sample_count": X.shape[0],
            "metrics": {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "auc": auc,
                "confusion_matrix": cm.tolist()
            },
            "feature_importance": feature_importance,
            "model_parameters": classifier.get_params(),
            "best_parameters": best_params,
            "features": list(X.columns)
        }
        
        with open(os.path.join(self.model_dir, f"{model_name}_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Hyperparameter tuning completed in {time.time() - start_time:.2f} seconds")
        logger.info(f"Best parameters: {best_params}")
        logger.info(f"Model metrics: Accuracy={accuracy:.4f}, Precision={precision:.4f}, Recall={recall:.4f}, F1={f1:.4f}, AUC={auc:.4f}")
        
        return metadata
    
    def generate_model_report(self, model_name: str = "default") -> str:
        """Generate a report for the trained model"""
        logger.info(f"Generating report for model {model_name}")
        
        # Load model metadata
        metadata_path = os.path.join(self.model_dir, f"{model_name}_metadata.json")
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Model metadata not found: {metadata_path}")
        
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Create report directory
        report_dir = os.path.join(self.model_dir, "reports")
        os.makedirs(report_dir, exist_ok=True)
        
        # Generate confusion matrix plot
        cm = np.array(metadata["metrics"]["confusion_matrix"])
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False)
        plt.title(f"Confusion Matrix - {model_name}")
        plt.ylabel("Actual")
        plt.xlabel("Predicted")
        plt.tight_layout()
        cm_path = os.path.join(report_dir, f"{model_name}_confusion_matrix.png")
        plt.savefig(cm_path)
        plt.close()
        
        # Generate feature importance plot
        feature_importance = metadata["feature_importance"]
        features = list(feature_importance.keys())
        importances = list(feature_importance.values())
        
        # Sort by importance
        indices = np.argsort(importances)
        features = [features[i] for i in indices]
        importances = [importances[i] for i in indices]
        
        plt.figure(figsize=(10, 8))
        plt.barh(range(len(features)), importances, align="center")
        plt.yticks(range(len(features)), features)
        plt.title(f"Feature Importance - {model_name}")
        plt.xlabel("Importance")
        plt.tight_layout()
        fi_path = os.path.join(report_dir, f"{model_name}_feature_importance.png")
        plt.savefig(fi_path)
        plt.close()
        
        # Generate HTML report
        html_report = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Model Report - {model_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1, h2 {{ color: #2c3e50; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f2f2f2; }}
                .metric {{ font-weight: bold; }}
                .container {{ margin-bottom: 30px; }}
                img {{ max-width: 100%; height: auto; }}
            </style>
        </head>
        <body>
            <h1>Fraud Detection Model Report</h1>
            
            <div class="container">
                <h2>Model Information</h2>
                <table>
                    <tr><th>Property</th><th>Value</th></tr>
                    <tr><td>Model Name</td><td>{model_name}</td></tr>
                    <tr><td>Model Type</td><td>{metadata["model_type"]}</td></tr>
                    <tr><td>Training Date</td><td>{metadata["training_date"]}</td></tr>
                    <tr><td>Training Time</td><td>{metadata["training_time"]:.2f} seconds</td></tr>
                    <tr><td>Feature Count</td><td>{metadata["feature_count"]}</td></tr>
                    <tr><td>Sample Count</td><td>{metadata["sample_count"]}</td></tr>
                </table>
            </div>
            
            <div class="container">
                <h2>Model Performance</h2>
                <table>
                    <tr><th>Metric</th><th>Value</th></tr>
                    <tr><td>Accuracy</td><td class="metric">{metadata["metrics"]["accuracy"]:.4f}</td></tr>
                    <tr><td>Precision</td><td class="metric">{metadata["metrics"]["precision"]:.4f}</td></tr>
                    <tr><td>Recall</td><td class="metric">{metadata["metrics"]["recall"]:.4f}</td></tr>
                    <tr><td>F1 Score</td><td class="metric">{metadata["metrics"]["f1_score"]:.4f}</td></tr>
                    <tr><td>AUC</td><td class="metric">{metadata["metrics"]["auc"]:.4f}</td></tr>
                </table>
            </div>
            
            <div class="container">
                <h2>Confusion Matrix</h2>
                <img src="{os.path.basename(cm_path)}" alt="Confusion Matrix">
            </div>
            
            <div class="container">
                <h2>Feature Importance</h2>
                <img src="{os.path.basename(fi_path)}" alt="Feature Importance">
            </div>
            
            <div class="container">
                <h2>Model Parameters</h2>
                <table>
                    <tr><th>Parameter</th><th>Value</th></tr>
        """
        
        for param, value in metadata["model_parameters"].items():
            html_report += f"<tr><td>{param}</td><td>{value}</td></tr>\n"
        
        html_report += """
                </table>
            </div>
        </body>
        </html>
        """
        
        # Save HTML report
        report_path = os.path.join(report_dir, f"{model_name}_report.html")
        with open(report_path, "w") as f:
            f.write(html_report)
        
        logger.info(f"Model report generated: {report_path}")
        return report_path

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Train a fraud detection model")
    parser.add_argument("--data", required=True, help="Path to the training data (CSV or Parquet)")
    parser.add_argument("--model-dir", default="models", help="Directory to save the model")
    parser.add_argument("--model-name", default="default", help="Name of the model")
    parser.add_argument("--tune", action="store_true", help="Perform hyperparameter tuning")
    parser.add_argument("--report", action="store_true", help="Generate model report")
    
    args = parser.parse_args()
    
    trainer = ModelTrainer(args.model_dir)
    
    # Load and preprocess data
    df = trainer.load_data(args.data)
    X, y = trainer.preprocess_data(df)
    
    # Train or tune the model
    if args.tune:
        metadata = trainer.hyperparameter_tuning(X, y, args.model_name)
    else:
        metadata = trainer.train_model(X, y, args.model_name)
    
    # Generate report if requested
    if args.report:
        report_path = trainer.generate_model_report(args.model_name)
        print(f"Model report generated: {report_path}")

