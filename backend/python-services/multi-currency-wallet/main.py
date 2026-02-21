"""
Multi-Currency Wallet Service - Production Implementation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List
from datetime import datetime
from decimal import Decimal
import uvicorn
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Multi-Currency Wallet", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class CurrencyBalance(BaseModel):
    currency: str
    balance: Decimal

class Wallet(BaseModel):
    wallet_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    balances: Dict[str, Decimal] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CreateWalletRequest(BaseModel):
    user_id: str
    currencies: List[str]

class UpdateBalanceRequest(BaseModel):
    wallet_id: str
    currency: str
    amount: Decimal

wallets_db: Dict[str, Wallet] = {}
user_wallets: Dict[str, str] = {}

class MultiCurrencyWalletService:
    @staticmethod
    async def create_wallet(request: CreateWalletRequest) -> Wallet:
        wallet = Wallet(
            user_id=request.user_id,
            balances={currency: Decimal("0.00") for currency in request.currencies}
        )
        wallets_db[wallet.wallet_id] = wallet
        user_wallets[request.user_id] = wallet.wallet_id
        logger.info(f"Created multi-currency wallet {wallet.wallet_id}")
        return wallet
    
    @staticmethod
    async def get_wallet(user_id: str) -> Wallet:
        if user_id not in user_wallets:
            raise HTTPException(status_code=404, detail="Wallet not found")
        wallet_id = user_wallets[user_id]
        return wallets_db[wallet_id]
    
    @staticmethod
    async def update_balance(request: UpdateBalanceRequest) -> Wallet:
        if request.wallet_id not in wallets_db:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        wallet = wallets_db[request.wallet_id]
        if request.currency not in wallet.balances:
            wallet.balances[request.currency] = Decimal("0.00")
        
        wallet.balances[request.currency] += request.amount
        logger.info(f"Updated wallet {request.wallet_id} {request.currency}: {request.amount}")
        return wallet

@app.post("/api/v1/wallets", response_model=Wallet)
async def create_wallet(request: CreateWalletRequest):
    return await MultiCurrencyWalletService.create_wallet(request)

@app.get("/api/v1/wallets/{user_id}", response_model=Wallet)
async def get_wallet(user_id: str):
    return await MultiCurrencyWalletService.get_wallet(user_id)

@app.post("/api/v1/wallets/balance", response_model=Wallet)
async def update_balance(request: UpdateBalanceRequest):
    return await MultiCurrencyWalletService.update_balance(request)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "multi-currency-wallet", "version": "2.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8085)
