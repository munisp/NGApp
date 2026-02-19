"""
PCI DSS Compliant Security Module
Tokenization, encryption, and secure data handling for POS
"""

import os
import hashlib
import hmac
import secrets
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# ENCRYPTION KEYS (Load from environment in production)
# ============================================================================

# Master encryption key (should be stored in HSM or key management service)
MASTER_KEY = os.getenv("POS_MASTER_KEY", Fernet.generate_key())
if isinstance(MASTER_KEY, str):
    MASTER_KEY = MASTER_KEY.encode()

# Tokenization key (separate from encryption key)
TOKEN_KEY = os.getenv("POS_TOKEN_KEY", secrets.token_bytes(32))
if isinstance(TOKEN_KEY, str):
    TOKEN_KEY = TOKEN_KEY.encode()

# ============================================================================
# CARD DATA TOKENIZATION (PCI DSS Compliant)
# ============================================================================

class CardTokenizer:
    """
    PCI DSS compliant card tokenization
    Replaces sensitive card data with non-sensitive tokens
    Uses database-backed vault for persistence across restarts
    """

    def __init__(self):
        self.cipher_suite = Fernet(MASTER_KEY)
        self._db_engine = None
        self._db_session_factory = None
        self._init_db()

    def _init_db(self):
        """Initialize database-backed token vault"""
        try:
            from sqlalchemy import create_engine, Column, String, LargeBinary, DateTime, MetaData, Table
            from sqlalchemy.orm import sessionmaker

            db_url = os.getenv("POS_TOKEN_VAULT_DB_URL", os.getenv("DATABASE_URL", ""))
            if not db_url:
                logger.warning("No POS_TOKEN_VAULT_DB_URL configured; token vault will use in-memory fallback")
                self._fallback_vault: Dict[str, Dict[str, Any]] = {}
                return

            self._db_engine = create_engine(db_url, pool_pre_ping=True)
            self._db_session_factory = sessionmaker(bind=self._db_engine)

            metadata = MetaData()
            self._token_table = Table(
                'card_token_vault', metadata,
                Column('token', String, primary_key=True),
                Column('encrypted_data', LargeBinary, nullable=False),
                Column('last_four', String(4), nullable=False),
                Column('card_type', String(20), nullable=False),
                Column('created_at', DateTime, nullable=False),
                Column('expires_at', DateTime, nullable=False),
            )
            metadata.create_all(self._db_engine)
            logger.info("Card token vault initialized with database backend")
        except Exception as e:
            logger.warning(f"Database token vault init failed, using in-memory fallback: {e}")
            self._db_engine = None
            self._fallback_vault: Dict[str, Dict[str, Any]] = {}

    def _use_db(self) -> bool:
        return self._db_engine is not None

    def tokenize_card(
        self,
        card_number: str,
        cvv: str,
        expiry_month: str,
        expiry_year: str,
        cardholder_name: str
    ) -> Dict[str, str]:
        """
        Tokenize card data and return token

        Returns:
            {
                'token': 'tok_xxxxx',
                'last_four': '4242',
                'card_type': 'visa',
                'expiry_masked': '**/**'
            }
        """
        token = self._generate_token()
        last_four = card_number[-4:]
        card_type = self._detect_card_type(card_number)

        encrypted_card = self._encrypt_card_data({
            'card_number': card_number,
            'cvv': cvv,
            'expiry_month': expiry_month,
            'expiry_year': expiry_year,
            'cardholder_name': cardholder_name
        })

        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(days=30)

        if self._use_db():
            try:
                session = self._db_session_factory()
                session.execute(self._token_table.insert().values(
                    token=token,
                    encrypted_data=encrypted_card,
                    last_four=last_four,
                    card_type=card_type,
                    created_at=created_at,
                    expires_at=expires_at,
                ))
                session.commit()
                session.close()
            except Exception as e:
                logger.error(f"Failed to persist token to DB: {e}")
                raise
        else:
            self._fallback_vault[token] = {
                'encrypted_data': encrypted_card,
                'last_four': last_four,
                'card_type': card_type,
                'created_at': created_at,
                'expires_at': expires_at,
            }

        logger.info(f"Card tokenized: {token} (****{last_four})")

        return {
            'token': token,
            'last_four': last_four,
            'card_type': card_type,
            'expiry_masked': '**/**'
        }

    def detokenize_card(self, token: str) -> Optional[Dict[str, str]]:
        """
        Retrieve card data from token (only for payment processing)
        Should be called only by payment processor
        """
        vault_entry = self._load_vault_entry(token)

        if not vault_entry:
            logger.warning(f"Token not found: {token}")
            return None

        if datetime.utcnow() > vault_entry['expires_at']:
            logger.warning(f"Token expired: {token}")
            self._delete_vault_entry(token)
            return None

        card_data = self._decrypt_card_data(vault_entry['encrypted_data'])
        logger.info(f"Card detokenized: {token} (****{vault_entry['last_four']})")
        return card_data

    def _load_vault_entry(self, token: str) -> Optional[Dict[str, Any]]:
        if self._use_db():
            try:
                from sqlalchemy import select
                session = self._db_session_factory()
                row = session.execute(
                    select(self._token_table).where(self._token_table.c.token == token)
                ).fetchone()
                session.close()
                if row:
                    return {
                        'encrypted_data': row.encrypted_data,
                        'last_four': row.last_four,
                        'card_type': row.card_type,
                        'created_at': row.created_at,
                        'expires_at': row.expires_at,
                    }
                return None
            except Exception as e:
                logger.error(f"Failed to load token from DB: {e}")
                return None
        else:
            return self._fallback_vault.get(token)

    def _delete_vault_entry(self, token: str):
        if self._use_db():
            try:
                session = self._db_session_factory()
                session.execute(
                    self._token_table.delete().where(self._token_table.c.token == token)
                )
                session.commit()
                session.close()
            except Exception as e:
                logger.error(f"Failed to delete token from DB: {e}")
        else:
            self._fallback_vault.pop(token, None)

    def _generate_token(self) -> str:
        """Generate unique token"""
        random_bytes = secrets.token_bytes(16)
        token_hash = hashlib.sha256(random_bytes).hexdigest()[:32]
        return f"tok_{token_hash}"

    def _encrypt_card_data(self, card_data: Dict[str, str]) -> bytes:
        """Encrypt card data using Fernet (AES-128 CBC)"""
        import json
        data_json = json.dumps(card_data)
        encrypted = self.cipher_suite.encrypt(data_json.encode())
        return encrypted

    def _decrypt_card_data(self, encrypted_data: bytes) -> Dict[str, str]:
        """Decrypt card data"""
        import json
        decrypted = self.cipher_suite.decrypt(encrypted_data)
        card_data = json.loads(decrypted.decode())
        return card_data

    def _detect_card_type(self, card_number: str) -> str:
        """Detect card type from number"""
        card_number = card_number.replace(' ', '').replace('-', '')

        if card_number.startswith('4'):
            return 'visa'
        elif card_number.startswith(('51', '52', '53', '54', '55')):
            return 'mastercard'
        elif card_number.startswith(('34', '37')):
            return 'amex'
        elif card_number.startswith('6'):
            return 'discover'
        else:
            return 'unknown'

