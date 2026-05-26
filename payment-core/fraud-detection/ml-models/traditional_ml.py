"""
Traditional Machine Learning Models for Fraud Detection

This module implements gradient boosting and ensemble models for fraud detection.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier
import joblib


class XGBoostFraudDetector:
    """
    XGBoost-based fraud detector with optimized hyperparameters.
    """
    
    def __init__(
        self,
        max_depth: int = 8,
        learning_rate: float = 0.1,
        n_estimators: int = 200,
        scale_pos_weight: float = 10.0,
        random_state: int = 42
    ):
        self.model = xgb.XGBClassifier(
            max_depth=max_depth,
            learning_rate=learning_rate,
            n_estimators=n_estimators,
            scale_pos_weight=scale_pos_weight,  # Handle imbalanced data
            objective='binary:logistic',
            eval_metric='auc',
            use_label_encoder=False,
            random_state=random_state,
            tree_method='hist',  # Faster training
            enable_categorical=True
        )
        self.scaler = StandardScaler()
        self.feature_names = None
        
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        eval_set: Optional[List[Tuple]] = None,
        early_stopping_rounds: int = 50
    ):
        """Train the XGBoost model."""
        self.feature_names = X.columns.tolist()
        X_scaled = self.scaler.fit_transform(X)
        
        if eval_set:
            eval_set_scaled = [(self.scaler.transform(X_val), y_val) 
                              for X_val, y_val in eval_set]
            self.model.fit(
                X_scaled, y,
                eval_set=eval_set_scaled,
                early_stopping_rounds=early_stopping_rounds,
                verbose=False
            )
        else:
            self.model.fit(X_scaled, y)
        
        return self
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict fraud probabilities."""
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)[:, 1]
        
    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance scores."""
        importance = self.model.feature_importances_
        return pd.DataFrame({
            'feature': self.feature_names,
            'importance': importance
        }).sort_values('importance', ascending=False)


class LightGBMFraudDetector:
    """
    LightGBM-based fraud detector optimized for speed and memory efficiency.
    """
    
    def __init__(
        self,
        max_depth: int = 8,
        learning_rate: float = 0.1,
        n_estimators: int = 200,
        num_leaves: int = 31,
        scale_pos_weight: float = 10.0,
        random_state: int = 42
    ):
        self.model = lgb.LGBMClassifier(
            max_depth=max_depth,
            learning_rate=learning_rate,
            n_estimators=n_estimators,
            num_leaves=num_leaves,
            scale_pos_weight=scale_pos_weight,
            objective='binary',
            metric='auc',
            random_state=random_state,
            verbose=-1
        )
        self.scaler = StandardScaler()
        self.feature_names = None
        
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        eval_set: Optional[List[Tuple]] = None,
        early_stopping_rounds: int = 50
    ):
        """Train the LightGBM model."""
        self.feature_names = X.columns.tolist()
        X_scaled = self.scaler.fit_transform(X)
        
        if eval_set:
            eval_set_scaled = [(self.scaler.transform(X_val), y_val) 
                              for X_val, y_val in eval_set]
            self.model.fit(
                X_scaled, y,
                eval_set=eval_set_scaled,
                callbacks=[lgb.early_stopping(early_stopping_rounds, verbose=False)]
            )
        else:
            self.model.fit(X_scaled, y)
        
        return self
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict fraud probabilities."""
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)[:, 1]
        
    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance scores."""
        importance = self.model.feature_importances_
        return pd.DataFrame({
            'feature': self.feature_names,
            'importance': importance
        }).sort_values('importance', ascending=False)


class StackingEnsembleFraudDetector:
    """
    Stacking ensemble combining XGBoost, LightGBM, and CatBoost.
    
    Uses a meta-learner to combine predictions from multiple base models.
    """
    
    def __init__(
        self,
        scale_pos_weight: float = 10.0,
        random_state: int = 42
    ):
        # Base models
        self.xgb_model = XGBoostFraudDetector(
            scale_pos_weight=scale_pos_weight,
            random_state=random_state
        )
        
        self.lgb_model = LightGBMFraudDetector(
            scale_pos_weight=scale_pos_weight,
            random_state=random_state
        )
        
        self.catboost_model = CatBoostClassifier(
            depth=8,
            learning_rate=0.1,
            iterations=200,
            scale_pos_weight=scale_pos_weight,
            random_state=random_state,
            verbose=False
        )
        
        # Meta-learner (logistic regression)
        from sklearn.linear_model import LogisticRegression
        self.meta_learner = LogisticRegression(
            random_state=random_state,
            max_iter=1000
        )
        
        self.scaler = StandardScaler()
        
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        eval_set: Optional[List[Tuple]] = None
    ):
        """Train the stacking ensemble."""
        # Train base models
        print("Training XGBoost...")
        self.xgb_model.fit(X, y, eval_set=eval_set)
        
        print("Training LightGBM...")
        self.lgb_model.fit(X, y, eval_set=eval_set)
        
        print("Training CatBoost...")
        X_scaled = self.scaler.fit_transform(X)
        if eval_set:
            eval_set_scaled = [(self.scaler.transform(X_val), y_val) 
                              for X_val, y_val in eval_set]
            self.catboost_model.fit(
                X_scaled, y,
                eval_set=eval_set_scaled,
                early_stopping_rounds=50,
                verbose=False
            )
        else:
            self.catboost_model.fit(X_scaled, y, verbose=False)
        
        # Generate meta-features
        print("Training meta-learner...")
        meta_features = self._generate_meta_features(X)
        self.meta_learner.fit(meta_features, y)
        
        return self
        
    def _generate_meta_features(self, X: pd.DataFrame) -> np.ndarray:
        """Generate meta-features from base model predictions."""
        xgb_pred = self.xgb_model.predict_proba(X)
        lgb_pred = self.lgb_model.predict_proba(X)
        
        X_scaled = self.scaler.transform(X)
        catboost_pred = self.catboost_model.predict_proba(X_scaled)[:, 1]
        
        return np.column_stack([xgb_pred, lgb_pred, catboost_pred])
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict fraud probabilities using the ensemble."""
        meta_features = self._generate_meta_features(X)
        return self.meta_learner.predict_proba(meta_features)[:, 1]
        
    def get_base_predictions(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        """Get predictions from individual base models."""
        return {
            'xgboost': self.xgb_model.predict_proba(X),
            'lightgbm': self.lgb_model.predict_proba(X),
            'catboost': self.catboost_model.predict_proba(
                self.scaler.transform(X)
            )[:, 1]
        }


class FraudDetectionPipeline:
    """
    Complete fraud detection pipeline with preprocessing and model inference.
    """
    
    def __init__(
        self,
        model_type: str = 'stacking',
        scale_pos_weight: float = 10.0,
        random_state: int = 42
    ):
        self.model_type = model_type
        
        if model_type == 'xgboost':
            self.model = XGBoostFraudDetector(
                scale_pos_weight=scale_pos_weight,
                random_state=random_state
            )
        elif model_type == 'lightgbm':
            self.model = LightGBMFraudDetector(
                scale_pos_weight=scale_pos_weight,
                random_state=random_state
            )
        elif model_type == 'stacking':
            self.model = StackingEnsembleFraudDetector(
                scale_pos_weight=scale_pos_weight,
                random_state=random_state
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")
            
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        validation_split: float = 0.2
    ):
        """Train the fraud detection pipeline."""
        # Split data for validation
        from sklearn.model_selection import train_test_split
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=validation_split, stratify=y, random_state=42
        )
        
        # Train model
        eval_set = [(X_val, y_val)]
        self.model.fit(X_train, y_train, eval_set=eval_set)
        
        return self
        
    def predict(
        self,
        X: pd.DataFrame,
        threshold: float = 0.5
    ) -> np.ndarray:
        """Predict fraud labels."""
        probas = self.predict_proba(X)
        return (probas >= threshold).astype(int)
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict fraud probabilities."""
        return self.model.predict_proba(X)
        
    def save(self, filepath: str):
        """Save the trained model."""
        joblib.dump(self, filepath)
        
    @staticmethod
    def load(filepath: str) -> 'FraudDetectionPipeline':
        """Load a trained model."""
        return joblib.load(filepath)
        
    def evaluate(
        self,
        X: pd.DataFrame,
        y: pd.Series
    ) -> Dict[str, float]:
        """Evaluate model performance."""
        from sklearn.metrics import (
            roc_auc_score, precision_recall_curve, auc,
            precision_score, recall_score, f1_score
        )
        
        y_pred_proba = self.predict_proba(X)
        y_pred = self.predict(X)
        
        # Calculate metrics
        roc_auc = roc_auc_score(y, y_pred_proba)
        
        precision_curve, recall_curve, _ = precision_recall_curve(y, y_pred_proba)
        pr_auc = auc(recall_curve, precision_curve)
        
        precision = precision_score(y, y_pred)
        recall = recall_score(y, y_pred)
        f1 = f1_score(y, y_pred)
        
        return {
            'roc_auc': roc_auc,
            'pr_auc': pr_auc,
            'precision': precision,
            'recall': recall,
            'f1_score': f1
        }
