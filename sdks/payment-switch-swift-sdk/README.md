# Payment Switch Swift SDK

Native iOS SDK for integrating Payment Switch checkout into your iOS app.

## Features

- 🍎 **Native iOS** - Built with Swift for iOS 14+
- 💳 **Secure Checkout** - PCI DSS compliant payment processing
- 🎨 **Native UI** - Beautiful checkout experience
- 📱 **SwiftUI Support** - Works with both UIKit and SwiftUI
- 🔒 **Type Safe** - Full Swift type safety
- 📦 **Swift Package Manager** - Easy integration

## Requirements

- iOS 14.0+
- Xcode 14.0+
- Swift 5.9+

## Installation

### Swift Package Manager

Add the following to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/payment-switch/swift-sdk.git", from: "1.0.0")
]
```

Or in Xcode:
1. File → Add Packages...
2. Enter package URL: `https://github.com/payment-switch/swift-sdk.git`
3. Click Add Package

### CocoaPods

```ruby
pod 'PaymentSwitch', '~> 1.0'
```

## Quick Start

### UIKit

```swift
import PaymentSwitch

class CheckoutViewController: UIViewController {
    
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_your_api_key_here")
    
    @IBAction func checkoutTapped(_ sender: UIButton) {
        paymentSwitch.checkout(
            amount: 5000, // $50.00 in cents
            currency: "USD",
            description: "Product Purchase",
            from: self,
            onSuccess: { sessionId in
                print("Payment successful: \(sessionId)")
            },
            onCancel: {
                print("Payment cancelled")
            },
            onError: { error in
                print("Payment error: \(error)")
            }
        )
    }
}
```

### SwiftUI

```swift
import SwiftUI
import PaymentSwitch

struct ContentView: View {
    @State private var showingCheckout = false
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_your_api_key_here")
    
    var body: some View {
        Button("Pay $50.00") {
            paymentSwitch.checkout(
                amount: 5000,
                currency: "USD",
                description: "Product Purchase",
                from: UIApplication.shared.windows.first!.rootViewController!,
                onSuccess: { sessionId in
                    print("Payment successful: \(sessionId)")
                }
            )
        }
    }
}
```

## Usage

### Initialize SDK

```swift
import PaymentSwitch

let paymentSwitch = PaymentSwitch(
    apiKey: "pk_test_your_api_key_here",
    baseURL: "https://checkout.payment-switch.com" // Optional
)
```

### Create Payment Session

```swift
paymentSwitch.createSession(
    amount: 5000,
    currency: "USD",
    description: "Product Purchase",
    customerEmail: "customer@example.com",
    customerName: "John Doe",
    metadata: ["product_id": "prod_123"]
) { result in
    switch result {
    case .success(let session):
        print("Session created: \(session.sessionId)")
        print("Checkout URL: \(session.checkoutUrl)")
    case .failure(let error):
        print("Error: \(error)")
    }
}
```

### Present Checkout

```swift
paymentSwitch.presentCheckout(
    sessionId: "ps_...",
    from: self,
    onSuccess: { sessionId in
        // Payment successful
        self.showSuccessAlert()
    },
    onCancel: {
        // User cancelled
        self.showCancelAlert()
    },
    onError: { error in
        // Payment failed
        self.showErrorAlert(error)
    }
)
```

### One-Step Checkout

```swift
paymentSwitch.checkout(
    amount: 5000,
    currency: "USD",
    description: "Product Purchase",
    customerEmail: "customer@example.com",
    from: self,
    onSuccess: { sessionId in
        print("Payment successful!")
    }
)
```

### Get Session Details

```swift
paymentSwitch.getSession(sessionId: "ps_...") { result in
    switch result {
    case .success(let session):
        print("Amount: \(session.amount)")
        print("Status: \(session.status)")
    case .failure(let error):
        print("Error: \(error)")
    }
}
```

## Examples

### E-commerce Checkout

```swift
class ProductViewController: UIViewController {
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_...")
    var product: Product!
    
    @IBAction func buyNowTapped(_ sender: UIButton) {
        let amount = Int(product.price * 100) // Convert to cents
        
        paymentSwitch.checkout(
            amount: amount,
            currency: "USD",
            description: product.name,
            customerEmail: UserDefaults.standard.string(forKey: "userEmail"),
            from: self,
            onSuccess: { [weak self] sessionId in
                self?.handleSuccessfulPurchase(sessionId: sessionId)
            },
            onCancel: {
                print("User cancelled checkout")
            },
            onError: { [weak self] error in
                self?.showError(error)
            }
        )
    }
    
    private func handleSuccessfulPurchase(sessionId: String) {
        // Update UI, send to backend, etc.
        let alert = UIAlertController(
            title: "Success!",
            message: "Your purchase was successful",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}
```

