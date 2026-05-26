import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Payment Switch SDK for iOS
public class PaymentSwitch {
    
    // MARK: - Properties
    
    private let apiKey: String
    private let baseURL: URL
    private let session: URLSession
    
    // MARK: - Initialization
    
    /// Initialize Payment Switch SDK
    /// - Parameters:
    ///   - apiKey: Your Payment Switch API key
    ///   - baseURL: Base URL for the API (optional, defaults to production)
    public init(apiKey: String, baseURL: String = "https://checkout.payment-switch.com") {
        self.apiKey = apiKey
        self.baseURL = URL(string: baseURL)!
        self.session = URLSession.shared
    }
    
    // MARK: - Public Methods
    
    /// Create a payment session
    /// - Parameters:
    ///   - amount: Amount in smallest currency unit (cents)
    ///   - currency: Currency code (default: USD)
    ///   - description: Payment description
    ///   - customerEmail: Customer email
    ///   - customerName: Customer name
    ///   - customerPhone: Customer phone
    ///   - merchantReference: Your internal reference
    ///   - successURL: Redirect URL after success
    ///   - cancelURL: Redirect URL after cancellation
    ///   - metadata: Custom metadata
    ///   - completion: Completion handler with result
    public func createSession(
        amount: Int,
        currency: String = "USD",
        description: String? = nil,
        customerEmail: String? = nil,
        customerName: String? = nil,
        customerPhone: String? = nil,
        merchantReference: String? = nil,
        successURL: String? = nil,
        cancelURL: String? = nil,
        metadata: [String: Any]? = nil,
        completion: @escaping (Result<PaymentSession, Error>) -> Void
    ) {
        let endpoint = baseURL.appendingPathComponent("/api/trpc/payment.createSession")
        
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "apiKey": apiKey,
            "amount": amount,
            "currency": currency
        ]
        
        if let description = description { body["description"] = description }
        if let customerEmail = customerEmail { body["customerEmail"] = customerEmail }
        if let customerName = customerName { body["customerName"] = customerName }
        if let customerPhone = customerPhone { body["customerPhone"] = customerPhone }
        if let merchantReference = merchantReference { body["merchantReference"] = merchantReference }
        if let successURL = successURL { body["successUrl"] = successURL }
        if let cancelURL = cancelURL { body["cancelUrl"] = cancelURL }
        if let metadata = metadata { body["metadata"] = metadata }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(error))
            return
        }
        
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(PaymentSwitchError.noData))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                let response = try decoder.decode(APIResponse<PaymentSession>.self, from: data)
                completion(.success(response.result.data))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    /// Get session details
    /// - Parameters:
    ///   - sessionId: Payment session ID
    ///   - completion: Completion handler with result
    public func getSession(
        sessionId: String,
        completion: @escaping (Result<SessionDetails, Error>) -> Void
    ) {
        let queryString = try! JSONSerialization.data(withJSONObject: ["sessionId": sessionId])
        let encodedQuery = String(data: queryString, encoding: .utf8)!.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
        
        let endpoint = baseURL.appendingPathComponent("/api/trpc/payment.getSession")
            .appendingPathComponent("?input=\(encodedQuery)")
        
        var request = URLRequest(url: endpoint)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(PaymentSwitchError.noData))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                let response = try decoder.decode(APIResponse<SessionDetails>.self, from: data)
                completion(.success(response.result.data))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    #if canImport(UIKit)
    /// Present checkout view controller
    /// - Parameters:
    ///   - sessionId: Payment session ID
    ///   - presentingViewController: View controller to present from
    ///   - onSuccess: Called when payment succeeds
    ///   - onCancel: Called when payment is cancelled
    ///   - onError: Called when an error occurs
    public func presentCheckout(
        sessionId: String,
        from presentingViewController: UIViewController,
        onSuccess: ((String) -> Void)? = nil,
        onCancel: (() -> Void)? = nil,
        onError: ((Error) -> Void)? = nil
    ) {
        let checkoutVC = CheckoutViewController(
            sessionId: sessionId,
            baseURL: baseURL,
            onSuccess: onSuccess,
            onCancel: onCancel,
            onError: onError
        )
        
        let navigationController = UINavigationController(rootViewController: checkoutVC)
        navigationController.modalPresentationStyle = .fullScreen
        
        presentingViewController.present(navigationController, animated: true)
    }
    
    /// Create session and present checkout in one step
    /// - Parameters:
    ///   - amount: Amount in smallest currency unit (cents)
    ///   - currency: Currency code
    ///   - description: Payment description
    ///   - customerEmail: Customer email
    ///   - presentingViewController: View controller to present from
    ///   - onSuccess: Called when payment succeeds
    ///   - onCancel: Called when payment is cancelled
    ///   - onError: Called when an error occurs
    public func checkout(
        amount: Int,
        currency: String = "USD",
        description: String? = nil,
        customerEmail: String? = nil,
        from presentingViewController: UIViewController,
        onSuccess: ((String) -> Void)? = nil,
        onCancel: (() -> Void)? = nil,
        onError: ((Error) -> Void)? = nil
    ) {
        createSession(
            amount: amount,
            currency: currency,
            description: description,
            customerEmail: customerEmail
        ) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let session):
                    self?.presentCheckout(
                        sessionId: session.sessionId,
                        from: presentingViewController,
                        onSuccess: onSuccess,
                        onCancel: onCancel,
                        onError: onError
                    )
                case .failure(let error):
                    onError?(error)
                }
            }
        }
    }
    #endif
}

// MARK: - Models

/// Payment session response
public struct PaymentSession: Codable {
    public let sessionId: String
    public let checkoutUrl: String
    public let expiresAt: String
}

/// Session details
public struct SessionDetails: Codable {
    public let sessionId: String
    public let amount: Int
    public let currency: String
    public let description: String?
    public let status: String
    public let merchantName: String?
    public let customerEmail: String?
    public let expiresAt: String
}

/// API response wrapper
struct APIResponse<T: Codable>: Codable {
    let result: ResultData<T>
    
    struct ResultData<T: Codable>: Codable {
        let data: T
    }
}

/// Payment Switch errors
public enum PaymentSwitchError: Error {
    case noData
    case invalidResponse
    case sessionExpired
    case paymentFailed(String)
    
    public var localizedDescription: String {
        switch self {
        case .noData:
            return "No data received from server"
        case .invalidResponse:
            return "Invalid response from server"
        case .sessionExpired:
            return "Payment session has expired"
        case .paymentFailed(let message):
            return "Payment failed: \(message)"
        }
    }
}
