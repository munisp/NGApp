# Payment Switch Android SDK

Native Android SDK for integrating Payment Switch checkout into your Android app.

## Features

- 🤖 **Native Android** - Built with Kotlin for Android 5.0+
- 💳 **Secure Checkout** - PCI DSS compliant payment processing
- 🎨 **Material Design** - Beautiful checkout experience
- 📱 **Jetpack Compose Support** - Works with both Views and Compose
- 🔒 **Type Safe** - Full Kotlin type safety
- 📦 **Gradle** - Easy integration with Gradle

## Requirements

- Android 5.0 (API 21)+
- Kotlin 1.9+
- Android Studio Arctic Fox+

## Installation

### Gradle

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.paymentswitch:android-sdk:1.0.0")
}
```

Or `build.gradle`:

```groovy
dependencies {
    implementation 'com.paymentswitch:android-sdk:1.0.0'
}
```

### Maven

```xml
<dependency>
    <groupId>com.paymentswitch</groupId>
    <artifactId>android-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Quick Start

### Basic Usage

```kotlin
import com.paymentswitch.PaymentSwitch
import kotlinx.coroutines.launch

class CheckoutActivity : AppCompatActivity() {
    
    private val paymentSwitch = PaymentSwitch(apiKey = "pk_test_your_api_key_here")
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        findViewById<Button>(R.id.checkoutButton).setOnClickListener {
            lifecycleScope.launch {
                paymentSwitch.checkout(
                    activity = this@CheckoutActivity,
                    amount = 5000, // $50.00 in cents
                    currency = "USD",
                    description = "Product Purchase",
                    customerEmail = "customer@example.com"
                )
            }
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == PaymentSwitch.CHECKOUT_REQUEST_CODE) {
            when (data?.getStringExtra(PaymentSwitch.EXTRA_RESULT_TYPE)) {
                PaymentSwitch.RESULT_SUCCESS -> {
                    val sessionId = data.getStringExtra(PaymentSwitch.EXTRA_SESSION_ID)
                    Toast.makeText(this, "Payment successful!", Toast.LENGTH_SHORT).show()
                }
                PaymentSwitch.RESULT_CANCELLED -> {
                    Toast.makeText(this, "Payment cancelled", Toast.LENGTH_SHORT).show()
                }
                PaymentSwitch.RESULT_ERROR -> {
                    val error = data.getStringExtra(PaymentSwitch.EXTRA_ERROR_MESSAGE)
                    Toast.makeText(this, "Error: $error", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
```

### Jetpack Compose

```kotlin
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

@Composable
fun CheckoutScreen() {
    val scope = rememberCoroutineScope()
    val paymentSwitch = remember { PaymentSwitch(apiKey = "pk_test_your_api_key_here") }
    val context = LocalContext.current
    
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        when (result.data?.getStringExtra(PaymentSwitch.EXTRA_RESULT_TYPE)) {
            PaymentSwitch.RESULT_SUCCESS -> {
                Toast.makeText(context, "Payment successful!", Toast.LENGTH_SHORT).show()
            }
            PaymentSwitch.RESULT_CANCELLED -> {
                Toast.makeText(context, "Payment cancelled", Toast.LENGTH_SHORT).show()
            }
            PaymentSwitch.RESULT_ERROR -> {
                val error = result.data?.getStringExtra(PaymentSwitch.EXTRA_ERROR_MESSAGE)
                Toast.makeText(context, "Error: $error", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    Button(
        onClick = {
            scope.launch {
                val session = paymentSwitch.createSession(
                    amount = 5000,
                    currency = "USD",
                    description = "Product Purchase"
                )
                session.onSuccess { paymentSession ->
                    paymentSwitch.launchCheckout(
                        launcher = launcher,
                        activity = context as Activity,
                        sessionId = paymentSession.sessionId
                    )
                }
            }
        }
    ) {
        Text("Pay $50.00")
    }
}
```

## Usage

### Initialize SDK

```kotlin
val paymentSwitch = PaymentSwitch(
    apiKey = "pk_test_your_api_key_here",
    baseUrl = "https://checkout.payment-switch.com" // Optional
)
```

