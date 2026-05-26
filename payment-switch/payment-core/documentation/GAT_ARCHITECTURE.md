# Fraud GNN - Graph Attention Network (GAT) Architecture

**Author:** Manus AI
**Date:** November 3, 2025

## 1. Overview

The Fraud Graph Neural Network (GNN) is built upon a Graph Attention Network (GAT) architecture, designed to capture complex relationships within transaction graphs and identify fraudulent activities. The model processes a graph where nodes represent accounts and edges represent transactions. By leveraging attention mechanisms, the model learns to assign different levels of importance to neighboring nodes, allowing it to effectively identify subtle patterns indicative of fraud.

This document provides a detailed breakdown of the GAT architecture as implemented in the `FraudGNN` class within the training pipeline.

## 2. Model Configuration

The model is initialized with the following key parameters:

| Parameter | Description | Default Value |
|---|---|---|
| `num_node_features` | The number of features for each node in the graph. | *Dynamic* |
| `hidden_channels` | The number of hidden channels in the GAT layers. | 128 |
| `num_heads` | The number of attention heads in each GAT layer. | 4 |
| `dropout` | The dropout rate applied to the GAT layers and classifier. | 0.3 |

## 3. Core Architecture

The network consists of three GAT convolutional layers followed by a classification head. The architecture is designed to learn increasingly complex representations of the transaction graph.

### 3.1. Graph Attention (GAT) Layers

The core of the model is a stack of three `GATConv` layers from the PyTorch Geometric library. Each layer applies the graph attention mechanism, allowing nodes to selectively attend to their neighbors.

#### Layer 1: GATConv-1

*   **Input:** Node features `x` with shape `[num_nodes, num_node_features]` and edge index `edge_index` with shape `[2, num_edges]`.
*   **Operation:** `GATConv(in_channels=num_node_features, out_channels=128, heads=4, dropout=0.3)`
*   **Output Shape:** `[num_nodes, 512]` (since `hidden_channels * num_heads` = 128 * 4)
*   **Activation:** Exponential Linear Unit (ELU) is applied after the convolution.
*   **Regularization:** A dropout with a rate of 0.3 is applied after the activation function.

#### Layer 2: GATConv-2

*   **Input:** The output from the first GAT layer, with shape `[num_nodes, 512]`.
*   **Operation:** `GATConv(in_channels=512, out_channels=128, heads=4, dropout=0.3)`
*   **Output Shape:** `[num_nodes, 512]`
*   **Activation:** ELU is applied after the convolution.
*   **Regularization:** A dropout with a rate of 0.3 is applied after the activation function.

#### Layer 3: GATConv-3 (Final Attention Layer)

*   **Input:** The output from the second GAT layer, with shape `[num_nodes, 512]`.
*   **Operation:** `GATConv(in_channels=512, out_channels=128, heads=1, dropout=0.3)`
*   **Output Shape:** `[num_nodes, 128]` (since `heads=1`, the output is not concatenated)
*   **Activation:** ELU is applied after the convolution.

### 3.2. Global Pooling

After the GAT layers, a global mean pooling operation (`global_mean_pool`) is applied. This aggregates the node features across the entire graph to produce a single graph-level representation.

*   **Input:** The output from the third GAT layer, with shape `[num_nodes, 128]`.
*   **Output Shape:** `[batch_size, 128]`

### 3.3. Classification Head

The graph-level representation is then passed through a two-layer feed-forward network for classification.

#### Layer 1: Fully Connected

*   **Operation:** `Linear(in_features=128, out_features=64)`
*   **Activation:** ReLU
*   **Regularization:** Dropout with a rate of 0.3

#### Layer 2: Fully Connected

*   **Operation:** `Linear(in_features=64, out_features=32)`
*   **Activation:** ReLU
*   **Regularization:** Dropout with a rate of 0.3

#### Output Layer

*   **Operation:** `Linear(in_features=32, out_features=2)`
*   **Activation:** `LogSoftmax` (applied along dimension 1)

This produces the final output, which represents the log-probabilities of the two classes (non-fraudulent and fraudulent).

## 4. Network Diagram

```
+-----------------------+
|   Input Node Features   |
| [num_nodes, num_features] |
+-----------------------+
            |
            v
+-----------------------+
| GATConv-1 (heads=4)   |
| Activation: ELU       |
| Dropout: 0.3          |
| Output: [num_nodes, 512]|
+-----------------------+
            |
            v
+-----------------------+
| GATConv-2 (heads=4)   |
| Activation: ELU       |
| Dropout: 0.3          |
| Output: [num_nodes, 512]|
+-----------------------+
            |
            v
+-----------------------+
| GATConv-3 (heads=1)   |
| Activation: ELU       |
| Output: [num_nodes, 128]|
+-----------------------+
            |
            v
+-----------------------+
|  Global Mean Pooling  |
| Output: [batch_size, 128]|
+-----------------------+
            |
            v
+-----------------------+
|   FC-1 (128 -> 64)    |
|   Activation: ReLU    |
|   Dropout: 0.3        |
+-----------------------+
            |
            v
+-----------------------+
|   FC-2 (64 -> 32)     |
|   Activation: ReLU    |
|   Dropout: 0.3        |
+-----------------------+
            |
            v
+-----------------------+
|   Output (32 -> 2)    |
| Activation: LogSoftmax|
+-----------------------+
```

## 5. Implementation Details

The model is implemented using PyTorch and the PyTorch Geometric library. The use of ELU activation functions helps to prevent vanishing gradients, while dropout provides regularization to prevent overfitting. The multi-head attention mechanism allows the model to capture different types of relationships between nodes in the graph.

This architecture is specifically designed for fraud detection in transaction networks, where the relationships between accounts are crucial for identifying fraudulent patterns.
