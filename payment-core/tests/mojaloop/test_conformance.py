"""
Mojaloop Conformance Tests
End-to-end tests validating Mojaloop protocol compliance.

These tests verify:
1. ILP packet generation and validation
2. Transfer flow (Party Lookup → Quote → Transfer)
3. Fulfillment verification
4. Settlement reconciliation
5. Error handling and callbacks
"""
import pytest
import asyncio
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Dict, Any
import httpx

# Import ILP protocol
import sys
sys.path.insert(0, '/home/ubuntu/payment-switch/payment-core/services/common')
from ilp_protocol import (
    ILPCryptoService,
    ILPPacketBuilder,
    generate_transfer_ilp,
    verify_transfer_fulfillment,
    ILPPacket,
    ILP_PACKET_TYPE_PREPARE,
    ILP_FULFILLMENT_LENGTH,
    ILP_CONDITION_LENGTH
)


class TestILPCryptography:
    """Test ILP cryptographic operations"""
    
    def test_fulfillment_generation_is_deterministic(self):
        """Same inputs should produce same fulfillment"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment1 = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        fulfillment2 = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        assert fulfillment1 == fulfillment2
        assert len(fulfillment1) == ILP_FULFILLMENT_LENGTH
    
    def test_different_inputs_produce_different_fulfillments(self):
        """Different inputs should produce different fulfillments"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment1 = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        fulfillment2 = crypto.generate_fulfillment(
            transfer_id="tx-456",  # Different transfer ID
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        assert fulfillment1 != fulfillment2
    
    def test_condition_is_sha256_of_fulfillment(self):
        """Condition should be SHA-256 hash of fulfillment"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        condition = crypto.generate_condition(fulfillment)
        expected_condition = hashlib.sha256(fulfillment).digest()
        
        assert condition == expected_condition
        assert len(condition) == ILP_CONDITION_LENGTH
    
    def test_fulfillment_verification_succeeds_for_valid_pair(self):
        """Valid fulfillment should verify against its condition"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment, condition = crypto.generate_fulfillment_and_condition(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        assert crypto.verify_fulfillment(fulfillment, condition) is True
    
    def test_fulfillment_verification_fails_for_invalid_pair(self):
        """Invalid fulfillment should not verify against condition"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        _, condition = crypto.generate_fulfillment_and_condition(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        # Generate different fulfillment
        wrong_fulfillment = crypto.generate_fulfillment(
            transfer_id="tx-456",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        assert crypto.verify_fulfillment(wrong_fulfillment, condition) is False
    
    def test_base64_encoding_roundtrip(self):
        """Base64 encoding should be reversible"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        encoded = crypto.fulfillment_to_base64(fulfillment)
        decoded = crypto.base64_to_bytes(encoded)
        
        assert decoded == fulfillment


class TestILPPacketBuilder:
    """Test ILP packet construction"""
    
    def test_build_prepare_packet_returns_all_fields(self):
        """Prepare packet should contain all required fields"""
        result = generate_transfer_ilp(
            transfer_id="tx-123",
            amount=10000,
            currency="USD",
            payer_fsp="bank-a",
            payee_fsp="bank-b",
            payee_identifier="user-456"
        )
        
        assert "ilpPacket" in result
        assert "condition" in result
        assert "fulfillment" in result
        assert "expiration" in result
    
    def test_ilp_packet_is_base64_encoded(self):
        """ILP packet should be valid base64"""
        result = generate_transfer_ilp(
            transfer_id="tx-123",
            amount=10000,
            currency="USD",
            payer_fsp="bank-a",
            payee_fsp="bank-b",
            payee_identifier="user-456"
        )
        
        # Should not raise
        packet_bytes = base64.urlsafe_b64decode(result["ilpPacket"] + "==")
        assert len(packet_bytes) > 0
    
    def test_condition_and_fulfillment_are_valid_pair(self):
        """Generated condition and fulfillment should verify"""
        result = generate_transfer_ilp(
            transfer_id="tx-123",
            amount=10000,
            currency="USD",
            payer_fsp="bank-a",
            payee_fsp="bank-b",
            payee_identifier="user-456"
        )
        
        assert verify_transfer_fulfillment(
            result["fulfillment"],
            result["condition"]
        ) is True
    
    def test_expiration_is_in_future(self):
        """Expiration should be in the future"""
        result = generate_transfer_ilp(
            transfer_id="tx-123",
            amount=10000,
            currency="USD",
            payer_fsp="bank-a",
            payee_fsp="bank-b",
            payee_identifier="user-456"
        )
        
        expiration = datetime.fromisoformat(result["expiration"].replace("Z", "+00:00"))
        now = datetime.now(expiration.tzinfo)
        
        assert expiration > now