### Create Payment Session

```kotlin
lifecycleScope.launch {
    val result = paymentSwitch.createSession(
        amount = 5000,
        currency = "USD",
        description = "Product Purchase",
        customerEmail = "customer@example.com",
        customerName = "John Doe",
        metadata = mapOf("product_id" to "prod_123")
    )
    
    result.onSuccess { session ->
        Log.d("Payment", "Session created: ${session.sessionId}")
        Log.d("Payment", "Checkout URL: ${session.checkoutUrl}")
    }.onFailure { error ->
        Log.e("Payment", "Error: ${error.message}")
    }
}
```

### Launch Checkout

```kotlin
// Method 1: Using startActivityForResult (legacy)
paymentSwitch.launchCheckout(
    activity = this,
    sessionId = "ps_...",
    requestCode = PaymentSwitch.CHECKOUT_REQUEST_CODE
)

// Method 2: Using ActivityResultLauncher (recommended)
val launcher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
) { result ->
    // Handle result
}

paymentSwitch.launchCheckout(
    launcher = launcher,
    activity = this,
    sessionId = "ps_..."
)
```

### One-Step Checkout

```kotlin
lifecycleScope.launch {
    paymentSwitch.checkout(
        activity = this@MainActivity,
        amount = 5000,
        currency = "USD",
        description = "Product Purchase",
        customerEmail = "customer@example.com",
        onSuccess = { sessionId ->
            Toast.makeText(this@MainActivity, "Payment successful!", Toast.LENGTH_SHORT).show()
        },
        onError = { error ->
            Toast.makeText(this@MainActivity, "Error: ${error.message}", Toast.LENGTH_SHORT).show()
        }
    )
}
```

### Get Session Details

```kotlin
lifecycleScope.launch {
    val result = paymentSwitch.getSession(sessionId = "ps_...")
    
    result.onSuccess { session ->
        Log.d("Payment", "Amount: ${session.amount}")
        Log.d("Payment", "Status: ${session.status}")
    }.onFailure { error ->
        Log.e("Payment", "Error: ${error.message}")
    }
}
```

## Examples

### E-commerce Checkout

```kotlin
class ProductActivity : AppCompatActivity() {
    private val paymentSwitch = PaymentSwitch(apiKey = "pk_test_...")
    private lateinit var product: Product
    
    private val checkoutLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        when (result.data?.getStringExtra(PaymentSwitch.EXTRA_RESULT_TYPE)) {
            PaymentSwitch.RESULT_SUCCESS -> {
                handleSuccessfulPurchase()
            }
            PaymentSwitch.RESULT_CANCELLED -> {
                Toast.makeText(this, "Checkout cancelled", Toast.LENGTH_SHORT).show()
            }
            PaymentSwitch.RESULT_ERROR -> {
                val error = result.data?.getStringExtra(PaymentSwitch.EXTRA_ERROR_MESSAGE)
                showError(error ?: "Unknown error")
            }
        }
    }
    
    private fun buyNow() {
        lifecycleScope.launch {
            val amount = (product.price * 100).toInt()
            
            val result = paymentSwitch.createSession(
                amount = amount,
                currency = "USD",
                description = product.name,
                customerEmail = getCurrentUserEmail(),
                metadata = mapOf(
                    "product_id" to product.id,
                    "product_name" to product.name
                )
            )
            
            result.onSuccess { session ->
                paymentSwitch.launchCheckout(
                    launcher = checkoutLauncher,
                    activity = this@ProductActivity,
                    sessionId = session.sessionId
                )
            }.onFailure { error ->
                showError(error.message ?: "Failed to create session")
            }
        }
    }
    
    private fun handleSuccessfulPurchase() {
        AlertDialog.Builder(this)
            .setTitle("Success!")
            .setMessage("Your purchase was successful")
            .setPositiveButton("OK", null)
            .show()
    }
}
```

### Subscription Flow

