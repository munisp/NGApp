"""
Ollama Fine-Tuning Pipeline for Nigerian Insurance Expertise

This script creates a fine-tuned Ollama model specialized in Nigerian insurance
regulations, policies, and underwriting practices.
"""

import json
import os
import subprocess
from typing import List, Dict
from pathlib import Path


class OllamaFineTuningPipeline:
    """Pipeline for fine-tuning Ollama models on Nigerian insurance data."""

    def __init__(
        self,
        base_model: str = "qwen2.5:latest",
        output_model_name: str = "nigerian-insurance-expert",
        training_data_path: str = "./nigerian_insurance_dataset.jsonl",
    ):
        """
        Initialize the fine-tuning pipeline.

        Args:
            base_model: Base Ollama model to fine-tune
            output_model_name: Name for the fine-tuned model
            training_data_path: Path to training data (JSONL format)
        """
        self.base_model = base_model
        self.output_model_name = output_model_name
        self.training_data_path = training_data_path
        self.modelfile_path = "./Modelfile"

    def create_modelfile(self, system_prompt: str) -> None:
        """
        Create a Modelfile for the fine-tuned model.

        Args:
            system_prompt: System prompt defining the model's expertise
        """
        modelfile_content = f"""FROM {self.base_model}

# Set the temperature to 0.1 for consistent, factual responses
PARAMETER temperature 0.1

# Set the top_p to 0.9 for focused responses
PARAMETER top_p 0.9

# Set the context window to 8192 tokens
PARAMETER num_ctx 8192

# System prompt defining the model's expertise
SYSTEM \"\"\"
{system_prompt}
\"\"\"
"""

        with open(self.modelfile_path, "w") as f:
            f.write(modelfile_content)

        print(f"✓ Modelfile created at {self.modelfile_path}")

    def create_system_prompt(self) -> str:
        """Create a comprehensive system prompt for Nigerian insurance expertise."""
        return """You are a Nigerian Insurance Expert AI, specialized in the Nigerian insurance industry, regulations, and underwriting practices.

**Your Expertise Includes:**

1. **Nigerian Insurance Regulations:**
   - Nigerian Insurance Industry Reform Act (NIIRA) 2025
   - Insurance Act 2003
   - NAICOM Guidelines and Circulars
   - Market Conduct and Business Practice Guidelines
   - Corporate Governance Guidelines for Insurance Companies

2. **Regulatory Bodies:**
   - National Insurance Commission (NAICOM): Primary regulator
   - Central Bank of Nigeria (CBN): For bancassurance and financial stability
   - Securities and Exchange Commission (SEC): For insurance-linked securities

3. **Capital Requirements (NIIRA 2025):**
   - Life Insurance: ₦10 billion minimum capital
   - Non-Life Insurance: ₦15 billion minimum capital
   - Reinsurance: ₦35 billion minimum capital
   - Composite Insurance: ₦25 billion minimum capital

4. **Key Regulatory Provisions:**
   - No Premium, No Cover Rule (Section 50, Insurance Act 2003)
   - Compulsory Insurance: Motor Third Party, Group Life, Professional Indemnity, etc.
   - Risk-Based Supervision Framework
   - Solvency Margin Requirements
   - Investment Guidelines for Policy Holders' Funds

5. **Insurance Products:**
   - Life Insurance: Term Life, Whole Life, Endowment, Annuities
   - General Insurance: Motor, Fire, Marine, Aviation, Engineering, etc.
   - Health Insurance: HMO-based, Indemnity-based
   - Micro-Insurance: Affordable products for low-income populations

6. **Underwriting Practices:**
   - Risk Assessment and Classification
   - Premium Calculation Methods
   - Reinsurance Arrangements
   - Claims Management and Settlement
   - Fraud Detection and Prevention

7. **Market Conduct:**
   - Fair Treatment of Customers
   - Disclosure Requirements
   - Complaints Handling
   - Anti-Money Laundering (AML) and Know Your Customer (KYC)

**Your Responsibilities:**
- Provide accurate, up-to-date information on Nigerian insurance regulations
- Assist with underwriting decisions based on Nigerian market practices
- Explain complex insurance concepts in clear, accessible language
- Ensure compliance with NAICOM guidelines and Nigerian laws
- Support risk assessment and pricing for Nigerian insurance products

**Your Approach:**
- Always cite specific sections of relevant Acts or Guidelines when applicable
- Provide context-specific advice tailored to the Nigerian insurance market
- Flag potential compliance issues or regulatory concerns
- Recommend best practices aligned with NAICOM standards
- Use Nigerian currency (Naira, ₦) and local terminology

**Important Notes:**
- You are knowledgeable about Nigerian insurance as of January 2026
- Always prioritize policyholder protection and regulatory compliance
- When uncertain, recommend consulting with NAICOM or legal counsel
- Recognize the unique challenges of the Nigerian market (e.g., low penetration, fraud, informal sector)
"""

    def load_training_data(self) -> List[Dict[str, str]]:
        """Load training data from JSONL file."""
        training_data = []
        with open(self.training_data_path, "r") as f:
            for line in f:
                training_data.append(json.loads(line))
        
        print(f"✓ Loaded {len(training_data)} training examples")
        return training_data

    def create_model(self) -> None:
        """Create the fine-tuned model using Ollama."""
        print(f"\n🚀 Creating fine-tuned model: {self.output_model_name}")
        
        # Create the model from Modelfile
        result = subprocess.run(
            ["ollama", "create", self.output_model_name, "-f", self.modelfile_path],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print(f"✓ Model {self.output_model_name} created successfully!")
            print(result.stdout)
        else:
            print(f"✗ Error creating model:")
            print(result.stderr)
            raise Exception("Model creation failed")

    def test_model(self, test_prompts: List[str]) -> None:
        """Test the fine-tuned model with sample prompts."""
        print(f"\n🧪 Testing model: {self.output_model_name}")
        
        for i, prompt in enumerate(test_prompts, 1):
            print(f"\n--- Test {i} ---")
            print(f"Prompt: {prompt}")
            
            result = subprocess.run(
                ["ollama", "run", self.output_model_name, prompt],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                print(f"Response: {result.stdout}")
            else:
                print(f"Error: {result.stderr}")

    def export_model(self, export_path: str = "./models") -> None:
        """Export the fine-tuned model for deployment."""
        os.makedirs(export_path, exist_ok=True)
        
        print(f"\n📦 Exporting model to {export_path}")
        
        # Save model info
        model_info = {
            "name": self.output_model_name,
            "base_model": self.base_model,
            "created_at": subprocess.run(
                ["date", "-Iseconds"],
                capture_output=True,
                text=True,
            ).stdout.strip(),
            "description": "Fine-tuned Ollama model specialized in Nigerian insurance regulations and underwriting",
        }

        with open(f"{export_path}/{self.output_model_name}_info.json", "w") as f:
            json.dump(model_info, f, indent=2)

        print(f"✓ Model info saved to {export_path}/{self.output_model_name}_info.json")

    def run_pipeline(self) -> None:
        """Run the complete fine-tuning pipeline."""
        print("=" * 80)
        print("OLLAMA FINE-TUNING PIPELINE FOR NIGERIAN INSURANCE EXPERTISE")
        print("=" * 80)

        # Step 1: Create system prompt
        print("\n📝 Step 1: Creating system prompt...")
        system_prompt = self.create_system_prompt()

        # Step 2: Create Modelfile
        print("\n📝 Step 2: Creating Modelfile...")
        self.create_modelfile(system_prompt)

        # Step 3: Load training data
        print("\n📚 Step 3: Loading training data...")
        training_data = self.load_training_data()

        # Step 4: Create model
        print("\n🔨 Step 4: Creating fine-tuned model...")
        self.create_model()

        # Step 5: Test model
        print("\n🧪 Step 5: Testing model...")
        test_prompts = [
            "What is the minimum capital requirement for a life insurance company in Nigeria?",
            "Explain the 'No Premium, No Cover' rule.",
            "What are the duties of NAICOM?",
            "What types of insurance are compulsory in Nigeria?",
        ]
        self.test_model(test_prompts)

        # Step 6: Export model
        print("\n📦 Step 6: Exporting model...")
        self.export_model()

        print("\n" + "=" * 80)
        print("✓ PIPELINE COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print(f"\nYour fine-tuned model '{self.output_model_name}' is ready to use!")
        print(f"\nTo use it:")
        print(f"  ollama run {self.output_model_name}")


def main():
    """Main function to run the fine-tuning pipeline."""
    pipeline = OllamaFineTuningPipeline(
        base_model="qwen2.5:latest",
        output_model_name="nigerian-insurance-expert",
        training_data_path="./nigerian_insurance_dataset.jsonl",
    )

    pipeline.run_pipeline()


if __name__ == "__main__":
    main()
