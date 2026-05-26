"""
ILP (Interledger Protocol) Implementation for Mojaloop
Handles cryptographic generation of ILP packets, conditions, and fulfillments.
"""
import os
import hashlib
import hmac
import base64
import secrets
import struct
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# ILP Constants
ILP_FULFILLMENT_LENGTH = 32
ILP_CONDITION_LENGTH = 32
ILP_PACKET_TYPE_PREPARE = 12


@dataclass
class ILPPacket:
    """Represents an ILP Prepare packet"""
    packet_type: int
    amount: int
    expiry: datetime
    execution_condition: bytes
    destination: str
    data: bytes
    
    def to_bytes(self) -> bytes:
        """Serialize ILP packet to bytes"""
        destination_bytes = self.destination.encode('utf-8')
        packet = bytearray()
        packet.append(self.packet_type)
        packet.extend(struct.pack('>Q', self.amount))
        expiry_str = self.expiry.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        expiry_bytes = expiry_str.encode('ascii')
        packet.append(len(expiry_bytes))
        packet.extend(expiry_bytes)
        packet.extend(self.execution_condition)
        packet.append(len(destination_bytes))
        packet.extend(destination_bytes)
        if len(self.data) < 128:
            packet.append(len(self.data))
        else:
            length_bytes = struct.pack('>H', len(self.data))
            packet.append(0x82)
            packet.extend(length_bytes)
        packet.extend(self.data)
        return bytes(packet)
    
    def to_base64(self) -> str:
        """Serialize and encode as base64"""
        return base64.urlsafe_b64encode(self.to_bytes()).decode('ascii').rstrip('=')


class ILPCryptoService:
    """Cryptographic service for ILP operations."""
    
    def __init__(self, secret_key: Optional[str] = None):
        if secret_key:
            self.secret_key = secret_key.encode('utf-8')
        else:
            env_key = os.getenv('ILP_SECRET_KEY')
            if env_key:
                self.secret_key = env_key.encode('utf-8')
            else:
                logger.warning("No ILP_SECRET_KEY provided, generating random key")
                self.secret_key = secrets.token_bytes(32)
    
    def generate_fulfillment(self, transfer_id: str, amount: int, 
                            payer_fsp: str, payee_fsp: str) -> bytes:
        """Generate cryptographically secure fulfillment for a transfer."""
        data = f"{transfer_id}:{amount}:{payer_fsp}:{payee_fsp}".encode('utf-8')
        return hmac.new(self.secret_key, data, hashlib.sha256).digest()
    
    def generate_condition(self, fulfillment: bytes) -> bytes:
        """Generate condition from fulfillment (SHA-256 hash)."""
        return hashlib.sha256(fulfillment).digest()
    
    def generate_fulfillment_and_condition(self, transfer_id: str, amount: int,
                                          payer_fsp: str, payee_fsp: str) -> Tuple[bytes, bytes]:
        """Generate both fulfillment and condition for a transfer."""
        fulfillment = self.generate_fulfillment(transfer_id, amount, payer_fsp, payee_fsp)
        condition = self.generate_condition(fulfillment)
        return fulfillment, condition
    
    def verify_fulfillment(self, fulfillment: bytes, condition: bytes) -> bool:
        """Verify that a fulfillment matches a condition."""
        computed_condition = self.generate_condition(fulfillment)
        return hmac.compare_digest(computed_condition, condition)
    
    def fulfillment_to_base64(self, fulfillment: bytes) -> str:
        return base64.urlsafe_b64encode(fulfillment).decode('ascii').rstrip('=')
    
    def condition_to_base64(self, condition: bytes) -> str:
        return base64.urlsafe_b64encode(condition).decode('ascii').rstrip('=')
    
    def base64_to_bytes(self, b64_string: str) -> bytes:
        padding = 4 - (len(b64_string) % 4)
        if padding != 4:
            b64_string += '=' * padding
        return base64.urlsafe_b64decode(b64_string)


class ILPPacketBuilder:
    """Builder for ILP Prepare packets."""
    
    def __init__(self, crypto_service: ILPCryptoService):
        self.crypto = crypto_service
    
    def build_prepare_packet(
        self,
        transfer_id: str,
        amount: int,
        currency: str,
        payer_fsp: str,
        payee_fsp: str,
        payee_identifier: str,
        expiry_seconds: int = 30,
        transaction_type: str = "TRANSFER"
    ) -> Dict[str, Any]:
        """Build a complete ILP Prepare packet with fulfillment and condition."""
        import json
        
        fulfillment, condition = self.crypto.generate_fulfillment_and_condition(
            transfer_id, amount, payer_fsp, payee_fsp
        )
        
        destination = f"g.{payee_fsp}.{payee_identifier}"
        
        transaction_data = json.dumps({
            "transactionId": transfer_id,
            "transactionType": transaction_type,
            "amount": {"currency": currency, "amount": str(amount / 100)},
            "payer": {"fspId": payer_fsp},
            "payee": {"fspId": payee_fsp, "identifier": payee_identifier}
        }).encode('utf-8')
        
        expiry = datetime.utcnow() + timedelta(seconds=expiry_seconds)
        
        packet = ILPPacket(
            packet_type=ILP_PACKET_TYPE_PREPARE,
            amount=amount,
            expiry=expiry,
            execution_condition=condition,
            destination=destination,
            data=transaction_data
        )
        
        return {
            "ilpPacket": packet.to_base64(),
            "condition": self.crypto.condition_to_base64(condition),
            "fulfillment": self.crypto.fulfillment_to_base64(fulfillment),
            "expiration": expiry.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        }


# Singleton instances
_crypto_service: Optional[ILPCryptoService] = None
_packet_builder: Optional[ILPPacketBuilder] = None


def get_ilp_crypto_service() -> ILPCryptoService:
    global _crypto_service
    if _crypto_service is None:
        _crypto_service = ILPCryptoService()
    return _crypto_service


def get_ilp_packet_builder() -> ILPPacketBuilder:
    global _packet_builder
    if _packet_builder is None:
        _packet_builder = ILPPacketBuilder(get_ilp_crypto_service())
    return _packet_builder


def generate_transfer_ilp(
    transfer_id: str,
    amount: int,
    currency: str,
    payer_fsp: str,
    payee_fsp: str,
    payee_identifier: str
) -> Dict[str, Any]:
    """Generate ILP packet, condition, and fulfillment for a transfer."""
    builder = get_ilp_packet_builder()
    return builder.build_prepare_packet(
        transfer_id=transfer_id,
        amount=amount,
        currency=currency,
        payer_fsp=payer_fsp,
        payee_fsp=payee_fsp,
        payee_identifier=payee_identifier
    )


def verify_transfer_fulfillment(fulfillment_b64: str, condition_b64: str) -> bool:
    """Verify that a fulfillment matches a condition."""
    crypto = get_ilp_crypto_service()
    fulfillment = crypto.base64_to_bytes(fulfillment_b64)
    condition = crypto.base64_to_bytes(condition_b64)
    return crypto.verify_fulfillment(fulfillment, condition)
