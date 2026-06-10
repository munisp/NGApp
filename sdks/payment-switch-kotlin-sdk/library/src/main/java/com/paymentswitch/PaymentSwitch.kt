package com.paymentswitch

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * Payment Switch SDK for Android
 */
class PaymentSwitch(
    private val apiKey: String,
    private val baseUrl: String = "https://checkout.payment-switch.com"
) {
    
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    
    /**
     * Create a payment session
     */
    suspend fun createSession(
        amount: Int,
        currency: String = "USD",
        description: String? = null,
        customerEmail: String? = null,
        customerName: String? = null,
        customerPhone: String? = null,
        merchantReference: String? = null,
        successUrl: String? = null,
        cancelUrl: String? = null,
        metadata: Map<String, Any>? = null
    ): Result<PaymentSession> = withContext(Dispatchers.IO) {
        try {
            val requestBody = buildMap {
                put("apiKey", apiKey)
                put("amount", amount)
                put("currency", currency)
                description?.let { put("description", it) }
                customerEmail?.let { put("customerEmail", it) }
                customerName?.let { put("customerName", it) }
                customerPhone?.let { put("customerPhone", it) }
                merchantReference?.let { put("merchantReference", it) }
                successUrl?.let { put("successUrl", it) }
                cancelUrl?.let { put("cancelUrl", it) }
                metadata?.let { put("metadata", it) }
            }
            
            val jsonBody = json.encodeToString(
                kotlinx.serialization.serializer(),
                requestBody
            )
            
            val request = Request.Builder()
                .url("$baseUrl/api/trpc/payment.createSession")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                return@withContext Result.failure(
                    IOException("Failed to create session: ${response.code}")
                )
            }
            
            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(IOException("Empty response"))
            
            val apiResponse = json.decodeFromString<APIResponse<PaymentSession>>(responseBody)
            Result.success(apiResponse.result.data)
            
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get session details
     */
    suspend fun getSession(sessionId: String): Result<SessionDetails> = withContext(Dispatchers.IO) {
        try {
            val queryJson = """{"sessionId":"$sessionId"}"""
            val encodedQuery = java.net.URLEncoder.encode(queryJson, "UTF-8")
            
            val request = Request.Builder()
                .url("$baseUrl/api/trpc/payment.getSession?input=$encodedQuery")
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                return@withContext Result.failure(
                    IOException("Failed to get session: ${response.code}")
                )
            }
            
            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(IOException("Empty response"))
            
            val apiResponse = json.decodeFromString<APIResponse<SessionDetails>>(responseBody)
            Result.success(apiResponse.result.data)
            
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Launch checkout activity
     */
    fun launchCheckout(
        activity: Activity,
        sessionId: String,
        requestCode: Int = CHECKOUT_REQUEST_CODE
    ) {
        val intent = Intent(activity, CheckoutActivity::class.java).apply {
            putExtra(EXTRA_SESSION_ID, sessionId)
            putExtra(EXTRA_BASE_URL, baseUrl)
        }
        activity.startActivityForResult(intent, requestCode)
    }
    
    /**
     * Launch checkout with ActivityResultLauncher (recommended for new code)
     */
    fun launchCheckout(
        launcher: ActivityResultLauncher<Intent>,
        activity: Activity,
        sessionId: String
    ) {
        val intent = Intent(activity, CheckoutActivity::class.java).apply {
            putExtra(EXTRA_SESSION_ID, sessionId)
            putExtra(EXTRA_BASE_URL, baseUrl)
        }
        launcher.launch(intent)
    }
    
    /**
     * Create session and launch checkout in one step
     */
    suspend fun checkout(
        activity: Activity,
        amount: Int,
        currency: String = "USD",
        description: String? = null,
        customerEmail: String? = null,
        onSuccess: (String) -> Unit = {},
        onError: (Exception) -> Unit = {}
    ) {
        val result = createSession(
            amount = amount,
            currency = currency,
            description = description,
            customerEmail = customerEmail
        )
        
        result.fold(
            onSuccess = { session ->
                launchCheckout(activity, session.sessionId)
            },
            onFailure = { error ->
                onError(error as? Exception ?: Exception(error.message))
            }
        )
    }
    
    companion object {
        const val CHECKOUT_REQUEST_CODE = 1001
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_BASE_URL = "base_url"
        const val EXTRA_RESULT_TYPE = "result_type"
        const val RESULT_SUCCESS = "success"
        const val RESULT_CANCELLED = "cancelled"
        const val RESULT_ERROR = "error"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }
}

// MARK: - Models

@Serializable
data class PaymentSession(
    val sessionId: String,
    val checkoutUrl: String,
    val expiresAt: String
)

@Serializable
data class SessionDetails(
    val sessionId: String,
    val amount: Int,
    val currency: String,
    val description: String? = null,
    val status: String,
    val merchantName: String? = null,
    val customerEmail: String? = null,
    val expiresAt: String
)

@Serializable
internal data class APIResponse<T>(
    val result: ResultData<T>
) {
    @Serializable
    data class ResultData<T>(
        val data: T
    )
}

/**
 * Payment result sealed class
 */
sealed class PaymentResult {
    data class Success(val sessionId: String) : PaymentResult()
    object Cancelled : PaymentResult()
    data class Error(val message: String) : PaymentResult()
}