### Subscription Flow

```swift
class SubscriptionViewController: UIViewController {
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_...")
    
    enum Plan {
        case basic, pro, enterprise
        
        var amount: Int {
            switch self {
            case .basic: return 2999      // $29.99
            case .pro: return 4999        // $49.99
            case .enterprise: return 9999 // $99.99
            }
        }
        
        var name: String {
            switch self {
            case .basic: return "Basic Plan"
            case .pro: return "Pro Plan"
            case .enterprise: return "Enterprise Plan"
            }
        }
    }
    
    func subscribe(to plan: Plan) {
        paymentSwitch.checkout(
            amount: plan.amount,
            currency: "USD",
            description: plan.name,
            customerEmail: currentUser.email,
            from: self,
            onSuccess: { [weak self] sessionId in
                self?.activateSubscription(plan: plan, sessionId: sessionId)
            }
        )
    }
    
    private func activateSubscription(plan: Plan, sessionId: String) {
        // Call your backend to activate subscription
        print("Activating \(plan.name) with session: \(sessionId)")
    }
}
```

### Custom Metadata

```swift
paymentSwitch.checkout(
    amount: 5000,
    currency: "USD",
    description: "Product Purchase",
    from: self,
    metadata: [
        "product_id": "prod_123",
        "quantity": 2,
        "color": "blue",
        "size": "large"
    ]
)
```

## SwiftUI Integration

### Basic Button

```swift
struct CheckoutButton: View {
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_...")
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    var body: some View {
        Button("Pay $50.00") {
            checkout()
        }
        .alert(isPresented: $showingAlert) {
            Alert(title: Text("Payment"), message: Text(alertMessage))
        }
    }
    
    func checkout() {
        guard let rootVC = UIApplication.shared.windows.first?.rootViewController else {
            return
        }
        
        paymentSwitch.checkout(
            amount: 5000,
            currency: "USD",
            description: "Product Purchase",
            from: rootVC,
            onSuccess: { _ in
                alertMessage = "Payment successful!"
                showingAlert = true
            },
            onError: { error in
                alertMessage = "Payment failed: \(error.localizedDescription)"
                showingAlert = true
            }
        )
    }
}
```

### Product List

```swift
struct ProductListView: View {
    let products: [Product]
    let paymentSwitch = PaymentSwitch(apiKey: "pk_test_...")
    
    var body: some View {
        List(products) { product in
            HStack {
                VStack(alignment: .leading) {
                    Text(product.name)
                        .font(.headline)
                    Text("$\(product.price, specifier: "%.2f")")
                        .font(.subheadline)
                }
                
                Spacer()
                
                Button("Buy") {
                    buyProduct(product)
                }
            }
        }
    }
    
    func buyProduct(_ product: Product) {
        guard let rootVC = UIApplication.shared.windows.first?.rootViewController else {
            return
        }
        
        let amount = Int(product.price * 100)
        
        paymentSwitch.checkout(
            amount: amount,
            currency: "USD",
            description: product.name,
            from: rootVC,
            onSuccess: { sessionId in
                print("Purchased \(product.name)")
            }
        )
    }
}
```

## Error Handling

```swift
paymentSwitch.createSession(amount: 5000, currency: "USD") { result in
    switch result {
    case .success(let session):
        print("Success: \(session.sessionId)")
        
    case .failure(let error):
        if let psError = error as? PaymentSwitchError {
            switch psError {
            case .noData:
                print("No data received")
            case .invalidResponse:
                print("Invalid response")
            case .sessionExpired:
                print("Session expired")
            case .paymentFailed(let message):
                print("Payment failed: \(message)")
            }
        } else {
            print("Error: \(error.localizedDescription)")
        }
    }
}
```

## Testing

Use test API keys for development:

```swift
let paymentSwitch = PaymentSwitch(apiKey: "pk_test_...")
```

Test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Security

- Never hardcode production API keys in your app
- Use environment variables or secure configuration
- Validate payments on your backend
- Use test keys for development

## Support

- Documentation: https://docs.payment-switch.com
- Email: support@payment-switch.com
- GitHub: https://github.com/payment-switch/swift-sdk

## License

MIT
