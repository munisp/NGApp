_# Focal Loss Implementation for Imbalanced Datasets_

**Author:** Manus AI
**Date:** November 3, 2025

## 1. Introduction

Fraud detection is a classic example of a classification problem with severe class imbalance. The number of legitimate transactions far outweighs the number of fraudulent ones, often by several orders of magnitude. Standard loss functions, such as Cross-Entropy Loss, can be overwhelmed by the majority class (non-fraudulent transactions), leading to models that achieve high accuracy but have poor performance on the minority class (fraudulent transactions), which is the class of interest.

To address this, the **Focal Loss** function was introduced. Although the current training pipeline utilizes the standard `torch.nn.NLLLoss`, this document details the implementation and benefits of Focal Loss, which is a highly effective alternative for this use case.

## 2. The Problem with Cross-Entropy Loss

The standard Cross-Entropy (CE) loss for binary classification is defined as:

`CE(p_t) = -log(p_t)`

Where `p_t` is the model's estimated probability for the ground-truth class. While effective, this loss function treats all examples equally. In a dataset with a large number of "easy" negative examples (well-classified legitimate transactions), their cumulative loss can dominate the total loss, leading the model to prioritize the majority class at the expense of the minority class.

## 3. Focal Loss: Concept and Formulation

Focal Loss is an enhancement of the standard Cross-Entropy loss. It introduces a modulating factor `(1 - p_t)^γ` to the CE loss, which reduces the loss contribution from easy examples and increases the importance of correcting misclassified examples.

### 3.1. Mathematical Formulation

The Focal Loss is defined as:

`FL(p_t) = -α_t * (1 - p_t)^γ * log(p_t)`

Where:

*   `p_t` is the model's estimated probability for the ground-truth class.
*   `γ` (gamma) is the **focusing parameter** (`γ ≥ 0`). When `γ > 0`, the modulating factor `(1 - p_t)^γ` reduces the loss for well-classified examples (where `p_t` is close to 1), shifting the model's focus towards hard-to-classify examples.
*   `α_t` (alpha) is a **balancing parameter** (`α ∈ [0, 1]`) that can be used to balance the importance of positive and negative examples. For the class labeled 1, `α_t = α`, and for the class labeled 0, `α_t = 1 - α`.

### 3.2. Key Parameters

*   **Focusing Parameter (γ):** This parameter smoothly adjusts the rate at which easy examples are down-weighted. As `γ` increases, the effect of the modulating factor increases. The original paper found `γ = 2` to work well in practice.

*   **Balancing Parameter (α):** This parameter addresses the class imbalance by assigning a higher weight to the minority class. For example, if the fraud class is under-represented, `α` for the fraud class would be set to a value greater than 0.5.

## 4. Python Implementation in PyTorch

Below is a PyTorch implementation of the Focal Loss function. This class can be used as a direct replacement for standard loss functions like `nn.CrossEntropyLoss` or `nn.NLLLoss`.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class FocalLoss(nn.Module):
    """
    Focal Loss for imbalanced datasets.
    """
    def __init__(self, alpha=0.25, gamma=2.0, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        """
        Forward pass.

        Args:
            inputs: Model's raw, un-normalized outputs (logits) of shape (N, C).
            targets: Ground truth labels of shape (N).
        """
        # Calculate the cross-entropy loss, but without reduction
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')

        # Get the probabilities of the correct class
        pt = torch.exp(-ce_loss)

        # Calculate the focal loss
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss

        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss

```

## 5. Integration into the Training Pipeline

To use Focal Loss in the `FraudGNNTrainingPipeline`, you would replace the existing `nn.NLLLoss` criterion with an instance of the `FocalLoss` class.

### Original Code (`train_model` method):

```python
# Define optimizer and loss function
optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
criterion = nn.NLLLoss()

# ... training loop ...
# Forward pass
out = model(data.x, data.edge_index)

# Calculate loss
loss = criterion(out, data.y)
```

### Modified Code with Focal Loss:

```python
# Define optimizer and loss function
optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
# Use FocalLoss instead of NLLLoss
criterion = FocalLoss(alpha=0.25, gamma=2.0)

# ... training loop ...
# Forward pass
# Note: The model should return raw logits, not log_softmax
out = model(data.x, data.edge_index)

# Calculate loss
loss = criterion(out, data.y)
```

**Important Note:** The `FocalLoss` implementation above expects raw logits from the model, not the output of a `LogSoftmax` layer. Therefore, the final activation function in the `FraudGNN` model would need to be removed for the loss to be calculated correctly.

## 6. Conclusion

Focal Loss provides a powerful mechanism to address class imbalance in fraud detection tasks. By dynamically adjusting the loss based on the model's confidence, it forces the training process to focus on the most informative examples—the hard-to-classify fraudulent transactions. This typically leads to significant improvements in precision and recall for the minority class, resulting in a more effective and reliable fraud detection model.
