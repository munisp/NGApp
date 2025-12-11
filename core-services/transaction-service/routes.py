"""
API routes for transaction-service
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from .models import TransactionServiceModel
from .service import TransactionServiceService

router = APIRouter(prefix="/api/v1/transaction-service", tags=["transaction-service"])

@router.post("/", response_model=TransactionServiceModel)
async def create(data: dict):
    service = TransactionServiceService()
    return await service.create(data)

@router.get("/{id}", response_model=TransactionServiceModel)
async def get(id: str):
    service = TransactionServiceService()
    return await service.get(id)

@router.get("/", response_model=List[TransactionServiceModel])
async def list_all(skip: int = 0, limit: int = 100):
    service = TransactionServiceService()
    return await service.list(skip, limit)

@router.put("/{id}", response_model=TransactionServiceModel)
async def update(id: str, data: dict):
    service = TransactionServiceService()
    return await service.update(id, data)

@router.delete("/{id}")
async def delete(id: str):
    service = TransactionServiceService()
    await service.delete(id)
    return {"message": "Deleted successfully"}
