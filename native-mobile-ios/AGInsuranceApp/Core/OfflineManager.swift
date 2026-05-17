import Foundation
import CoreData

/// Manages offline data caching and sync-on-reconnect for the iOS app.
/// Designed for Nigerian market conditions with intermittent connectivity.
final class OfflineManager {

    static let shared = OfflineManager()

    private let syncQueue = DispatchQueue(label: "com.insurance.offline.sync", qos: .utility)
    private let maxRetries = 5
    private let retryBackoff: TimeInterval = 2.0

    // MARK: - Pending Operations Queue

    /// Queue a local change for sync when connectivity returns
    func queueChange(entityType: String, entityID: String, payload: Data) {
        let record = SyncRecord(context: persistentContainer.viewContext)
        record.id = UUID().uuidString
        record.entityType = entityType
        record.entityID = entityID
        record.payload = payload
        record.status = "pending"
        record.createdAt = Date()
        record.retryCount = 0
        saveContext()
    }

    /// Get count of pending sync operations
    func pendingCount() -> Int {
        let request = NSFetchRequest<SyncRecord>(entityName: "SyncRecord")
        request.predicate = NSPredicate(format: "status == %@", "pending")
        return (try? persistentContainer.viewContext.count(for: request)) ?? 0
    }

    // MARK: - Sync Execution

    /// Attempt to sync all pending changes with the server
    func syncPendingChanges(completion: @escaping (Result<Int, Error>) -> Void) {
        syncQueue.async { [weak self] in
            guard let self = self else { return }

            let request = NSFetchRequest<SyncRecord>(entityName: "SyncRecord")
            request.predicate = NSPredicate(format: "status == %@", "pending")
            request.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]
            request.fetchLimit = 50

            do {
                let pending = try self.persistentContainer.viewContext.fetch(request)
                var synced = 0

                for record in pending {
                    do {
                        try self.pushToServer(record: record)
                        record.status = "completed"
                        record.syncedAt = Date()
                        synced += 1
                    } catch {
                        record.retryCount += 1
                        if record.retryCount >= Int32(self.maxRetries) {
                            record.status = "failed"
                            record.error = error.localizedDescription
                        }
                    }
                }

                self.saveContext()
                DispatchQueue.main.async { completion(.success(synced)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(error)) }
            }
        }
    }

    // MARK: - Network Monitoring

    /// Start monitoring network connectivity and auto-sync
    func startMonitoring() {
        // Use NWPathMonitor for connectivity detection
        // When connectivity is restored, call syncPendingChanges
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(networkStatusChanged),
            name: NSNotification.Name("NetworkStatusChanged"),
            object: nil
        )
    }

    @objc private func networkStatusChanged(_ notification: Notification) {
        if let isConnected = notification.userInfo?["isConnected"] as? Bool, isConnected {
            syncPendingChanges { result in
                switch result {
                case .success(let count):
                    print("Synced \(count) pending changes")
                case .failure(let error):
                    print("Sync failed: \(error)")
                }
            }
        }
    }

    // MARK: - Private

    private func pushToServer(record: SyncRecord) throws {
        // POST to /api/v1/mobile/sync with the record payload
        // This is a blocking sync call for the sync queue
        guard let payload = record.payload,
              let entityType = record.entityType else {
            throw NSError(domain: "OfflineManager", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Missing payload"])
        }

        let url = URL(string: "\(APIConfig.baseURL)/api/v1/mobile/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode([
            "entity_type": entityType,
            "entity_id": record.entityID ?? "",
            "payload": String(data: payload, encoding: .utf8) ?? "",
        ])

        let semaphore = DispatchSemaphore(value: 0)
        var responseError: Error?

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                responseError = error
            } else if let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode >= 400 {
                responseError = NSError(domain: "API", code: httpResponse.statusCode,
                                        userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])
            }
            semaphore.signal()
        }.resume()

        semaphore.wait()
        if let error = responseError { throw error }
    }

    // MARK: - Core Data

    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "OfflineSync")
        container.loadPersistentStores { _, error in
            if let error = error { fatalError("Core Data error: \(error)") }
        }
        return container
    }()

    private func saveContext() {
        let context = persistentContainer.viewContext
        if context.hasChanges {
            try? context.save()
        }
    }
}

/// API configuration
enum APIConfig {
    static var baseURL: String {
        #if DEBUG
        return "http://localhost:8061"
        #else
        return "https://api.insurance-platform.ng"
        #endif
    }
}