# ============================================================================
# SECURE DATA ENCRYPTION (AES-256)
# ============================================================================

class SecureEncryption:
    """
    AES-256 encryption for sensitive data
    Uses PBKDF2 for key derivation
    """
    
    @staticmethod
    def encrypt_data(data: str, password: Optional[str] = None) -> str:
        """
        Encrypt data with AES-256
        Returns base64-encoded encrypted data with salt and IV
        """
        # Use master key if no password provided
        if password is None:
            cipher_suite = Fernet(MASTER_KEY)
            encrypted = cipher_suite.encrypt(data.encode())
            return base64.b64encode(encrypted).decode()
        
        # Generate salt and IV
        salt = secrets.token_bytes(16)
        iv = secrets.token_bytes(16)
        
        # Derive key from password using PBKDF2
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = kdf.derive(password.encode())
        
        # Encrypt with AES-256 CBC
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Pad data to block size
        padded_data = SecureEncryption._pad(data.encode())
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        
        # Combine salt + IV + encrypted data
        combined = salt + iv + encrypted
        
        return base64.b64encode(combined).decode()
    
    @staticmethod
    def decrypt_data(encrypted_data: str, password: Optional[str] = None) -> str:
        """Decrypt AES-256 encrypted data"""
        # Use master key if no password provided
        if password is None:
            cipher_suite = Fernet(MASTER_KEY)
            encrypted_bytes = base64.b64decode(encrypted_data.encode())
            decrypted = cipher_suite.decrypt(encrypted_bytes)
            return decrypted.decode()
        
        # Decode base64
        combined = base64.b64decode(encrypted_data.encode())
        
        # Extract salt, IV, and encrypted data
        salt = combined[:16]
        iv = combined[16:32]
        encrypted = combined[32:]
        
        # Derive key from password
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = kdf.derive(password.encode())
        
        # Decrypt with AES-256 CBC
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()
        decrypted = SecureEncryption._unpad(decrypted_padded)
        
        return decrypted.decode()
    
    @staticmethod
    def _pad(data: bytes) -> bytes:
        """PKCS7 padding"""
        block_size = 16
        padding_length = block_size - (len(data) % block_size)
        padding = bytes([padding_length] * padding_length)
        return data + padding
    
    @staticmethod
    def _unpad(data: bytes) -> bytes:
        """Remove PKCS7 padding"""
        padding_length = data[-1]
        return data[:-padding_length]

