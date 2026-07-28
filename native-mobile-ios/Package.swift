// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AGInsuranceApp",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "AGInsuranceApp",
            targets: ["AGInsuranceApp"]),
    ],
    dependencies: [
        // Alamofire for networking
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
        // KeychainAccess for secure storage
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.0"),
    ],
    targets: [
        .target(
            name: "AGInsuranceApp",
            dependencies: ["Alamofire", "KeychainAccess"]),
        .testTarget(
            name: "AGInsuranceAppTests",
            dependencies: ["AGInsuranceApp"]),
    ]
)
