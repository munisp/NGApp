# Fraud GNN Model Optimization: A Proposal to Reduce False Negatives

**Author:** Manus AI
**Date:** November 3, 2025

## 1. Introduction

This document outlines a proposal for the next phase of optimization for the Fraud Graph Neural Network (GNN) model. Following a detailed analysis of the model's current performance, we have identified key areas for improvement, with a primary focus on **reducing false negatives** (i.e., missed fraudulent transactions). A high false negative rate poses a significant risk, and addressing it is critical to enhancing the platform's security and reliability.

This proposal is structured in two parts:

1.  **Analysis of False Negatives:** A summary of the root causes identified from the latest model evaluation.
2.  **Proposed Optimization Strategies:** Three concrete, actionable steps to mitigate these issues and improve model performance.

---


## 2. Analysis of False Negatives

An analysis of the model's performance on a simulated test set revealed a false negative rate of 15%, meaning that 15 out of 100 fraudulent transactions were missed. The root cause analysis identified several contributing factors:

### 2.1. Key Findings

*   **Class Imbalance:** Despite the use of Focal Loss, the extreme class imbalance (1% fraud rate) still biases the model towards the majority class (legitimate transactions).
*   **Novel Fraud Patterns:** The model struggles with certain types of fraud, particularly 'Card Not Present' and 'Account Takeover' fraud, which may have distinct characteristics not fully captured in the training data.
*   **Transaction Characteristics:** False negatives are more likely to occur with high-value transactions and transactions that have low graph connectivity (i.e., involving new or isolated accounts).
*   **Model Architecture:** The current three-layer GAT architecture may be too shallow to learn the highly complex and subtle patterns associated with sophisticated fraud schemes.

### 2.2. Visual Analysis

The following visualizations illustrate the patterns observed in the false negative cases:

**False Negatives by Fraud Type**

![False Negatives by Fraud Type](/home/ubuntu/false_negative_analysis.png)

**Transaction Characteristics (False Negatives vs. True Positives)**

*   **Transaction Amount:** False negatives tend to have higher transaction amounts.
*   **Time of Day:** False negatives are more frequent during off-peak hours.
*   **Graph Connectivity:** False negatives often involve nodes with fewer connections in the transaction graph.

---

## 3. Proposed Optimization Strategies

Based on the analysis of false negatives, we propose the following three optimization strategies to be implemented in a phased approach. The primary objective is to increase recall and reduce the false negative rate, with an acceptable trade-off in precision.

### Strategy 1: Implement a Cost-Sensitive Focal Loss

**Problem:** The current Focal Loss implementation, while an improvement over standard Cross-Entropy, does not sufficiently penalize the misclassification of fraudulent transactions. The model can still achieve a low overall loss by correctly classifying the vast majority of legitimate transactions, even if it misses a significant portion of the fraud cases.

**Solution:** Introduce a cost-sensitive version of the Focal Loss that applies a higher penalty for false negatives. This is achieved by modifying the `alpha` parameter of the Focal Loss to be asymmetric, giving a much higher weight to the fraud class.

#### Implementation Details

A `CostSensitiveFocalLoss` class will be implemented to accept a `weight` parameter, which will be a tensor of weights for each class.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class CostSensitiveFocalLoss(nn.Module):
    def __init__(self, gamma=2.0, weight=None, reduction='mean'):
        super(CostSensitiveFocalLoss, self).__init__()
        self.gamma = gamma
        self.weight = weight
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        
        if self.weight is not None:
            alpha = self.weight[targets]
            focal_loss = alpha * (1 - pt) ** self.gamma * ce_loss
        else:
            focal_loss = (1 - pt) ** self.gamma * ce_loss

        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss
```

**Integration:**

In the training pipeline, a weight tensor will be defined to assign a significantly higher weight to the fraud class (e.g., 10x or more).

```python
# Define class weights (e.g., 10:1 ratio for fraud vs. legitimate)
class_weights = torch.tensor([1.0, 10.0]).to(device)