# ============================================================================
# SECURE HASHING (SHA-256)
# ============================================================================

class SecureHash:
    """Secure hashing functions"""
    
    @staticmethod
    def hash_data(data: str) -> str:
        """SHA-256 hash"""
        return hashlib.sha256(data.encode()).hexdigest()
    
    @staticmethod
    def hmac_sign(data: str, key: Optional[bytes] = None) -> str:
        """HMAC-SHA256 signature"""
        if key is None:
            key = TOKEN_KEY
        
        signature = hmac.new(
            key,
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    @staticmethod
    def verify_hmac(data: str, signature: str, key: Optional[bytes] = None) -> bool:
        """Verify HMAC signature"""
        expected_signature = SecureHash.hmac_sign(data, key)
        return hmac.compare_digest(expected_signature, signature)

# ============================================================================
# LOG SANITIZATION (PCI DSS Requirement)
# ============================================================================

class LogSanitizer:
    """
    Sanitize logs to remove sensitive data
    PCI DSS requires that sensitive data is never logged
    """
    
    SENSITIVE_FIELDS = [
        'card_number', 'cvv', 'cvc', 'cvv2', 'cid',
        'password', 'secret', 'token', 'api_key',
        'pin', 'track_data', 'magnetic_stripe',
        'expiry', 'expiration', 'cardholder_name'
    ]
    
    @staticmethod
    def sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize dictionary for logging"""
        sanitized = {}
        
        for key, value in data.items():
            key_lower = key.lower()
            
            # Check if field is sensitive
            is_sensitive = any(
                sensitive in key_lower
                for sensitive in LogSanitizer.SENSITIVE_FIELDS
            )
            
            if is_sensitive:
                # Mask sensitive data
                if 'card' in key_lower and isinstance(value, str) and len(value) >= 4:
                    # Show only last 4 digits
                    sanitized[key] = f"****{value[-4:]}"
                else:
                    sanitized[key] = "***REDACTED***"
            elif isinstance(value, dict):
                # Recursively sanitize nested dicts
                sanitized[key] = LogSanitizer.sanitize_dict(value)
            elif isinstance(value, list):
                # Sanitize lists
                sanitized[key] = [
                    LogSanitizer.sanitize_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        
        return sanitized
    
    @staticmethod
    def sanitize_string(text: str) -> str:
        """Sanitize string for logging (mask card numbers)"""
        import re
        
        # Mask potential card numbers (13-19 digits)
        text = re.sub(r'\b\d{13,19}\b', '****CARD****', text)
        
        # Mask potential CVV (3-4 digits after card number)
        text = re.sub(r'\b\d{3,4}\b', '***', text)
        
        return text

# ============================================================================
# GLOBAL INSTANCES
# ============================================================================

# Create global instances
card_tokenizer = CardTokenizer()
secure_encryption = SecureEncryption()
secure_hash = SecureHash()
log_sanitizer = LogSanitizer()

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def mask_card_number(card_number: str) -> str:
    """Mask card number for display"""
    if len(card_number) < 4:
        return "****"
    return f"****{card_number[-4:]}"

def validate_card_number(card_number: str) -> bool:
    """Luhn algorithm for card validation"""
    card_number = card_number.replace(' ', '').replace('-', '')
    
    if not card_number.isdigit():
        return False
    
    if len(card_number) < 13 or len(card_number) > 19:
        return False
    
    # Luhn algorithm
    def luhn_checksum(card_num):
        def digits_of(n):
            return [int(d) for d in str(n)]
        digits = digits_of(card_num)
        odd_digits = digits[-1::-2]
        even_digits = digits[-2::-2]
        checksum = sum(odd_digits)
        for d in even_digits:
            checksum += sum(digits_of(d * 2))
        return checksum % 10
    
    return luhn_checksum(card_number) == 0