```kotlin
class SubscriptionActivity : AppCompatActivity() {
    private val paymentSwitch = PaymentSwitch(apiKey = "pk_test_...")
    
    enum class Plan(val amount: Int, val displayName: String) {
        BASIC(2999, "Basic Plan"),
        PRO(4999, "Pro Plan"),
        ENTERPRISE(9999, "Enterprise Plan")
    }
    
    private fun subscribe(plan: Plan) {
        lifecycleScope.launch {
            paymentSwitch.checkout(
                activity = this@SubscriptionActivity,
                amount = plan.amount,
                currency = "USD",
                description = plan.displayName,
                customerEmail = currentUser.email,
                onSuccess = { sessionId ->
                    activateSubscription(plan, sessionId)
                },
                onError = { error ->
                    showError(error.message ?: "Subscription failed")
                }
            )
        }
    }
    
    private fun activateSubscription(plan: Plan, sessionId: String) {
        // Call your backend to activate subscription
        Log.d("Subscription", "Activating ${plan.displayName} with session: $sessionId")
    }
}
```

### Custom Metadata

```kotlin
lifecycleScope.launch {
    paymentSwitch.checkout(
        activity = this@MainActivity,
        amount = 5000,
        currency = "USD",
        description = "Product Purchase",
        metadata = mapOf(
            "product_id" to "prod_123",
            "quantity" to 2,
            "color" to "blue",
            "size" to "large"
        )
    )
}
```

## Jetpack Compose Integration

### Payment Button Composable

```kotlin
@Composable
fun PaymentButton(
    amount: Int,
    currency: String = "USD",
    description: String,
    onSuccess: () -> Unit = {},
    onError: (String) -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val paymentSwitch = remember { PaymentSwitch(apiKey = "pk_test_...") }
    
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        when (result.data?.getStringExtra(PaymentSwitch.EXTRA_RESULT_TYPE)) {
            PaymentSwitch.RESULT_SUCCESS -> onSuccess()
            PaymentSwitch.RESULT_ERROR -> {
                val error = result.data?.getStringExtra(PaymentSwitch.EXTRA_ERROR_MESSAGE)
                onError(error ?: "Unknown error")
            }
        }
    }
    
    Button(
        onClick = {
            scope.launch {
                val result = paymentSwitch.createSession(
                    amount = amount,
                    currency = currency,
                    description = description
                )
                result.onSuccess { session ->
                    paymentSwitch.launchCheckout(
                        launcher = launcher,
                        activity = context as Activity,
                        sessionId = session.sessionId
                    )
                }
            }
        }
    ) {
        Text("Pay ${currency} ${amount / 100.0}")
    }
}
```

### Product List

```kotlin
@Composable
fun ProductList(products: List<Product>) {
    val context = LocalContext.current
    
    LazyColumn {
        items(products) { product ->
            ProductItem(
                product = product,
                onBuyClick = {
                    // Launch checkout
                }
            )
        }
    }
}
```

## Error Handling

```kotlin
lifecycleScope.launch {
    val result = paymentSwitch.createSession(amount = 5000, currency = "USD")
    
    result.fold(
        onSuccess = { session ->
            Log.d("Payment", "Success: ${session.sessionId}")
        },
        onFailure = { error ->
            when (error) {
                is IOException -> {
                    Log.e("Payment", "Network error: ${error.message}")
                }
                else -> {
                    Log.e("Payment", "Error: ${error.message}")
                }
            }
        }
    )
}
```

## Testing

Use test API keys for development:

```kotlin
val paymentSwitch = PaymentSwitch(apiKey = "pk_test_...")
```

Test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Permissions

Add to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## ProGuard

If using ProGuard, add these rules:

```
-keep class com.paymentswitch.** { *; }
-keepclassmembers class com.paymentswitch.** { *; }
```

## Security

- Never hardcode production API keys in your app
- Use BuildConfig or secure configuration
- Validate payments on your backend
- Use test keys for development

## Support

- Documentation: https://docs.payment-switch.com
- Email: support@payment-switch.com
- GitHub: https://github.com/payment-switch/android-sdk

## License

MIT
