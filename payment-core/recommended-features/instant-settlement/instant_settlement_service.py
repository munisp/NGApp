"""
Instant Settlement Service

Based on learnings from PIX (Brazil's instant payment system),
this service provides real-time gross settlement (RTGS) capabilities.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum
from dataclasses import dataclass, asdict
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SettlementStatus(Enum):
    """Settlement status enum."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class SettlementType(Enum):
    """Settlement type enum."""
    RTGS = "rtgs"  # Real-Time Gross Settlement
    DNS = "dns"    # Deferred Net Settlement
    INSTANT = "instant"  # Instant settlement (like PIX)


@dataclass
class SettlementInstruction:
    """Settlement instruction."""
    instruction_id: str
    transaction_id: str
    debtor_bank_id: str
    creditor_bank_id: str
    amount: float
    currency: str
    settlement_type: SettlementType
    priority: int  # 1 (highest) to 5 (lowest)
    timestamp: datetime
    settlement_date: datetime
    status: SettlementStatus
    metadata: Dict


@dataclass
class SettlementBatch:
    """Settlement batch for DNS."""
    batch_id: str
    settlement_date: datetime
    instructions: List[SettlementInstruction]
    total_amount: float
    status: SettlementStatus
    created_at: datetime
    processed_at: Optional[datetime] = None


