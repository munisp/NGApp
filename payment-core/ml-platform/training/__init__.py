"""
Payment Switch ML Training Pipeline

Modules:
  train_all_models      Full training of GNN + XGBoost + LightGBM + Ensemble + RF
  fine_tune             Fine-tune existing weights with new data
  continuous_training   Scheduled retraining with drift detection
  ray_distributed       Distributed training via Ray
  inference             Load weights and run predictions
"""
