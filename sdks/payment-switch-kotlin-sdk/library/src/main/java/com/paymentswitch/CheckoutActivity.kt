package com.paymentswitch

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.MenuItem
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity

/**
 * Checkout activity with embedded WebView
 */
class CheckoutActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var sessionId: String
    private lateinit var baseUrl: String
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Get parameters
        sessionId = intent.getStringExtra(PaymentSwitch.EXTRA_SESSION_ID)
            ?: run {
                finishWithError("Session ID not provided")
                return
            }
        
        baseUrl = intent.getStringExtra(PaymentSwitch.EXTRA_BASE_URL)
            ?: "https://checkout.payment-switch.com"
        
        // Setup UI
        setupActionBar()
        setupWebView()
        loadCheckout()
    }
    
    private fun setupActionBar() {
        supportActionBar?.apply {
            title = "Secure Checkout"
            setDisplayHomeAsUpEnabled(true)
        }
    }
    
    private fun setupWebView() {
        // Create layout programmatically
        val layout = android.widget.RelativeLayout(this).apply {
            layoutParams = android.widget.RelativeLayout.LayoutParams(
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT,
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT
            )
        }
        
        // WebView
        webView = WebView(this).apply {
            id = View.generateViewId()
            layoutParams = android.widget.RelativeLayout.LayoutParams(
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT,
                android.widget.RelativeLayout.LayoutParams.MATCH_PARENT
            )
            
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
            }
            
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    progressBar.visibility = View.GONE
                    
                    // Check for success/cancel in URL
                    url?.let { checkUrl(it) }
                }
            }
            
            // Add JavaScript interface for payment events
            addJavascriptInterface(PaymentHandler(), "paymentHandler")
        }
        
        // Progress bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleLarge).apply {
            layoutParams = android.widget.RelativeLayout.LayoutParams(
                android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT,
                android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                addRule(android.widget.RelativeLayout.CENTER_IN_PARENT)
            }
        }
        
        layout.addView(webView)
        layout.addView(progressBar)
        
        setContentView(layout)
    }
    
    private fun loadCheckout() {
        val checkoutUrl = "$baseUrl/checkout/$sessionId"
        webView.loadUrl(checkoutUrl)
    }
    
    private fun checkUrl(url: String) {
        when {
            url.contains("success=true") -> finishWithSuccess()
            url.contains("cancelled=true") -> finishWithCancel()
        }
    }
    
    private fun finishWithSuccess() {
        val intent = Intent().apply {
            putExtra(PaymentSwitch.EXTRA_RESULT_TYPE, PaymentSwitch.RESULT_SUCCESS)
            putExtra(PaymentSwitch.EXTRA_SESSION_ID, sessionId)
        }
        setResult(Activity.RESULT_OK, intent)
        finish()
    }
    
    private fun finishWithCancel() {
        val intent = Intent().apply {
            putExtra(PaymentSwitch.EXTRA_RESULT_TYPE, PaymentSwitch.RESULT_CANCELLED)
        }
        setResult(Activity.RESULT_CANCELED, intent)
        finish()
    }
    
    private fun finishWithError(message: String) {
        val intent = Intent().apply {
            putExtra(PaymentSwitch.EXTRA_RESULT_TYPE, PaymentSwitch.RESULT_ERROR)
            putExtra(PaymentSwitch.EXTRA_ERROR_MESSAGE, message)
        }
        setResult(Activity.RESULT_CANCELED, intent)
        finish()
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                finishWithCancel()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            finishWithCancel()
        }
    }
    
    /**
     * JavaScript interface for payment events
     */
    inner class PaymentHandler {
        @JavascriptInterface
        fun onPaymentSuccess(sessionId: String) {
            runOnUiThread {
                finishWithSuccess()
            }
        }
        
        @JavascriptInterface
        fun onPaymentCancel() {
            runOnUiThread {
                finishWithCancel()
            }
        }
        
        @JavascriptInterface
        fun onPaymentError(message: String) {
            runOnUiThread {
                finishWithError(message)
            }
        }
    }
}