# Use CostSensitiveFocalLoss
criterion = CostSensitiveFocalLoss(gamma=2.0, weight=class_weights)
```

**Expected Outcome:** A significant reduction in false negatives, as the model will be heavily penalized for misclassifying fraudulent transactions. This will likely come at the cost of a slight increase in false positives, which is an acceptable trade-off in most fraud detection scenarios.

### Strategy 2: Enhance Graph Representation with Temporal Features and Heterogeneous Nodes

**Problem:** The current graph representation is relatively simple, with nodes representing accounts and edges representing transactions. It does not explicitly capture the temporal dynamics of transactions or the different types of entities involved (e.g., merchants, devices).

**Solution:** Evolve the graph into a **heterogeneous temporal graph**. This will involve:

1.  **Adding Temporal Features:** Incorporate time-based features for both nodes and edges, such as time since the last transaction, average transaction frequency, and time of day.
2.  **Introducing New Node Types:** Add new node types to the graph, such as `Merchant`, `Device`, and `Location`, to create a richer, more contextual representation of the transaction ecosystem.

#### Implementation Details

This will require modifications to the `construct_transaction_graph` method and the GNN model itself to handle the heterogeneous graph structure using `HeteroData` and `HeteroConv` from PyTorch Geometric.

**Graph Construction:**

```python
from torch_geometric.data import HeteroData

data = HeteroData()
data['account'].x = ...
data['merchant'].x = ...
data['account', 'pays', 'merchant'].edge_index = ...
data['account', 'pays', 'merchant'].edge_attr = ... # [time_since_last_txn, hour_of_day]
```

**Model Architecture:**

```python
from torch_geometric.nn import HeteroConv, GATConv

class HeteroGNN(torch.nn.Module):
    def __init__(self, hidden_channels, out_channels, num_heads):
        super().__init__()
        self.conv1 = HeteroConv({
            (src, rel, dst): GATConv((-1, -1), hidden_channels, heads=num_heads) 
            for src, rel, dst in data.metadata()[1]
        })
        # ... more layers
```

**Expected Outcome:** The model will be able to learn more complex fraud patterns that involve interactions between different entity types and temporal sequences. For example, it could identify a single device being used for multiple new accounts or a sudden burst of transactions at an unusual time.

### Strategy 3: Deeper GAT Architecture with Residual Connections

**Problem:** The current three-layer GAT architecture may be too shallow to capture long-range dependencies and highly complex fraud patterns within the transaction graph.

**Solution:** Increase the depth of the GAT network to 5 or 6 layers and introduce **residual connections** to prevent vanishing gradients and improve training stability. Residual connections allow the model to learn both shallow and deep features, making it more robust.

#### Implementation Details

The `FraudGNN` model will be modified to include more `GATConv` layers with a residual connection around each layer.

```python
class DeeperFraudGNN(nn.Module):
    def __init__(self, ...):
        super(DeeperFraudGNN, self).__init__()
        # ... define more conv layers

    def forward(self, x, edge_index):
        x1 = F.elu(self.conv1(x, edge_index))
        x2 = F.elu(self.conv2(x1, edge_index))
        x = x1 + x2 # Residual connection
        # ... more layers
```

**Expected Outcome:** A deeper architecture will enable the model to learn more abstract and complex representations of the transaction graph, potentially capturing sophisticated fraud rings and collusive behaviors that are missed by the current model. The residual connections will ensure that the deeper model can be trained effectively.

---

## 4. Conclusion and Next Steps

These three optimization strategies provide a clear path forward for improving the performance of the Fraud GNN model and reducing false negatives. By implementing a cost-sensitive loss function, enriching the graph representation, and deepening the model architecture, we can create a more robust and accurate fraud detection system.

We recommend implementing and evaluating these strategies sequentially to measure the impact of each change. The next step is to begin with the implementation of the **Cost-Sensitive Focal Loss**, as it is the most direct and impactful change to address the false negative problem.