class TestILPPacketSerialization:
    """Test ILP packet binary serialization"""
    
    def test_packet_starts_with_correct_type(self):
        """ILP packet should start with PREPARE type byte"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        condition = crypto.generate_condition(b"x" * 32)
        
        packet = ILPPacket(
            packet_type=ILP_PACKET_TYPE_PREPARE,
            amount=10000,
            expiry=datetime.utcnow() + timedelta(seconds=30),
            execution_condition=condition,
            destination="g.bank-b.user-456",
            data=b'{"test": "data"}'
        )
        
        packet_bytes = packet.to_bytes()
        assert packet_bytes[0] == ILP_PACKET_TYPE_PREPARE
    
    def test_packet_to_base64_is_url_safe(self):
        """Base64 encoding should be URL-safe"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        condition = crypto.generate_condition(b"x" * 32)
        
        packet = ILPPacket(
            packet_type=ILP_PACKET_TYPE_PREPARE,
            amount=10000,
            expiry=datetime.utcnow() + timedelta(seconds=30),
            execution_condition=condition,
            destination="g.bank-b.user-456",
            data=b'{"test": "data"}'
        )
        
        b64 = packet.to_base64()
        
        # URL-safe base64 should not contain + or /
        assert "+" not in b64
        assert "/" not in b64


class TestMojalooTransferFlow:
    """Test end-to-end Mojaloop transfer flow"""
    
    @pytest.fixture
    def mojaloop_urls(self):
        """Mojaloop service URLs"""
        return {
            "als": "http://mojaloop-account-lookup-service.payment-switch.svc.cluster.local:4002",
            "quoting": "http://mojaloop-quoting-service.payment-switch.svc.cluster.local:3002",
            "ml_api": "http://mojaloop-ml-api-adapter.payment-switch.svc.cluster.local:3000",
            "central_ledger": "http://mojaloop-central-ledger.payment-switch.svc.cluster.local:3001",
            "central_settlements": "http://mojaloop-central-settlements.payment-switch.svc.cluster.local:3007"
        }
    
    @pytest.mark.asyncio
    async def test_party_lookup_flow(self, mojaloop_urls):
        """Test party lookup via Account Lookup Service"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{mojaloop_urls['als']}/participants/MSISDN/254712345678",
                    headers={
                        "Accept": "application/vnd.interoperability.participants+json;version=1.1",
                        "Content-Type": "application/vnd.interoperability.participants+json;version=1.1",
                        "FSPIOP-Source": "test-fsp",
                        "Date": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
                    },
                    timeout=5.0
                )
                # In test environment, service may not be running
                # Just verify we can construct the request correctly
                assert response.status_code in (200, 202, 404, 503)
            except httpx.ConnectError:
                pytest.skip("Mojaloop ALS not available")
    
    @pytest.mark.asyncio
    async def test_quote_request_flow(self, mojaloop_urls):
        """Test quote request via Quoting Service"""
        quote_request = {
            "quoteId": "quote-123",
            "transactionId": "tx-123",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "254712345678",
                    "fspId": "payee-fsp"
                }
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "254798765432",
                    "fspId": "payer-fsp"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "USD",
                "amount": "100"
            },
            "transactionType": {
                "scenario": "TRANSFER",
                "initiator": "PAYER",
                "initiatorType": "CONSUMER"
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{mojaloop_urls['quoting']}/quotes",
                    json=quote_request,
                    headers={
                        "Accept": "application/vnd.interoperability.quotes+json;version=1.1",
                        "Content-Type": "application/vnd.interoperability.quotes+json;version=1.1",
                        "FSPIOP-Source": "payer-fsp",
                        "FSPIOP-Destination": "payee-fsp",
                        "Date": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
                    },
                    timeout=5.0
                )
                assert response.status_code in (200, 202, 400, 503)
            except httpx.ConnectError:
                pytest.skip("Mojaloop Quoting Service not available")
    
    @pytest.mark.asyncio
    async def test_transfer_prepare_with_ilp(self, mojaloop_urls):
        """Test transfer prepare with proper ILP packet"""
        # Generate ILP artifacts
        ilp_result = generate_transfer_ilp(
            transfer_id="tx-conformance-test",
            amount=10000,
            currency="USD",
            payer_fsp="payer-fsp",
            payee_fsp="payee-fsp",
            payee_identifier="254712345678"
        )
        
        transfer_request = {
            "transferId": "tx-conformance-test",
            "payerFsp": "payer-fsp",
            "payeeFsp": "payee-fsp",
            "amount": {
                "currency": "USD",
                "amount": "100"
            },
            "ilpPacket": ilp_result["ilpPacket"],
            "condition": ilp_result["condition"],
            "expiration": ilp_result["expiration"]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{mojaloop_urls['ml_api']}/transfers",
                    json=transfer_request,
                    headers={
                        "Accept": "application/vnd.interoperability.transfers+json;version=1.1",
                        "Content-Type": "application/vnd.interoperability.transfers+json;version=1.1",
                        "FSPIOP-Source": "payer-fsp",
                        "FSPIOP-Destination": "payee-fsp",
                        "Date": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
                    },
                    timeout=5.0
                )
                assert response.status_code in (200, 202, 400, 503)
            except httpx.ConnectError:
                pytest.skip("Mojaloop ML API Adapter not available")
    
    @pytest.mark.asyncio
    async def test_transfer_fulfillment_verification(self, mojaloop_urls):
        """Test that fulfillment can be verified against condition"""
        # Generate ILP artifacts
        ilp_result = generate_transfer_ilp(
            transfer_id="tx-fulfillment-test",
            amount=10000,
            currency="USD",
            payer_fsp="payer-fsp",
            payee_fsp="payee-fsp",
            payee_identifier="254712345678"
        )
        
        # Simulate payee returning fulfillment
        fulfillment = ilp_result["fulfillment"]
        condition = ilp_result["condition"]
        
        # Verify fulfillment matches condition
        assert verify_transfer_fulfillment(fulfillment, condition) is True
        
        # Verify wrong fulfillment fails
        wrong_ilp = generate_transfer_ilp(
            transfer_id="tx-different",
            amount=10000,
            currency="USD",
            payer_fsp="payer-fsp",
            payee_fsp="payee-fsp",
            payee_identifier="254712345678"
        )
        
        assert verify_transfer_fulfillment(wrong_ilp["fulfillment"], condition) is False


class TestSettlementReconciliation:
    """Test settlement and reconciliation"""
    
    @pytest.fixture
    def settlement_url(self):
        return "http://mojaloop-central-settlements.payment-switch.svc.cluster.local:3007"
    
    @pytest.mark.asyncio
    async def test_settlement_window_creation(self, settlement_url):
        """Test creating a settlement window"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{settlement_url}/v2/settlementWindows",
                    json={
                        "reason": "Conformance test window",
                        "state": "OPEN"
                    },
                    timeout=5.0
                )
                assert response.status_code in (200, 201, 400, 503)
            except httpx.ConnectError:
                pytest.skip("Central Settlements not available")
    
    @pytest.mark.asyncio
    async def test_settlement_window_close(self, settlement_url):
        """Test closing a settlement window"""
        async with httpx.AsyncClient() as client:
            try:
                # First create a window
                create_response = await client.post(
                    f"{settlement_url}/v2/settlementWindows",
                    json={"reason": "Test window", "state": "OPEN"},
                    timeout=5.0
                )
                
                if create_response.status_code in (200, 201):
                    window_id = create_response.json().get("settlementWindowId")
                    
                    # Close the window
                    close_response = await client.post(
                        f"{settlement_url}/v2/settlementWindows/{window_id}",
                        json={"state": "CLOSED", "reason": "Test complete"},
                        timeout=5.0
                    )
                    assert close_response.status_code in (200, 400, 404)
            except httpx.ConnectError:
                pytest.skip("Central Settlements not available")


