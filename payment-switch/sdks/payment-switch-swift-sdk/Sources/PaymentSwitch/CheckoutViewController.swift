import Foundation
#if canImport(UIKit)
import UIKit
import WebKit

/// Checkout view controller with embedded web view
class CheckoutViewController: UIViewController {
    
    // MARK: - Properties
    
    private let sessionId: String
    private let baseURL: URL
    private let onSuccess: ((String) -> Void)?
    private let onCancel: (() -> Void)?
    private let onError: ((Error) -> Void)?
    
    private var webView: WKWebView!
    private var activityIndicator: UIActivityIndicatorView!
    
    // MARK: - Initialization
    
    init(
        sessionId: String,
        baseURL: URL,
        onSuccess: ((String) -> Void)? = nil,
        onCancel: (() -> Void)? = nil,
        onError: ((Error) -> Void)? = nil
    ) {
        self.sessionId = sessionId
        self.baseURL = baseURL
        self.onSuccess = onSuccess
        self.onCancel = onCancel
        self.onError = onError
        
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        loadCheckout()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Navigation bar
        title = "Secure Checkout"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
        
        // Web view configuration
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        
        // Message handler for payment events
        let contentController = WKUserContentController()
        contentController.add(self, name: "paymentHandler")
        configuration.userContentController = contentController
        
        // Create web view
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        
        // Activity indicator
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
        
        // Constraints
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func loadCheckout() {
        let checkoutURL = baseURL.appendingPathComponent("/checkout/\(sessionId)")
        let request = URLRequest(url: checkoutURL)
        
        activityIndicator.startAnimating()
        webView.load(request)
    }
    
    // MARK: - Actions
    
    @objc private func cancelTapped() {
        dismiss(animated: true) { [weak self] in
            self?.onCancel?()
        }
    }
    
    private func handleSuccess() {
        dismiss(animated: true) { [weak self] in
            guard let self = self else { return }
            self.onSuccess?(self.sessionId)
        }
    }
    
    private func handleError(_ error: Error) {
        dismiss(animated: true) { [weak self] in
            self?.onError?(error)
        }
    }
}

// MARK: - WKNavigationDelegate

extension CheckoutViewController: WKNavigationDelegate {
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activityIndicator.stopAnimating()
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        handleError(error)
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Check for success/cancel URLs
        if let url = navigationAction.request.url {
            let urlString = url.absoluteString
            
            if urlString.contains("success=true") {
                decisionHandler(.cancel)
                handleSuccess()
                return
            } else if urlString.contains("cancelled=true") {
                decisionHandler(.cancel)
                cancelTapped()
                return
            }
        }
        
        decisionHandler(.allow)
    }
}

// MARK: - WKScriptMessageHandler

extension CheckoutViewController: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "paymentHandler",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }
        
        switch type {
        case "payment-success":
            handleSuccess()
        case "payment-cancel":
            cancelTapped()
        case "payment-error":
            let errorMessage = body["message"] as? String ?? "Unknown error"
            handleError(PaymentSwitchError.paymentFailed(errorMessage))
        default:
            break
        }
    }
}

#endif
