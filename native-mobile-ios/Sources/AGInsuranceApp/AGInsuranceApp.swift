import Foundation
import SwiftUI

// MARK: - App Entry Point
@main
struct AGInsuranceApp: App {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var networkManager = NetworkManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(networkManager)
        }
    }
}

// MARK: - Content View
struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Home")
                }
            
            PoliciesView()
                .tabItem {
                    Image(systemName: "doc.text.fill")
                    Text("Policies")
                }
            
            ClaimsView()
                .tabItem {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text("Claims")
                }
            
            PaymentsView()
                .tabItem {
                    Image(systemName: "creditcard.fill")
                    Text("Payments")
                }
            
            ProfileView()
                .tabItem {
                    Image(systemName: "person.fill")
                    Text("Profile")
                }
        }
        .accentColor(.blue)
    }
}

// MARK: - Dashboard View
struct DashboardView: View {
    @State private var policies: [Policy] = []
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Welcome Card
                    WelcomeCard()
                    
                    // Quick Actions
                    QuickActionsGrid()
                    
                    // Active Policies Summary
                    PolicySummaryCard(policies: policies)
                    
                    // Recent Activity
                    RecentActivityList()
                }
                .padding()
            }
            .navigationTitle("A&G Insurance")
            .refreshable {
                await loadData()
            }
        }
        .task {
            await loadData()
        }
    }
    
    private func loadData() async {
        isLoading = true
        // Load policies from API
        isLoading = false
    }
}

// MARK: - Welcome Card
struct WelcomeCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Welcome back!")
                .font(.title2)
                .fontWeight(.bold)
            Text("Your insurance is active and up to date")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            LinearGradient(
                gradient: Gradient(colors: [.blue, .blue.opacity(0.8)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .foregroundColor(.white)
        .cornerRadius(16)
    }
}

// MARK: - Quick Actions Grid
struct QuickActionsGrid: View {
    let actions = [
        ("Buy Insurance", "cart.fill", Color.green),
        ("File Claim", "doc.badge.plus", Color.orange),
        ("Make Payment", "creditcard.fill", Color.purple),
        ("Get Quote", "doc.text.magnifyingglass", Color.blue)
    ]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(actions, id: \.0) { action in
                    QuickActionButton(title: action.0, icon: action.1, color: action.2)
                }
            }
        }
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    
    var body: some View {
        Button(action: {}) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(0.1))
            .foregroundColor(color)
            .cornerRadius(12)
        }
    }
}

// MARK: - Policy Summary Card
struct PolicySummaryCard: View {
    let policies: [Policy]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("My Policies")
                    .font(.headline)
                Spacer()
                NavigationLink("View All") {
                    PoliciesView()
                }
                .font(.subheadline)
            }
            
            if policies.isEmpty {
                Text("No active policies")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(policies) { policy in
                    PolicyRow(policy: policy)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Recent Activity List
struct RecentActivityList: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)
            
            VStack(spacing: 8) {
                ActivityRow(title: "Premium Payment", subtitle: "Motor Insurance", date: "Today", icon: "checkmark.circle.fill", color: .green)
                ActivityRow(title: "Policy Renewed", subtitle: "Fire Insurance", date: "Yesterday", icon: "arrow.clockwise", color: .blue)
                ActivityRow(title: "Claim Approved", subtitle: "N250,000", date: "3 days ago", icon: "doc.badge.checkmark", color: .orange)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 2)
    }
}

struct ActivityRow: View {
    let title: String
    let subtitle: String
    let date: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.1))
                .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(date)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Policies View
struct PoliciesView: View {
    @State private var policies: [Policy] = [
        Policy(id: "1", policyNumber: "MOT-2024-001234", type: "Motor Insurance", status: .active, premium: 15000, expiryDate: Date().addingTimeInterval(86400 * 180)),
        Policy(id: "2", policyNumber: "LIF-2024-005678", type: "Life Insurance", status: .active, premium: 120000, expiryDate: Date().addingTimeInterval(86400 * 365)),
        Policy(id: "3", policyNumber: "FIR-2024-009012", type: "Fire Insurance", status: .pending, premium: 85000, expiryDate: Date().addingTimeInterval(86400 * 90))
    ]
    
    var body: some View {
        NavigationView {
            List(policies) { policy in
                NavigationLink(destination: PolicyDetailView(policy: policy)) {
                    PolicyRow(policy: policy)
                }
            }
            .navigationTitle("My Policies")
        }
    }
}

struct PolicyRow: View {
    let policy: Policy
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(policy.type)
                    .font(.headline)
                Text(policy.policyNumber)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text("N\(policy.premium, specifier: "%.0f")")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                StatusBadge(status: policy.status)
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatusBadge: View {
    let status: PolicyStatus
    
    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color.opacity(0.1))
            .foregroundColor(status.color)
            .cornerRadius(8)
    }
}

// MARK: - Policy Detail View
struct PolicyDetailView: View {
    let policy: Policy
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Policy Header
                VStack(spacing: 8) {
                    Text(policy.type)
                        .font(.title2)
                        .fontWeight(.bold)
                    Text(policy.policyNumber)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    StatusBadge(status: policy.status)
                }
                .padding()
                
                // Policy Details
                GroupBox("Policy Details") {
                    DetailRow(label: "Premium", value: "N\(policy.premium, specifier: "%.0f")")
                    DetailRow(label: "Expiry Date", value: policy.expiryDate.formatted(date: .abbreviated, time: .omitted))
                    DetailRow(label: "Status", value: policy.status.rawValue.capitalized)
                }
                
