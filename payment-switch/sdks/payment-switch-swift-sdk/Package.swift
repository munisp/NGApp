// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PaymentSwitch",
    platforms: [
        .iOS(.v14),
        .macOS(.v11)
    ],
    products: [
        .library(
            name: "PaymentSwitch",
            targets: ["PaymentSwitch"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "PaymentSwitch",
            dependencies: []),
        .testTarget(
            name: "PaymentSwitchTests",
            dependencies: ["PaymentSwitch"]),
    ]
)
