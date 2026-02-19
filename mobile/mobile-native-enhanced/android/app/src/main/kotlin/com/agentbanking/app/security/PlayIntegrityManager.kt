// PlayIntegrityManager.kt - Google Play Integrity API Integration
// Provides server-side device and app attestation for fraud prevention

package com.agentbanking.app.security

import android.content.Context
import android.util.Base64
import android.util.Log
import com.google.android.play.core.integrity.IntegrityManager
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import com.google.android.play.core.integrity.IntegrityTokenResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * PlayIntegrityManager - Google Play Integrity API integration
 * 
 * Provides:
 * - Device integrity verification
 * - App integrity verification  
 * - Account licensing verification
 * - Server-side token validation
 * 
 * Verdict levels:
 * - MEETS_DEVICE_INTEGRITY: Device passes basic integrity checks
 * - MEETS_BASIC_INTEGRITY: Device may be rooted but passes basic checks
 * - MEETS_STRONG_INTEGRITY: Device passes all integrity checks (hardware-backed)
 */
class PlayIntegrityManager private constructor(private val context: Context) {

    companion object {
        private const val TAG = "PlayIntegrityManager"
        private const val SERVER_URL = "https://api.agentbanking.com"
        private const val CLOUD_PROJECT_NUMBER = "YOUR_CLOUD_PROJECT_NUMBER"
        
        @Volatile
        private var instance: PlayIntegrityManager? = null
        
        fun getInstance(context: Context): PlayIntegrityManager {
            return instance ?: synchronized(this) {
                instance ?: PlayIntegrityManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val integrityManager: IntegrityManager = IntegrityManagerFactory.create(context)

    // MARK: - Token Generation

    /**
     * Request an integrity token from Google Play
     * The nonce should be generated server-side and include request-specific data
     */
    suspend fun requestIntegrityToken(nonce: String): IntegrityTokenResult = withContext(Dispatchers.IO) {
        try {
            // Hash the nonce for additional security
            val hashedNonce = hashNonce(nonce)
            
            val tokenResponse = suspendCancellableCoroutine<IntegrityTokenResponse> { continuation ->
                val request = IntegrityTokenRequest.builder()
                    .setNonce(hashedNonce)
                    .setCloudProjectNumber(CLOUD_PROJECT_NUMBER.toLong())
                    .build()
                
                integrityManager.requestIntegrityToken(request)
                    .addOnSuccessListener { response ->
                        continuation.resume(response)
                    }
                    .addOnFailureListener { exception ->
                        continuation.resumeWithException(exception)
                    }
            }
            
            Log.i(TAG, "Integrity token obtained successfully")
            
            IntegrityTokenResult.Success(
                token = tokenResponse.token(),
                nonce = nonce
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to obtain integrity token", e)
            IntegrityTokenResult.Error(
                errorCode = getErrorCode(e),
                message = e.message ?: "Unknown error"
            )
        }
    }

    private fun hashNonce(nonce: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(nonce.toByteArray())
        return Base64.encodeToString(hash, Base64.NO_WRAP or Base64.URL_SAFE)
    }

    private fun getErrorCode(exception: Exception): Int {
        // Map Play Integrity API error codes
        return when {
            exception.message?.contains("API_NOT_AVAILABLE") == true -> -1
            exception.message?.contains("PLAY_STORE_NOT_FOUND") == true -> -2
            exception.message?.contains("NETWORK_ERROR") == true -> -3
            exception.message?.contains("PLAY_STORE_ACCOUNT_NOT_FOUND") == true -> -4
            exception.message?.contains("APP_NOT_INSTALLED") == true -> -5
            exception.message?.contains("PLAY_SERVICES_NOT_FOUND") == true -> -6
            exception.message?.contains("APP_UID_MISMATCH") == true -> -7
            exception.message?.contains("TOO_MANY_REQUESTS") == true -> -8
            exception.message?.contains("CANNOT_BIND_TO_SERVICE") == true -> -9
            exception.message?.contains("NONCE_TOO_SHORT") == true -> -10
            exception.message?.contains("NONCE_TOO_LONG") == true -> -11
            exception.message?.contains("GOOGLE_SERVER_UNAVAILABLE") == true -> -12
            exception.message?.contains("NONCE_IS_NOT_BASE64") == true -> -13
            exception.message?.contains("CLOUD_PROJECT_NUMBER_IS_INVALID") == true -> -14
            else -> -100
        }
    }

    // MARK: - Server-Side Validation

    /**
     * Send integrity token to server for validation
     * Server will decrypt and verify the token using Google's API
     */
    suspend fun validateTokenWithServer(token: String, nonce: String): IntegrityVerdict = withContext(Dispatchers.IO) {
        try {
            val url = URL("$SERVER_URL/security/play-integrity/validate")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 30000
                readTimeout = 30000
            }
            
            val payload = JSONObject().apply {
                put("integrity_token", token)
                put("nonce", nonce)
                put("package_name", context.packageName)
                put("timestamp", System.currentTimeMillis())
            }
            
            connection.outputStream.use { os ->
                os.write(payload.toString().toByteArray())
            }
            
            val responseCode = connection.responseCode
            
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                parseVerdict(JSONObject(response))
            } else {
                val error = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "Unknown error"
                Log.e(TAG, "Server validation failed: $error")
                IntegrityVerdict(
                    isValid = false,
                    deviceIntegrity = DeviceIntegrity.UNKNOWN,
                    appIntegrity = AppIntegrity.UNKNOWN,
                    accountDetails = AccountDetails.UNKNOWN,
                    errorMessage = error
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to validate token with server", e)
            IntegrityVerdict(
                isValid = false,
                deviceIntegrity = DeviceIntegrity.UNKNOWN,
                appIntegrity = AppIntegrity.UNKNOWN,
                accountDetails = AccountDetails.UNKNOWN,
                errorMessage = e.message
            )
        }
    }

    private fun parseVerdict(json: JSONObject): IntegrityVerdict {
        val deviceRecognitionVerdict = json.optJSONObject("deviceIntegrity")
            ?.optJSONArray("deviceRecognitionVerdict")
        
        val appRecognitionVerdict = json.optJSONObject("appIntegrity")
            ?.optString("appRecognitionVerdict")
        
        val accountLicensingVerdict = json.optJSONObject("accountDetails")
            ?.optString("appLicensingVerdict")
        
        // Parse device integrity
        val deviceIntegrity = when {
            deviceRecognitionVerdict?.toString()?.contains("MEETS_STRONG_INTEGRITY") == true ->
                DeviceIntegrity.MEETS_STRONG_INTEGRITY
            deviceRecognitionVerdict?.toString()?.contains("MEETS_DEVICE_INTEGRITY") == true ->
                DeviceIntegrity.MEETS_DEVICE_INTEGRITY
            deviceRecognitionVerdict?.toString()?.contains("MEETS_BASIC_INTEGRITY") == true ->
                DeviceIntegrity.MEETS_BASIC_INTEGRITY
            else -> DeviceIntegrity.FAILS_INTEGRITY
        }
        
        // Parse app integrity
        val appIntegrity = when (appRecognitionVerdict) {
            "PLAY_RECOGNIZED" -> AppIntegrity.PLAY_RECOGNIZED
            "UNRECOGNIZED_VERSION" -> AppIntegrity.UNRECOGNIZED_VERSION
            "UNEVALUATED" -> AppIntegrity.UNEVALUATED
            else -> AppIntegrity.UNKNOWN
        }
        
        // Parse account details
        val accountDetails = when (accountLicensingVerdict) {
            "LICENSED" -> AccountDetails.LICENSED
            "UNLICENSED" -> AccountDetails.UNLICENSED
            "UNEVALUATED" -> AccountDetails.UNEVALUATED
            else -> AccountDetails.UNKNOWN
        }
        
        val isValid = deviceIntegrity != DeviceIntegrity.FAILS_INTEGRITY &&
                     appIntegrity == AppIntegrity.PLAY_RECOGNIZED
        
        return IntegrityVerdict(
            isValid = isValid,
            deviceIntegrity = deviceIntegrity,
            appIntegrity = appIntegrity,
            accountDetails = accountDetails,
            errorMessage = null
        )
    }

    // MARK: - Full Attestation Flow

    /**
     * Complete attestation flow for high-value transactions
     */
    suspend fun performFullAttestation(transactionId: String): AttestationResult = withContext(Dispatchers.IO) {
        // Step 1: Get nonce from server
        val nonce = getServerNonce(transactionId)
            ?: return@withContext AttestationResult.Error("Failed to get nonce from server")
        
        // Step 2: Request integrity token
        val tokenResult = requestIntegrityToken(nonce)
        
        when (tokenResult) {
            is IntegrityTokenResult.Success -> {
                // Step 3: Validate token with server
                val verdict = validateTokenWithServer(tokenResult.token, tokenResult.nonce)
                
                if (verdict.isValid) {
                    Log.i(TAG, "Full attestation passed")
                    AttestationResult.Success(verdict)
                } else {
                    Log.w(TAG, "Full attestation failed: ${verdict.errorMessage}")
                    AttestationResult.Failed(verdict)
                }
            }
            is IntegrityTokenResult.Error -> {
                Log.e(TAG, "Token request failed: ${tokenResult.message}")
                AttestationResult.Error(tokenResult.message)
            }
        }
    }

    private suspend fun getServerNonce(transactionId: String): String? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$SERVER_URL/security/play-integrity/nonce?transaction_id=$transactionId")
            val connection = url.openConnection() as HttpURLConnection
            
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10000
                readTimeout = 10000
            }
            
            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                JSONObject(response).optString("nonce")
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get nonce from server", e)
            null
        }
    }

    // MARK: - Risk Assessment

    /**
     * Assess device risk based on Play Integrity verdict
     */
    fun assessRisk(verdict: IntegrityVerdict): RiskAssessment {
        var riskScore = 0
        val riskFactors = mutableListOf<String>()
        
        // Device integrity assessment
        when (verdict.deviceIntegrity) {
            DeviceIntegrity.FAILS_INTEGRITY -> {
                riskScore += 50
                riskFactors.add("Device fails integrity checks")
            }
            DeviceIntegrity.MEETS_BASIC_INTEGRITY -> {
                riskScore += 20
                riskFactors.add("Device only meets basic integrity (may be rooted)")
            }
            DeviceIntegrity.MEETS_DEVICE_INTEGRITY -> {
                riskScore += 5
                riskFactors.add("Device meets standard integrity")
            }
            DeviceIntegrity.MEETS_STRONG_INTEGRITY -> {
                // No risk added for strong integrity
            }
            DeviceIntegrity.UNKNOWN -> {
                riskScore += 30
                riskFactors.add("Device integrity unknown")
            }
        }
        
        // App integrity assessment
        when (verdict.appIntegrity) {
            AppIntegrity.UNRECOGNIZED_VERSION -> {
                riskScore += 40
                riskFactors.add("App version not recognized by Play Store")
            }
            AppIntegrity.UNEVALUATED -> {
                riskScore += 20
                riskFactors.add("App integrity not evaluated")
            }
            AppIntegrity.UNKNOWN -> {
                riskScore += 25
                riskFactors.add("App integrity unknown")
            }
            AppIntegrity.PLAY_RECOGNIZED -> {
                // No risk added
            }
        }
        
        // Account assessment
        when (verdict.accountDetails) {
            AccountDetails.UNLICENSED -> {
                riskScore += 15
                riskFactors.add("App not licensed to this account")
            }
            AccountDetails.UNEVALUATED -> {
                riskScore += 10
                riskFactors.add("Account licensing not evaluated")
            }
            AccountDetails.UNKNOWN -> {
                riskScore += 10
                riskFactors.add("Account details unknown")
            }
            AccountDetails.LICENSED -> {
                // No risk added
            }
        }
        
        val riskLevel = when {
            riskScore >= 50 -> RiskLevel.CRITICAL
            riskScore >= 30 -> RiskLevel.HIGH
            riskScore >= 15 -> RiskLevel.MEDIUM
            else -> RiskLevel.LOW
        }
        
        return RiskAssessment(
            score = riskScore,
            level = riskLevel,
            factors = riskFactors,
            allowTransaction = riskLevel != RiskLevel.CRITICAL,
            requireAdditionalVerification = riskLevel == RiskLevel.HIGH
        )
    }
}

// MARK: - Data Classes

sealed class IntegrityTokenResult {
    data class Success(val token: String, val nonce: String) : IntegrityTokenResult()
    data class Error(val errorCode: Int, val message: String) : IntegrityTokenResult()
}

data class IntegrityVerdict(
    val isValid: Boolean,
    val deviceIntegrity: DeviceIntegrity,
    val appIntegrity: AppIntegrity,
    val accountDetails: AccountDetails,
    val errorMessage: String?
)

enum class DeviceIntegrity {
    MEETS_STRONG_INTEGRITY,
    MEETS_DEVICE_INTEGRITY,
    MEETS_BASIC_INTEGRITY,
    FAILS_INTEGRITY,
    UNKNOWN
}

enum class AppIntegrity {
    PLAY_RECOGNIZED,
    UNRECOGNIZED_VERSION,
    UNEVALUATED,
    UNKNOWN
}

enum class AccountDetails {
    LICENSED,
    UNLICENSED,
    UNEVALUATED,
    UNKNOWN
}

sealed class AttestationResult {
    data class Success(val verdict: IntegrityVerdict) : AttestationResult()
    data class Failed(val verdict: IntegrityVerdict) : AttestationResult()
    data class Error(val message: String) : AttestationResult()
}

data class RiskAssessment(
    val score: Int,
    val level: RiskLevel,
    val factors: List<String>,
    val allowTransaction: Boolean,
    val requireAdditionalVerification: Boolean
)

enum class RiskLevel {
    LOW, MEDIUM, HIGH, CRITICAL
}