                // Actions
                VStack(spacing: 12) {
                    Button(action: {}) {
                        Label("Download Certificate", systemImage: "arrow.down.doc.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button(action: {}) {
                        Label("File a Claim", systemImage: "doc.badge.plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: {}) {
                        Label("Renew Policy", systemImage: "arrow.clockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            }
        }
        .navigationTitle("Policy Details")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Claims View
struct ClaimsView: View {
    @State private var claims: [Claim] = []
    
    var body: some View {
        NavigationView {
            VStack {
                if claims.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)
                        Text("No Claims")
                            .font(.title2)
                            .fontWeight(.semibold)
                        Text("You haven't filed any claims yet")
                            .foregroundColor(.secondary)
                        
                        Button(action: {}) {
                            Label("File a Claim", systemImage: "plus")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else {
                    List(claims) { claim in
                        ClaimRow(claim: claim)
                    }
                }
            }
            .navigationTitle("My Claims")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {}) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
    }
}

struct ClaimRow: View {
    let claim: Claim
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(claim.claimNumber)
                    .font(.headline)
                Text(claim.type)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text("N\(claim.amount, specifier: "%.0f")")
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Payments View
struct PaymentsView: View {
    var body: some View {
        NavigationView {
            List {
                Section("Pending Payments") {
                    PaymentRow(policyType: "Motor Insurance", amount: 15000, dueDate: Date())
                }
                
                Section("Payment History") {
                    PaymentHistoryRow(policyType: "Life Insurance", amount: 120000, date: Date().addingTimeInterval(-86400 * 30), status: "Paid")
                    PaymentHistoryRow(policyType: "Fire Insurance", amount: 85000, date: Date().addingTimeInterval(-86400 * 60), status: "Paid")
                }
            }
            .navigationTitle("Payments")
        }
    }
}

struct PaymentRow: View {
    let policyType: String
    let amount: Double
    let dueDate: Date
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(policyType)
                    .font(.headline)
                Text("Due: \(dueDate.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Button("Pay N\(amount, specifier: "%.0f")") {}
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
        }
    }
}

struct PaymentHistoryRow: View {
    let policyType: String
    let amount: Double
    let date: Date
    let status: String
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(policyType)
                    .font(.subheadline)
                Text(date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text("N\(amount, specifier: "%.0f")")
                    .font(.subheadline)
                Text(status)
                    .font(.caption)
                    .foregroundColor(.green)
            }
        }
    }
}

// MARK: - Profile View
struct ProfileView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        NavigationView {
            List {
                Section {
                    HStack(spacing: 16) {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.blue)
                        VStack(alignment: .leading) {
                            Text("John Doe")
                                .font(.title2)
                                .fontWeight(.semibold)
                            Text("john.doe@email.com")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                Section("Account") {
                    NavigationLink(destination: Text("Personal Information")) {
                        Label("Personal Information", systemImage: "person.fill")
                    }
                    NavigationLink(destination: Text("Documents")) {
                        Label("My Documents", systemImage: "doc.fill")
                    }
                    NavigationLink(destination: Text("Beneficiaries")) {
                        Label("Beneficiaries", systemImage: "person.2.fill")
                    }
                }
                
                Section("Settings") {
                    NavigationLink(destination: Text("Notifications")) {
                        Label("Notifications", systemImage: "bell.fill")
                    }
                    NavigationLink(destination: Text("Security")) {
                        Label("Security", systemImage: "lock.fill")
                    }
                    NavigationLink(destination: Text("Language")) {
                        Label("Language", systemImage: "globe")
                    }
                }
                
                Section("Support") {
                    NavigationLink(destination: Text("Help Center")) {
                        Label("Help Center", systemImage: "questionmark.circle.fill")
                    }
                    NavigationLink(destination: Text("Contact Us")) {
                        Label("Contact Us", systemImage: "phone.fill")
                    }
                }
                
                Section {
                    Button(action: { authManager.logout() }) {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
}

// MARK: - Login View
struct LoginView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                // Logo
                Image(systemName: "shield.checkered")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("A&G Insurance")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Secure your future with us")
                    .foregroundColor(.secondary)
                
                // Login Form
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                    
                    Button(action: login) {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Sign In")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .disabled(isLoading)
                }
                .padding(.horizontal)
                
                // Additional Options
                VStack(spacing: 12) {
                    Button("Forgot Password?") {}
                        .foregroundColor(.blue)
                    
                    HStack {
                        Text("Don't have an account?")
                            .foregroundColor(.secondary)
                        Button("Sign Up") {}
                            .foregroundColor(.blue)
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
    
    private func login() {
        isLoading = true
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            await MainActor.run {
                authManager.login(email: email, password: password)
                isLoading = false
            }
        }
    }
}

// MARK: - Models
struct Policy: Identifiable {
    let id: String
    let policyNumber: String
    let type: String
    let status: PolicyStatus
    let premium: Double
    let expiryDate: Date
}

enum PolicyStatus: String {
    case active, pending, expired, cancelled
    
    var color: Color {
        switch self {
        case .active: return .green
        case .pending: return .orange
        case .expired: return .red
        case .cancelled: return .gray
        }
    }
}

struct Claim: Identifiable {
    let id: String
    let claimNumber: String
    let type: String
    let amount: Double
    let status: String
    let date: Date
}

// MARK: - Managers
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    
    func login(email: String, password: String) {
        // Simulate login
        isAuthenticated = true
        currentUser = User(id: "1", email: email, name: "John Doe")
    }
    
    func logout() {
        isAuthenticated = false
        currentUser = nil
    }
}

struct User {
    let id: String
    let email: String
    let name: String
}

class NetworkManager: ObservableObject {
    let baseURL = "https://api.aginsuranceplc.com"
    
    func fetchPolicies() async throws -> [Policy] {
        // API call implementation
        return []
    }
    
    func fetchClaims() async throws -> [Claim] {
        // API call implementation
        return []
    }
}
