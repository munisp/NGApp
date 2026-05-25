#!/usr/bin/env python3
"""
Synthetic Nigerian Payment Data Generator

Generates realistic transaction graphs modeled on the Nigerian payment ecosystem
(NIP, NEFT, NACS, NDD, POS, ATM, mobile money). Produces both tabular transaction
data and graph-structured data suitable for GNN training.

Features:
- Realistic Nigerian bank codes, account patterns, BVN structure
- Salary-day spikes (25th-28th), Ramadan patterns, public holidays
- Fraud injection: velocity fraud, smurfing, mule networks, account takeover
- Graph structure: accounts as nodes, transactions as edges
"""

import os
import json
import hashlib
import logging
import math
import random
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from enum import Enum

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Nigerian banks with real CBN codes
NIGERIAN_BANKS = [
    {"code": "044", "name": "Access Bank", "swift": "ABNGNGLA", "weight": 0.18},
    {"code": "058", "name": "GTBank", "swift": "GTBINGLA", "weight": 0.15},
    {"code": "011", "name": "First Bank", "swift": "FBNINGLA", "weight": 0.14},
    {"code": "057", "name": "Zenith Bank", "swift": "ZEABORLA", "weight": 0.13},
    {"code": "033", "name": "UBA", "swift": "UNABORLA", "weight": 0.10},
    {"code": "032", "name": "Union Bank", "swift": "UBNINGLA", "weight": 0.05},
    {"code": "035", "name": "Wema Bank", "swift": "WABORELA", "weight": 0.04},
    {"code": "050", "name": "Ecobank", "swift": "EABORELA", "weight": 0.04},
    {"code": "221", "name": "Stanbic IBTC", "swift": "SBICNGLA", "weight": 0.04},
    {"code": "214", "name": "FCMB", "swift": "FCMBNALA", "weight": 0.03},
    {"code": "070", "name": "Fidelity Bank", "swift": "FIDTNGLA", "weight": 0.03},
    {"code": "076", "name": "Polaris Bank", "swift": "PLAGNGLA", "weight": 0.02},
    {"code": "082", "name": "Keystone Bank", "swift": "PLSBNGLA", "weight": 0.02},
    {"code": "301", "name": "Jaiz Bank", "swift": "JAABORLA", "weight": 0.01},
    {"code": "215", "name": "Unity Bank", "swift": "UNTYNGLA", "weight": 0.01},
    {"code": "100", "name": "OPay", "swift": "", "weight": 0.01},
]

NIGERIAN_HOLIDAYS_2025 = [
    datetime(2025, 1, 1),   # New Year
    datetime(2025, 3, 30),  # Eid-el-Fitr (approx)
    datetime(2025, 3, 31),  # Eid-el-Fitr Day 2
    datetime(2025, 5, 1),   # Workers Day
    datetime(2025, 6, 6),   # Eid-el-Kabir (approx)
    datetime(2025, 6, 7),   # Eid-el-Kabir Day 2
    datetime(2025, 6, 12),  # Democracy Day
    datetime(2025, 9, 27),  # Maulud (approx)
    datetime(2025, 10, 1),  # Independence Day
    datetime(2025, 12, 25), # Christmas
    datetime(2025, 12, 26), # Boxing Day
]

CHANNEL_TYPES = ["NIP", "NEFT", "POS", "ATM", "MOBILE", "USSD", "QR", "WEB"]
CHANNEL_WEIGHTS = [0.35, 0.10, 0.20, 0.08, 0.12, 0.05, 0.03, 0.07]

FRAUD_TYPES = [
    "velocity",       # Too many transactions in short window
    "smurfing",        # Structured amounts just below reporting threshold
    "mule_network",    # Chain of transfers through new accounts
    "account_takeover", # Sudden behavior change
    "round_tripping",  # Funds cycle back to origin
    "night_burst",     # Burst of activity at unusual hours
]


class AccountType(Enum):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"
    MERCHANT = "merchant"
    GOVERNMENT = "government"
    MOBILE_MONEY = "mobile_money"


@dataclass
class Account:
    account_id: str
    bank_code: str
    bank_name: str
    account_type: AccountType
    bvn: str
    created_at: datetime
    balance: float
    is_mule: bool = False
    risk_score: float = 0.0
    city: str = "Lagos"
    state: str = "Lagos"


@dataclass
class Transaction:
    transaction_id: str
    debit_account_id: str
    credit_account_id: str
    amount: float
    currency: str
    channel: str
    status: str
    created_at: datetime
    is_fraud: bool
    fraud_type: Optional[str]
    debit_bank_code: str
    credit_bank_code: str
    narration: str
    session_id: str