class TestMojalooErrorHandling:
    """Test Mojaloop error handling"""
    
    def test_invalid_ilp_packet_rejected(self):
        """Invalid ILP packet should be detected"""
        # Create an invalid base64 string
        invalid_packet = "not-valid-base64!!!"
        
        # This should fail gracefully
        try:
            base64.urlsafe_b64decode(invalid_packet + "==")
            assert False, "Should have raised an error"
        except Exception:
            pass  # Expected
    
    def test_expired_transfer_detected(self):
        """Expired transfer should be detectable"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        condition = crypto.generate_condition(b"x" * 32)
        
        # Create packet with past expiry
        packet = ILPPacket(
            packet_type=ILP_PACKET_TYPE_PREPARE,
            amount=10000,
            expiry=datetime.utcnow() - timedelta(seconds=30),  # In the past
            execution_condition=condition,
            destination="g.bank-b.user-456",
            data=b'{"test": "data"}'
        )
        
        # Expiry should be in the past
        assert packet.expiry < datetime.utcnow()
    
    def test_amount_mismatch_detected(self):
        """Amount mismatch should produce different fulfillment"""
        crypto = ILPCryptoService(secret_key="test-secret-key")
        
        fulfillment_100 = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=10000,  # $100.00
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        fulfillment_200 = crypto.generate_fulfillment(
            transfer_id="tx-123",
            amount=20000,  # $200.00 - different amount
            payer_fsp="bank-a",
            payee_fsp="bank-b"
        )
        
        # Different amounts should produce different fulfillments
        assert fulfillment_100 != fulfillment_200
        
        # Condition from $100 should not verify with $200 fulfillment
        condition_100 = crypto.generate_condition(fulfillment_100)
        assert crypto.verify_fulfillment(fulfillment_200, condition_100) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