class InstantSettlementService:
    """
    Instant Settlement Service
    
    Provides real-time settlement capabilities inspired by PIX.
    """
    
    def __init__(
        self,
        tigerbeetle_client,
        redis_client,
        kafka_producer
    ):
        self.tigerbeetle = tigerbeetle_client
        self.redis = redis_client
        self.kafka = kafka_producer
        self.settlement_queue = asyncio.Queue()
        
    async def create_settlement_instruction(
        self,
        transaction_id: str,
        debtor_bank_id: str,
        creditor_bank_id: str,
        amount: float,
        currency: str,
        settlement_type: SettlementType = SettlementType.INSTANT,
        priority: int = 1
    ) -> SettlementInstruction:
        """
        Create a new settlement instruction.
        
        Args:
            transaction_id: Original transaction ID
            debtor_bank_id: Bank ID of the debtor
            creditor_bank_id: Bank ID of the creditor
            amount: Settlement amount
            currency: Currency code
            settlement_type: Type of settlement
            priority: Priority level (1-5)
            
        Returns:
            SettlementInstruction
        """
        instruction = SettlementInstruction(
            instruction_id=str(uuid.uuid4()),
            transaction_id=transaction_id,
            debtor_bank_id=debtor_bank_id,
            creditor_bank_id=creditor_bank_id,
            amount=amount,
            currency=currency,
            settlement_type=settlement_type,
            priority=priority,
            timestamp=datetime.now(),
            settlement_date=datetime.now() if settlement_type == SettlementType.INSTANT else self._get_next_settlement_date(),
            status=SettlementStatus.PENDING,
            metadata={}
        )
        
        # Store instruction in Redis
        await self._store_instruction(instruction)
        
        # Add to settlement queue
        await self.settlement_queue.put(instruction)
        
        logger.info(f"Created settlement instruction: {instruction.instruction_id}")
        
        return instruction
        
    async def process_instant_settlement(
        self,
        instruction: SettlementInstruction
    ) -> bool:
        """
        Process instant settlement (RTGS).
        
        This is inspired by PIX's instant settlement model where
        settlements happen in real-time, 24/7/365.
        
        Args:
            instruction: Settlement instruction
            
        Returns:
            bool: True if successful
        """
        try:
            # Update status to processing
            instruction.status = SettlementStatus.PROCESSING
            await self._update_instruction(instruction)
            
            # Check liquidity
            if not await self._check_liquidity(instruction.debtor_bank_id, instruction.amount):
                logger.error(f"Insufficient liquidity for {instruction.debtor_bank_id}")
                instruction.status = SettlementStatus.FAILED
                instruction.metadata['failure_reason'] = "insufficient_liquidity"
                await self._update_instruction(instruction)
                return False
            
            # Execute settlement in TigerBeetle
            success = await self._execute_ledger_settlement(instruction)
            
            if success:
                # Update status to completed
                instruction.status = SettlementStatus.COMPLETED
                instruction.metadata['completed_at'] = datetime.now().isoformat()
                await self._update_instruction(instruction)
                
                # Send notification via Kafka
                await self._send_settlement_notification(instruction)
                
                logger.info(f"Instant settlement completed: {instruction.instruction_id}")
                return True
            else:
                # Settlement failed
                instruction.status = SettlementStatus.FAILED
                instruction.metadata['failure_reason'] = "ledger_error"
                await self._update_instruction(instruction)
                
                logger.error(f"Instant settlement failed: {instruction.instruction_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error processing instant settlement: {e}")
            instruction.status = SettlementStatus.FAILED
            instruction.metadata['failure_reason'] = str(e)
            await self._update_instruction(instruction)
            return False
            
    async def process_dns_settlement(
        self,
        batch: SettlementBatch
    ) -> bool:
        """
        Process Deferred Net Settlement (DNS).
        
        DNS batches multiple transactions and settles the net position
        at scheduled intervals (e.g., end of day).
        
        Args:
            batch: Settlement batch
            
        Returns:
            bool: True if successful
        """
        try:
            # Calculate net positions
            net_positions = self._calculate_net_positions(batch.instructions)
            
            # Process each net position
            for bank_id, net_amount in net_positions.items():
                if net_amount > 0:
                    # Bank receives funds
                    await self._credit_bank_account(bank_id, net_amount)
                elif net_amount < 0:
                    # Bank pays funds
                    await self._debit_bank_account(bank_id, abs(net_amount))
            
            # Update batch status
            batch.status = SettlementStatus.COMPLETED
            batch.processed_at = datetime.now()
            
            # Update all instructions in the batch
            for instruction in batch.instructions:
                instruction.status = SettlementStatus.COMPLETED
                await self._update_instruction(instruction)
            
            logger.info(f"DNS batch completed: {batch.batch_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing DNS batch: {e}")
            batch.status = SettlementStatus.FAILED
            return False
            
    async def reverse_settlement(
        self,
        instruction_id: str,
        reason: str
    ) -> bool:
        """
        Reverse a completed settlement.
        
        Args:
            instruction_id: Settlement instruction ID
            reason: Reason for reversal
            
        Returns:
            bool: True if successful
        """
        try:
            # Retrieve instruction
            instruction = await self._retrieve_instruction(instruction_id)
            
            if instruction.status != SettlementStatus.COMPLETED:
                logger.error(f"Cannot reverse non-completed settlement: {instruction_id}")
                return False
            
            # Create reversal instruction
            reversal = SettlementInstruction(
                instruction_id=str(uuid.uuid4()),
                transaction_id=instruction.transaction_id,
                debtor_bank_id=instruction.creditor_bank_id,  # Reversed
                creditor_bank_id=instruction.debtor_bank_id,  # Reversed
                amount=instruction.amount,
                currency=instruction.currency,
                settlement_type=SettlementType.INSTANT,
                priority=1,  # High priority for reversals
                timestamp=datetime.now(),
                settlement_date=datetime.now(),
                status=SettlementStatus.PENDING,
                metadata={
                    'reversal_of': instruction_id,
                    'reason': reason
                }
            )
            
            # Process reversal
            success = await self.process_instant_settlement(reversal)
            
            if success:
                # Update original instruction
                instruction.status = SettlementStatus.REVERSED
                instruction.metadata['reversed_by'] = reversal.instruction_id
                instruction.metadata['reversal_reason'] = reason
                await self._update_instruction(instruction)
                
                logger.info(f"Settlement reversed: {instruction_id}")
                return True
            else:
                logger.error(f"Failed to reverse settlement: {instruction_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error reversing settlement: {e}")
            return False
            
    async def get_settlement_status(
        self,
        instruction_id: str
    ) -> Optional[SettlementInstruction]:
        """Get the status of a settlement instruction."""
        return await self._retrieve_instruction(instruction_id)
        
    async def get_bank_settlement_position(
        self,
        bank_id: str,
        date: datetime
    ) -> Dict:
        """
        Get the settlement position for a bank on a specific date.
        
        Args:
            bank_id: Bank ID
            date: Settlement date
            
        Returns:
            Dict with settlement position details
        """
        # Retrieve all instructions for the bank on the date
        instructions = await self._retrieve_bank_instructions(bank_id, date)
        
        # Calculate positions
        total_debits = sum(
            i.amount for i in instructions 
            if i.debtor_bank_id == bank_id and i.status == SettlementStatus.COMPLETED
        )
        total_credits = sum(
            i.amount for i in instructions 
            if i.creditor_bank_id == bank_id and i.status == SettlementStatus.COMPLETED
        )
        net_position = total_credits - total_debits
        
        return {
            'bank_id': bank_id,
            'date': date.isoformat(),
            'total_debits': total_debits,
            'total_credits': total_credits,
            'net_position': net_position,
            'instruction_count': len(instructions)
        }
        
    # Private helper methods
    
    async def _execute_ledger_settlement(
        self,
        instruction: SettlementInstruction
    ) -> bool:
        """Execute settlement in TigerBeetle ledger."""
        try:
            # Create transfer in TigerBeetle
            # This is a simplified example
            transfer = {
                'id': int(uuid.uuid4().int & (1<<64)-1),
                'debit_account_id': int(instruction.debtor_bank_id),
                'credit_account_id': int(instruction.creditor_bank_id),
                'amount': int(instruction.amount * 100),  # Convert to cents
                'ledger': 1,
                'code': 1,  # Settlement code
                'flags': 0,
                'timestamp': int(datetime.now().timestamp() * 1000000)
            }
            
            # Execute transfer
            # result = await self.tigerbeetle.create_transfers([transfer])
            # return len(result) == 0  # Empty result means success
            
            # For demonstration
            return True
            
        except Exception as e:
            logger.error(f"Ledger settlement error: {e}")
            return False
            
    async def _check_liquidity(
        self,
        bank_id: str,
        amount: float
    ) -> bool:
        """Check if bank has sufficient liquidity."""
        # Query bank's settlement account balance
        # balance = await self.tigerbeetle.get_account_balance(bank_id)
        # return balance >= amount
        
        # For demonstration
        return True
        
    async def _credit_bank_account(self, bank_id: str, amount: float):
        """Credit a bank's settlement account."""
        logger.info(f"Crediting {bank_id}: {amount}")
        
    async def _debit_bank_account(self, bank_id: str, amount: float):
        """Debit a bank's settlement account."""
        logger.info(f"Debiting {bank_id}: {amount}")
        
    def _calculate_net_positions(
        self,
        instructions: List[SettlementInstruction]
    ) -> Dict[str, float]:
        """Calculate net positions for DNS."""
        positions = {}
        
        for instruction in instructions:
            # Debit position
            if instruction.debtor_bank_id not in positions:
                positions[instruction.debtor_bank_id] = 0
            positions[instruction.debtor_bank_id] -= instruction.amount
            
            # Credit position
            if instruction.creditor_bank_id not in positions:
                positions[instruction.creditor_bank_id] = 0
            positions[instruction.creditor_bank_id] += instruction.amount
        
        return positions
        
    def _get_next_settlement_date(self) -> datetime:
        """Get the next DNS settlement date."""
        # Typically end of business day
        now = datetime.now()
        settlement_time = now.replace(hour=17, minute=0, second=0, microsecond=0)
        
        if now > settlement_time:
            # Next business day
            settlement_time += timedelta(days=1)
        
        return settlement_time
        
    async def _store_instruction(self, instruction: SettlementInstruction):
        """Store instruction in Redis."""
        key = f"settlement:instruction:{instruction.instruction_id}"
        await self.redis.set(key, json.dumps(asdict(instruction), default=str))
        await self.redis.expire(key, 86400 * 7)  # 7 days
        
    async def _update_instruction(self, instruction: SettlementInstruction):
        """Update instruction in Redis."""
        await self._store_instruction(instruction)
        
    async def _retrieve_instruction(
        self,
        instruction_id: str
    ) -> Optional[SettlementInstruction]:
        """Retrieve instruction from Redis."""
        key = f"settlement:instruction:{instruction_id}"
        data = await self.redis.get(key)
        
        if data:
            return SettlementInstruction(**json.loads(data))
        return None
        
    async def _retrieve_bank_instructions(
        self,
        bank_id: str,
        date: datetime
    ) -> List[SettlementInstruction]:
        """Retrieve all instructions for a bank on a specific date."""
        # This would query a database in production
        # For demonstration, return empty list
        return []
        
    async def _send_settlement_notification(self, instruction: SettlementInstruction):
        """Send settlement notification via Kafka."""
        message = {
            'event_type': 'settlement_completed',
            'instruction_id': instruction.instruction_id,
            'transaction_id': instruction.transaction_id,
            'debtor_bank_id': instruction.debtor_bank_id,
            'creditor_bank_id': instruction.creditor_bank_id,
            'amount': instruction.amount,
            'currency': instruction.currency,
            'timestamp': datetime.now().isoformat()
        }
        
        # await self.kafka.send('settlement-events', message)
        logger.info(f"Settlement notification sent: {instruction.instruction_id}")


# Example usage
async def main():
    # Initialize service (with mock clients)
    service = InstantSettlementService(
        tigerbeetle_client=None,
        redis_client=None,
        kafka_producer=None
    )
    
    # Create instant settlement instruction
    instruction = await service.create_settlement_instruction(
        transaction_id="txn-123",
        debtor_bank_id="bank-001",
        creditor_bank_id="bank-002",
        amount=1000.00,
        currency="NGN",
        settlement_type=SettlementType.INSTANT
    )
    
    # Process instant settlement
    success = await service.process_instant_settlement(instruction)
    
    print(f"Settlement {'successful' if success else 'failed'}")


if __name__ == "__main__":
    asyncio.run(main())