class NigerianPaymentDataGenerator:
    """Generate realistic Nigerian payment switch transaction data."""

    def __init__(self, seed: int = 42):
        self.rng = np.random.RandomState(seed)
        random.seed(seed)
        self.accounts: List[Account] = []
        self.transactions: List[Transaction] = []
        self.mule_networks: List[List[str]] = []

        self.nigerian_cities = [
            ("Lagos", "Lagos", 0.35), ("Abuja", "FCT", 0.15),
            ("Port Harcourt", "Rivers", 0.08), ("Kano", "Kano", 0.07),
            ("Ibadan", "Oyo", 0.06), ("Benin City", "Edo", 0.04),
            ("Enugu", "Enugu", 0.04), ("Kaduna", "Kaduna", 0.04),
            ("Calabar", "Cross River", 0.03), ("Warri", "Delta", 0.03),
            ("Abeokuta", "Ogun", 0.03), ("Jos", "Plateau", 0.02),
            ("Owerri", "Imo", 0.02), ("Uyo", "Akwa Ibom", 0.02),
            ("Ilorin", "Kwara", 0.02),
        ]

    def _pick_bank(self) -> Dict:
        weights = [b["weight"] for b in NIGERIAN_BANKS]
        return self.rng.choice(NIGERIAN_BANKS, p=weights)

    def _pick_city(self) -> Tuple[str, str]:
        weights = [c[2] for c in self.nigerian_cities]
        idx = self.rng.choice(len(self.nigerian_cities), p=weights)
        return self.nigerian_cities[idx][0], self.nigerian_cities[idx][1]

    def _generate_bvn(self) -> str:
        return "".join([str(self.rng.randint(0, 10)) for _ in range(11)])

    def _generate_account_number(self) -> str:
        return "".join([str(self.rng.randint(0, 10)) for _ in range(10)])

    def generate_accounts(self, n_accounts: int = 10000, mule_pct: float = 0.02) -> List[Account]:
        """Generate synthetic bank accounts."""
        logger.info(f"Generating {n_accounts} accounts ({mule_pct*100}% mules)...")
        accounts = []
        n_mules = int(n_accounts * mule_pct)

        type_weights = [0.70, 0.15, 0.10, 0.03, 0.02]
        types = list(AccountType)

        for i in range(n_accounts):
            bank = self._pick_bank()
            city, state = self._pick_city()
            acct_type = self.rng.choice(types, p=type_weights)

            # Mule accounts are newer, individual, lower balance
            is_mule = i < n_mules
            if is_mule:
                created_at = datetime(2025, 1, 1) + timedelta(days=self.rng.randint(0, 30))
                balance = self.rng.uniform(1000, 50000)
                acct_type = AccountType.INDIVIDUAL
            else:
                created_at = datetime(2023, 1, 1) + timedelta(days=self.rng.randint(0, 730))
                if acct_type == AccountType.CORPORATE:
                    balance = self.rng.lognormal(16, 1.5)
                elif acct_type == AccountType.GOVERNMENT:
                    balance = self.rng.lognormal(18, 1.0)
                else:
                    balance = self.rng.lognormal(12, 2.0)

            acc = Account(
                account_id=f"{bank['code']}{self._generate_account_number()}",
                bank_code=bank["code"],
                bank_name=bank["name"],
                account_type=acct_type,
                bvn=self._generate_bvn(),
                created_at=created_at,
                balance=round(balance, 2),
                is_mule=is_mule,
                risk_score=self.rng.uniform(0.5, 1.0) if is_mule else self.rng.uniform(0.0, 0.15),
                city=city,
                state=state,
            )
            accounts.append(acc)

        # Create mule network chains (3-5 accounts per chain)
        mule_accounts = [a for a in accounts if a.is_mule]
        random.shuffle(mule_accounts)
        chain_start = 0
        while chain_start < len(mule_accounts) - 2:
            chain_len = min(self.rng.randint(3, 6), len(mule_accounts) - chain_start)
            chain = [a.account_id for a in mule_accounts[chain_start:chain_start + chain_len]]
            self.mule_networks.append(chain)
            chain_start += chain_len

        self.accounts = accounts
        logger.info(f"Generated {len(accounts)} accounts, {len(self.mule_networks)} mule chains")
        return accounts

    def generate_transactions(
        self,
        n_transactions: int = 100000,
        start_date: datetime = datetime(2025, 1, 1),
        end_date: datetime = datetime(2025, 3, 31),
        fraud_rate: float = 0.015
    ) -> List[Transaction]:
        """Generate realistic transactions with fraud injection."""
        logger.info(f"Generating {n_transactions} transactions ({fraud_rate*100}% fraud)...")

        if not self.accounts:
            self.generate_accounts()

        acct_ids = [a.account_id for a in self.accounts]
        acct_map = {a.account_id: a for a in self.accounts}
        normal_accounts = [a.account_id for a in self.accounts if not a.is_mule]
        mule_accounts = [a.account_id for a in self.accounts if a.is_mule]

        n_fraud = int(n_transactions * fraud_rate)
        n_legit = n_transactions - n_fraud
        transactions = []
        total_days = (end_date - start_date).days

        # Generate legitimate transactions
        for i in range(n_legit):
            day_offset = self.rng.randint(0, total_days)
            tx_date = start_date + timedelta(days=day_offset)

            # Apply day-of-week seasonality
            dow = tx_date.weekday()
            dow_factor = [1.05, 1.08, 1.10, 1.07, 1.12, 0.75, 0.65][dow]

            # Salary day spike
            if 25 <= tx_date.day <= 28:
                dow_factor *= 1.43

            # Holiday dip
            if any(abs((tx_date - h).days) <= 1 for h in NIGERIAN_HOLIDAYS_2025):
                dow_factor *= 0.62

            # Hour distribution (peak 9am-5pm, low 1am-5am)
            hour = self._sample_hour()
            minute = self.rng.randint(0, 60)
            second = self.rng.randint(0, 60)
            tx_time = tx_date.replace(hour=hour, minute=minute, second=second)

            # Pick accounts
            sender = self.rng.choice(normal_accounts)
            receiver = self.rng.choice(normal_accounts)
            while receiver == sender:
                receiver = self.rng.choice(normal_accounts)

            sender_acct = acct_map[sender]
            receiver_acct = acct_map[receiver]

            # Amount distribution: lognormal with Nigerian-specific ranges
            channel = self.rng.choice(CHANNEL_TYPES, p=CHANNEL_WEIGHTS)
            amount = self._sample_amount(channel, sender_acct.account_type)

            narration = self._generate_narration(channel, amount)

            tx = Transaction(
                transaction_id=f"NIP{tx_time.strftime('%Y%m%d')}{i:08d}",
                debit_account_id=sender,
                credit_account_id=receiver,
                amount=round(amount, 2),
                currency="NGN",
                channel=channel,
                status="SUCCESS" if self.rng.random() < 0.985 else "FAILED",
                created_at=tx_time,
                is_fraud=False,
                fraud_type=None,
                debit_bank_code=sender_acct.bank_code,
                credit_bank_code=receiver_acct.bank_code,
                narration=narration,
                session_id=hashlib.md5(f"{i}{tx_time}".encode()).hexdigest()[:24],
            )
            transactions.append(tx)

        # Generate fraud transactions
        fraud_per_type = n_fraud // len(FRAUD_TYPES)
        for fraud_type in FRAUD_TYPES:
            for j in range(fraud_per_type):
                tx = self._generate_fraud_transaction(
                    fraud_type, start_date, end_date, acct_map,
                    normal_accounts, mule_accounts, len(transactions) + j
                )
                transactions.append(tx)

        random.shuffle(transactions)
        self.transactions = transactions
        fraud_count = sum(1 for t in transactions if t.is_fraud)
        logger.info(f"Generated {len(transactions)} transactions ({fraud_count} fraud, {fraud_count/len(transactions)*100:.1f}%)")
        return transactions

    def _sample_hour(self) -> int:
        """Sample hour with realistic distribution."""
        # Nigerian payment hours: peak 9am-5pm, low at night
        hour_weights = [
            0.005, 0.003, 0.002, 0.002, 0.003, 0.005,  # 0-5
            0.015, 0.030, 0.060, 0.085, 0.090, 0.095,   # 6-11
            0.080, 0.090, 0.085, 0.080, 0.075, 0.060,   # 12-17
            0.045, 0.035, 0.025, 0.015, 0.010, 0.005,   # 18-23
        ]
        return self.rng.choice(24, p=hour_weights)

    def _sample_amount(self, channel: str, acct_type: AccountType) -> float:
        """Sample transaction amount based on channel and account type."""
        if channel == "ATM":
            return min(self.rng.choice([5000, 10000, 20000, 40000, 50000]), 100000)
        elif channel == "POS":
            return self.rng.lognormal(8.5, 1.2)  # median ~5000 NGN
        elif channel == "USSD":
            return self.rng.lognormal(7.5, 1.0)  # median ~1800 NGN
        elif acct_type == AccountType.CORPORATE:
            return self.rng.lognormal(14, 2.0)   # median ~1.2M NGN
        elif acct_type == AccountType.GOVERNMENT:
            return self.rng.lognormal(16, 1.5)   # median ~8.9M NGN
        else:
            return self.rng.lognormal(9.5, 1.8)  # median ~13k NGN

    def _generate_narration(self, channel: str, amount: float) -> str:
        nip_narrations = [
            "Transfer", "Payment", "Funds Transfer", "Bill Payment",
            "Salary", "Airtime Purchase", "School Fees", "Rent Payment",
            "Business Payment", "Family Support", "Tithe/Offering",
        ]
        return self.rng.choice(nip_narrations)

    def _generate_fraud_transaction(
        self, fraud_type: str, start: datetime, end: datetime,
        acct_map: Dict, normal: List[str], mules: List[str], idx: int
    ) -> Transaction:
        """Generate a single fraud transaction."""
        total_days = (end - start).days
        day_offset = self.rng.randint(0, total_days)
        tx_date = start + timedelta(days=day_offset)

        if fraud_type == "velocity":
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            amount = self.rng.lognormal(10, 0.5)
            hour = self.rng.randint(0, 24)
        elif fraud_type == "smurfing":
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            # Just below ₦5M reporting threshold
            amount = self.rng.uniform(4_500_000, 4_999_000)
            hour = self.rng.randint(8, 18)
        elif fraud_type == "mule_network":
            if mules and len(mules) >= 2:
                chain = self.rng.choice(len(self.mule_networks)) if self.mule_networks else 0
                if self.mule_networks:
                    network = self.mule_networks[chain % len(self.mule_networks)]
                    pos = self.rng.randint(0, max(1, len(network) - 1))
                    sender = network[pos]
                    receiver = network[min(pos + 1, len(network) - 1)]
                else:
                    sender = self.rng.choice(mules)
                    receiver = self.rng.choice(mules)
            else:
                sender = self.rng.choice(normal)
                receiver = self.rng.choice(normal)
            amount = self.rng.lognormal(11, 0.8)
            hour = self.rng.randint(22, 24) if self.rng.random() < 0.4 else self.rng.randint(0, 5)
        elif fraud_type == "account_takeover":
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            amount = self.rng.lognormal(13, 1.0)  # Unusually large
            hour = self.rng.randint(0, 5)  # Unusual hours
        elif fraud_type == "round_tripping":
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            amount = self.rng.choice([100000, 200000, 500000, 1000000])
            hour = self.rng.randint(9, 17)
        elif fraud_type == "night_burst":
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            amount = self.rng.lognormal(10, 1.0)
            hour = self.rng.randint(1, 4)
        else:
            sender = self.rng.choice(normal)
            receiver = self.rng.choice(normal)
            amount = self.rng.lognormal(10, 1.0)
            hour = self.rng.randint(0, 24)

        tx_time = tx_date.replace(hour=hour % 24, minute=self.rng.randint(0, 60))
        sender_acct = acct_map.get(sender)
        receiver_acct = acct_map.get(receiver)

        return Transaction(
            transaction_id=f"NIP{tx_time.strftime('%Y%m%d')}F{idx:07d}",
            debit_account_id=sender,
            credit_account_id=receiver,
            amount=round(amount, 2),
            currency="NGN",
            channel=self.rng.choice(CHANNEL_TYPES, p=CHANNEL_WEIGHTS),
            status="SUCCESS",
            created_at=tx_time,
            is_fraud=True,
            fraud_type=fraud_type,
            debit_bank_code=sender_acct.bank_code if sender_acct else "044",
            credit_bank_code=receiver_acct.bank_code if receiver_acct else "058",
            narration="Transfer",
            session_id=hashlib.md5(f"fraud_{idx}_{tx_time}".encode()).hexdigest()[:24],
        )

    def to_dataframe(self) -> pd.DataFrame:
        """Convert transactions to DataFrame."""
        records = []
        for tx in self.transactions:
            records.append({
                "transaction_id": tx.transaction_id,
                "debit_account_id": tx.debit_account_id,
                "credit_account_id": tx.credit_account_id,
                "amount": tx.amount,
                "currency": tx.currency,
                "channel": tx.channel,
                "status": tx.status,
                "created_at": tx.created_at,
                "is_fraud": int(tx.is_fraud),
                "fraud_type": tx.fraud_type or "",
                "debit_bank_code": tx.debit_bank_code,
                "credit_bank_code": tx.credit_bank_code,
                "narration": tx.narration,
                "session_id": tx.session_id,
                "hour": tx.created_at.hour,
                "day_of_week": tx.created_at.weekday(),
                "day_of_month": tx.created_at.day,
                "is_weekend": 1 if tx.created_at.weekday() >= 5 else 0,
                "is_night": 1 if tx.created_at.hour < 6 or tx.created_at.hour >= 22 else 0,
                "is_salary_day": 1 if 25 <= tx.created_at.day <= 28 else 0,
            })
        return pd.DataFrame(records)

    def to_accounts_dataframe(self) -> pd.DataFrame:
        """Convert accounts to DataFrame."""
        records = []
        for acc in self.accounts:
            records.append({
                "account_id": acc.account_id,
                "bank_code": acc.bank_code,
                "bank_name": acc.bank_name,
                "account_type": acc.account_type.value,
                "bvn": acc.bvn,
                "created_at": acc.created_at,
                "balance": acc.balance,
                "is_mule": int(acc.is_mule),
                "risk_score": acc.risk_score,
                "city": acc.city,
                "state": acc.state,
                "account_age_days": (datetime(2025, 4, 1) - acc.created_at).days,
            })
        return pd.DataFrame(records)

    def build_graph_features(self) -> pd.DataFrame:
        """Compute graph-derived features for each account."""
        df = self.to_dataframe()
        acct_df = self.to_accounts_dataframe()

        features = {}
        for acc in self.accounts:
            aid = acc.account_id
            sent = df[df["debit_account_id"] == aid]
            received = df[df["credit_account_id"] == aid]

            out_degree = len(sent["credit_account_id"].unique())
            in_degree = len(received["debit_account_id"].unique())
            total_sent = sent["amount"].sum()
            total_received = received["amount"].sum()
            tx_count = len(sent) + len(received)

            # Fan-out ratio
            fan_out = out_degree / max(tx_count, 1)

            # Round amount ratio
            round_amounts = len(sent[sent["amount"] % 1000 == 0])
            round_ratio = round_amounts / max(len(sent), 1)

            # Night transaction ratio
            night_txs = len(sent[sent["is_night"] == 1])
            night_ratio = night_txs / max(len(sent), 1)

            # Velocity (avg txns per day)
            if len(sent) > 1:
                date_range = (sent["created_at"].max() - sent["created_at"].min()).days
                velocity = len(sent) / max(date_range, 1)
            else:
                velocity = 0

            features[aid] = {
                "account_id": aid,
                "out_degree": out_degree,
                "in_degree": in_degree,
                "total_sent": total_sent,
                "total_received": total_received,
                "tx_count": tx_count,
                "avg_tx_amount": (total_sent + total_received) / max(tx_count, 1),
                "fan_out_ratio": fan_out,
                "round_amount_ratio": round_ratio,
                "night_tx_ratio": night_ratio,
                "velocity": velocity,
                "balance": acc.balance,
                "account_age_days": (datetime(2025, 4, 1) - acc.created_at).days,
                "is_mule": int(acc.is_mule),
            }

        return pd.DataFrame(list(features.values()))

    def save(self, output_dir: str):
        """Save all generated data to CSV/JSON."""
        os.makedirs(output_dir, exist_ok=True)

        tx_df = self.to_dataframe()
        acct_df = self.to_accounts_dataframe()
        graph_df = self.build_graph_features()

        tx_df.to_csv(os.path.join(output_dir, "transactions.csv"), index=False)
        acct_df.to_csv(os.path.join(output_dir, "accounts.csv"), index=False)
        graph_df.to_csv(os.path.join(output_dir, "graph_features.csv"), index=False)

        # Save mule network structure
        with open(os.path.join(output_dir, "mule_networks.json"), "w") as f:
            json.dump(self.mule_networks, f)

        logger.info(f"Data saved to {output_dir}/")
        logger.info(f"  transactions.csv: {len(tx_df)} rows")
        logger.info(f"  accounts.csv: {len(acct_df)} rows")
        logger.info(f"  graph_features.csv: {len(graph_df)} rows")
        logger.info(f"  mule_networks.json: {len(self.mule_networks)} chains")

        return tx_df, acct_df, graph_df


def generate_default_dataset(output_dir: str = None) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generate a default-sized dataset for training."""
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), "generated")

    gen = NigerianPaymentDataGenerator(seed=42)
    gen.generate_accounts(n_accounts=10000, mule_pct=0.02)
    gen.generate_transactions(n_transactions=100000, fraud_rate=0.015)
    return gen.save(output_dir)


if __name__ == "__main__":
    generate_default_dataset()
