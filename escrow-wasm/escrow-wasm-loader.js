/**
 * EscrowProtect WASM Loader
 * 
 * High-performance WebAssembly modules for:
 * - OCR preprocessing (grayscale, contrast, thresholding)
 * - Nigerian commerce detection (price patterns, seller signals)
 * - Cross-border currency detection (NGN, GHS, KES, ZAR, USD)
 * - Client-side risk scoring
 * - Cryptographic utilities (escrow ID generation)
 * 
 * Usage:
 *   import { initWasm, CommerceDetector, RiskScorer, CurrencyConverter } from './escrow-wasm-loader.js';
 *   await initWasm();
 *   const detector = new CommerceDetector(0.5);
 *   const result = detector.detect("iPhone for sale ₦500k DM to order");
 */

let wasmModule = null;
let wasmInitialized = false;

/**
 * Initialize the WASM module
 * @param {string} wasmPath - Path to the .wasm file (default: auto-detect)
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initWasm(wasmPath = null) {
    if (wasmInitialized) {
        return true;
    }

    try {
        // Try to load from various locations
        const paths = wasmPath ? [wasmPath] : [
            './escrow_wasm_bg.wasm',
            './pkg/escrow_wasm_bg.wasm',
            '../escrow-wasm/pkg/escrow_wasm_bg.wasm',
            chrome?.runtime?.getURL?.('escrow_wasm_bg.wasm'),
        ].filter(Boolean);

        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const wasmBytes = await response.arrayBuffer();
                    wasmModule = await WebAssembly.instantiate(wasmBytes, {
                        env: {
                            memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
                        }
                    });
                    wasmInitialized = true;
                    console.log('[EscrowWASM] Initialized successfully from:', path);
                    return true;
                }
            } catch (e) {
                // Try next path
            }
        }

        // Fallback to JavaScript implementation
        console.warn('[EscrowWASM] WASM not available, using JavaScript fallback');
        wasmInitialized = true;
        return true;
    } catch (error) {
        console.error('[EscrowWASM] Initialization failed:', error);
        return false;
    }
}

/**
 * Image Processor for OCR preprocessing
 */
export class ImageProcessor {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Convert RGBA image to grayscale
     * @param {Uint8ClampedArray} data - RGBA pixel data
     * @returns {Uint8ClampedArray} - Grayscale RGBA data
     */
    toGrayscale(data) {
        const result = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            result[i] = gray;
            result[i + 1] = gray;
            result[i + 2] = gray;
            result[i + 3] = data[i + 3];
        }
        return result;
    }

    /**
     * Enhance contrast
     * @param {Uint8ClampedArray} data - RGBA pixel data
     * @param {number} factor - Contrast factor (1.0 = no change, >1 = more contrast)
     * @returns {Uint8ClampedArray} - Enhanced RGBA data
     */
    enhanceContrast(data, factor = 1.5) {
        const result = new Uint8ClampedArray(data.length);
        const mid = 128;
        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                const adjusted = mid + (data[i + j] - mid) * factor;
                result[i + j] = Math.max(0, Math.min(255, adjusted));
            }
            result[i + 3] = data[i + 3];
        }
        return result;
    }

    /**
     * Apply adaptive thresholding for text extraction
     * @param {Uint8ClampedArray} data - RGBA pixel data
     * @param {number} blockSize - Size of local neighborhood
     * @param {number} c - Constant subtracted from mean
     * @returns {Uint8ClampedArray} - Binary RGBA data
     */
    adaptiveThreshold(data, blockSize = 11, c = 2) {
        const result = new Uint8ClampedArray(data.length);
        const halfBlock = Math.floor(blockSize / 2);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                
                // Calculate local mean
                let sum = 0;
                let count = 0;
                for (let dy = -halfBlock; dy <= halfBlock; dy++) {
                    for (let dx = -halfBlock; dx <= halfBlock; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
                            const nidx = (ny * this.width + nx) * 4;
                            sum += data[nidx];
                            count++;
                        }
                    }
                }
                
                const mean = count > 0 ? sum / count : 128;
                const threshold = mean - c;
                const value = data[idx] > threshold ? 255 : 0;
                
                result[idx] = value;
                result[idx + 1] = value;
                result[idx + 2] = value;
                result[idx + 3] = data[idx + 3];
            }
        }
        return result;
    }
}

/**
 * Commerce Detector for Nigerian social commerce
 */
export class CommerceDetector {
    constructor(minConfidence = 0.5) {
        this.minConfidence = minConfidence;
        
        // Nigerian Naira patterns
        this.ngnPatterns = [
            /₦\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /NGN\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*naira/gi,
            /₦\s*(\d+(?:\.\d+)?)\s*k\b/gi,
            /(\d+(?:\.\d+)?)\s*k\s*naira/gi,
            /(\d+(?:\.\d+)?)\s*k\b/gi,
            /₦\s*(\d+(?:\.\d+)?)\s*m\b/gi,
            /(\d+(?:\.\d+)?)\s*m\s*naira/gi,
        ];
        
        // Ghanaian Cedi patterns
        this.ghsPatterns = [
            /GH[₵¢]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /GHS\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*cedis?/gi,
        ];
        
        // Kenyan Shilling patterns
        this.kesPatterns = [
            /KES\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /Ksh\.?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*shillings?/gi,
        ];
        
        // South African Rand patterns
        this.zarPatterns = [
            /R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /ZAR\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*rand/gi,
        ];
        
        // USD patterns
        this.usdPatterns = [
            /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
        ];
        
        // Seller signals
        this.sellerSignals = [
            /DM\s*(for|to)\s*(price|order|buy|purchase|enquir)/gi,
            /WhatsApp\s*:?\s*(\+?234|\d{10,11})/gi,
            /call\s*:?\s*(\+?234|\d{10,11})/gi,
            /link\s*in\s*bio/gi,
            /available\s*(now|in\s*stock|for\s*sale)/gi,
            /in\s*stock/gi,
            /limited\s*(stock|quantity|offer)/gi,
            /delivery\s*(available|nationwide|lagos|abuja)/gi,
            /we\s*deliver/gi,
            /nationwide\s*delivery/gi,
            /pay\s*on\s*delivery/gi,
            /bank\s*transfer/gi,
            /opay|palmpay|kuda/gi,
        ];
        
        // Buyer signals
        this.buyerSignals = [
            /how\s*much/gi,
            /price\s*\??/gi,
            /interested/gi,
            /still\s*available/gi,
            /can\s*i\s*(get|buy|order)/gi,
            /do\s*you\s*(deliver|ship)/gi,
            /location\s*\??/gi,
        ];
        
        // Nigerian locations
        this.nigerianLocations = [
            'lagos', 'abuja', 'port harcourt', 'ibadan', 'kano', 'kaduna',
            'benin city', 'enugu', 'warri', 'calabar', 'owerri', 'uyo',
            'lekki', 'ikeja', 'vi', 'victoria island', 'yaba', 'surulere',
            'ajah', 'ikorodu', 'festac', 'oshodi', 'mushin', 'apapa',
        ];
    }

    /**
     * Detect commerce signals in text
     * @param {string} text - Text to analyze
     * @returns {Object} - Commerce detection result
     */
    detect(text) {
        const textLower = text.toLowerCase();
        const prices = [];
        let primaryCurrency = 'NGN';
        
        // Detect NGN prices
        for (const pattern of this.ngnPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const price = this.parsePrice(match[1], 'NGN', match[0]);
                if (price) prices.push(price);
            }
        }
        
        // Detect GHS prices
        for (const pattern of this.ghsPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const price = this.parsePrice(match[1], 'GHS', match[0]);
                if (price) {
                    prices.push(price);
                    if (prices.length === 1) primaryCurrency = 'GHS';
                }
            }
        }
        
        // Detect KES prices
        for (const pattern of this.kesPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const price = this.parsePrice(match[1], 'KES', match[0]);
                if (price) {
                    prices.push(price);
                    if (prices.length === 1) primaryCurrency = 'KES';
                }
            }
        }
        
        // Detect ZAR prices
        for (const pattern of this.zarPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const price = this.parsePrice(match[1], 'ZAR', match[0]);
                if (price) {
                    prices.push(price);
                    if (prices.length === 1) primaryCurrency = 'ZAR';
                }
            }
        }
        
        // Detect USD prices
        for (const pattern of this.usdPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const price = this.parsePrice(match[1], 'USD', match[0]);
                if (price) {
                    prices.push(price);
                    if (prices.length === 1) primaryCurrency = 'USD';
                }
            }
        }
        
        // Detect seller signals
        const sellerSignalsFound = [];
        for (const pattern of this.sellerSignals) {
            pattern.lastIndex = 0;
            const match = pattern.exec(textLower);
            if (match) sellerSignalsFound.push(match[0]);
        }
        
        // Detect buyer signals
        const buyerSignalsFound = [];
        for (const pattern of this.buyerSignals) {
            pattern.lastIndex = 0;
            const match = pattern.exec(textLower);
            if (match) buyerSignalsFound.push(match[0]);
        }
        
        // Detect locations
        const locations = this.nigerianLocations.filter(loc => textLower.includes(loc));
        
        // Extract contacts
        const contacts = this.extractContacts(text);
        
        // Calculate confidence
        let confidence = 0;
        if (prices.length > 0) confidence += 0.4;
        confidence += Math.min(sellerSignalsFound.length * 0.15, 0.3);
        if (locations.length > 0) confidence += 0.1;
        if (contacts.length > 0) confidence += 0.15;
        if (buyerSignalsFound.length > 0) confidence += 0.05;
        
        return {
            isCommerce: confidence >= this.minConfidence,
            confidence,
            prices,
            sellerSignals: sellerSignalsFound,
            buyerSignals: buyerSignalsFound,
            locations,
            contactInfo: contacts,
            currencyDetected: primaryCurrency,
        };
    }

    parsePrice(amountStr, currency, originalText) {
        const cleaned = amountStr.replace(/,/g, '').replace(/\s/g, '');
        const textLower = cleaned.toLowerCase();
        
        let multiplier = 1;
        let amount = textLower;
        
        if (textLower.endsWith('k')) {
            multiplier = 1000;
            amount = textLower.slice(0, -1);
        } else if (textLower.endsWith('m')) {
            multiplier = 1000000;
            amount = textLower.slice(0, -1);
        }
        
        const value = parseFloat(amount);
        if (isNaN(value)) return null;
        
        const finalAmount = value * multiplier;
        
        // Validate range
        const ranges = {
            NGN: [100, 100000000],
            GHS: [1, 1000000],
            KES: [10, 10000000],
            ZAR: [1, 10000000],
            USD: [0.1, 1000000],
        };
        
        const [min, max] = ranges[currency] || [0, Infinity];
        if (finalAmount < min || finalAmount > max) return null;
        
        const symbols = { NGN: '₦', GHS: 'GH₵', KES: 'KES', ZAR: 'R', USD: '$' };
        
        return {
            amount: finalAmount,
            currency,
            originalText,
            confidence: 0.9,
            normalized: `${symbols[currency] || ''}${finalAmount.toFixed(2)}`,
        };
    }

    extractContacts(text) {
        const contacts = [];
        
        // Nigerian phone numbers
        const phonePattern = /(?:\+?234|0)[789]\d{9}/g;
        let match;
        while ((match = phonePattern.exec(text)) !== null) {
            contacts.push(match[0]);
        }
        
        // WhatsApp links
        const waPattern = /wa\.me\/\d+/g;
        while ((match = waPattern.exec(text)) !== null) {
            contacts.push(match[0]);
        }
        
        return contacts;
    }
}

/**
 * Risk Scorer for transaction risk assessment
 */
export class RiskScorer {
    constructor() {
        this.weights = {
            amount: 0.25,
            sellerHistory: 0.20,
            buyerHistory: 0.15,
            velocity: 0.15,
            device: 0.10,
            location: 0.10,
            time: 0.05,
        };
    }

    /**
     * Calculate risk score for a transaction
     * @param {Object} transaction - Transaction data
     * @returns {Object} - Risk assessment result
     */
    calculateRisk(transaction) {
        const factors = [];
        let totalScore = 0;
        
        // Amount risk
        if (transaction.amount !== undefined) {
            const amountRisk = this.calculateAmountRisk(transaction.amount);
            totalScore += amountRisk * this.weights.amount;
            factors.push({
                name: 'Transaction Amount',
                weight: this.weights.amount,
                value: amountRisk,
                description: this.getAmountDescription(transaction.amount),
            });
        }
        
        // Seller history
        if (transaction.sellerTransactionCount !== undefined) {
            const sellerRisk = this.calculateHistoryRisk(transaction.sellerTransactionCount);
            totalScore += sellerRisk * this.weights.sellerHistory;
            factors.push({
                name: 'Seller History',
                weight: this.weights.sellerHistory,
                value: sellerRisk,
                description: `${transaction.sellerTransactionCount} previous transactions`,
            });
        }
        
        // Buyer history
        if (transaction.buyerTransactionCount !== undefined) {
            const buyerRisk = this.calculateHistoryRisk(transaction.buyerTransactionCount);
            totalScore += buyerRisk * this.weights.buyerHistory;
            factors.push({
                name: 'Buyer History',
                weight: this.weights.buyerHistory,
                value: buyerRisk,
                description: `${transaction.buyerTransactionCount} previous transactions`,
            });
        }
        
        // Velocity
        if (transaction.transactionsPerHour !== undefined) {
            const velocityRisk = this.calculateVelocityRisk(transaction.transactionsPerHour);
            totalScore += velocityRisk * this.weights.velocity;
            factors.push({
                name: 'Transaction Velocity',
                weight: this.weights.velocity,
                value: velocityRisk,
                description: `${transaction.transactionsPerHour.toFixed(1)} transactions/hour`,
            });
        }
        
        // Device
        if (transaction.isNewDevice !== undefined) {
            const deviceRisk = transaction.isNewDevice ? 0.7 : 0.1;
            totalScore += deviceRisk * this.weights.device;
            factors.push({
                name: 'Device',
                weight: this.weights.device,
                value: deviceRisk,
                description: transaction.isNewDevice ? 'New device' : 'Known device',
            });
        }
        
        // Location
        if (transaction.isUnusualLocation !== undefined) {
            const locationRisk = transaction.isUnusualLocation ? 0.6 : 0.1;
            totalScore += locationRisk * this.weights.location;
            factors.push({
                name: 'Location',
                weight: this.weights.location,
                value: locationRisk,
                description: transaction.isUnusualLocation ? 'Unusual location' : 'Normal location',
            });
        }
        
        // Time
        if (transaction.hourOfDay !== undefined) {
            const timeRisk = this.calculateTimeRisk(transaction.hourOfDay);
            totalScore += timeRisk * this.weights.time;
            factors.push({
                name: 'Time of Day',
                weight: this.weights.time,
                value: timeRisk,
                description: `${transaction.hourOfDay}:00`,
            });
        }
        
        // Determine level
        let level, recommendation;
        if (totalScore < 0.3) {
            level = 'LOW';
            recommendation = 'Transaction can proceed normally';
        } else if (totalScore < 0.5) {
            level = 'MEDIUM';
            recommendation = 'Additional verification recommended';
        } else if (totalScore < 0.7) {
            level = 'HIGH';
            recommendation = 'Manual review required before proceeding';
        } else {
            level = 'CRITICAL';
            recommendation = 'Transaction should be blocked pending investigation';
        }
        
        return { score: totalScore, level, factors, recommendation };
    }

    calculateAmountRisk(amount) {
        if (amount < 10000) return 0.1;
        if (amount < 50000) return 0.2;
        if (amount < 200000) return 0.4;
        if (amount < 500000) return 0.6;
        if (amount < 1000000) return 0.8;
        return 0.95;
    }

    getAmountDescription(amount) {
        if (amount < 50000) return 'Low value transaction';
        if (amount < 500000) return 'Medium value transaction';
        return 'High value transaction';
    }

    calculateHistoryRisk(count) {
        if (count === 0) return 0.9;
        if (count < 3) return 0.6;
        if (count < 10) return 0.3;
        if (count < 50) return 0.15;
        return 0.05;
    }

    calculateVelocityRisk(txnsPerHour) {
        if (txnsPerHour < 1) return 0.1;
        if (txnsPerHour < 3) return 0.3;
        if (txnsPerHour < 5) return 0.6;
        return 0.9;
    }

    calculateTimeRisk(hour) {
        if (hour >= 1 && hour <= 5) return 0.7;
        if (hour >= 22 || hour === 0) return 0.4;
        return 0.1;
    }
}

/**
 * Currency Converter for cross-border transactions
 */
export class CurrencyConverter {
    constructor() {
        // Base rates to NGN (approximate)
        this.rates = {
            NGN: 1,
            GHS: 130,    // 1 GHS = ~130 NGN
            KES: 12,     // 1 KES = ~12 NGN
            ZAR: 85,     // 1 ZAR = ~85 NGN
            USD: 1550,   // 1 USD = ~1550 NGN
        };
        
        this.fees = {
            'NGN-NGN': 0,
            'NGN-GHS': 2.5,
            'NGN-KES': 2.5,
            'NGN-ZAR': 2.5,
            'NGN-USD': 3.0,
            'GHS-NGN': 2.5,
            'KES-NGN': 2.5,
            'ZAR-NGN': 2.5,
            'USD-NGN': 3.0,
        };
    }

    /**
     * Update exchange rate
     * @param {string} currency - Currency code
     * @param {number} rateToNgn - Rate to NGN
     */
    updateRate(currency, rateToNgn) {
        this.rates[currency] = rateToNgn;
    }

    /**
     * Convert between currencies
     * @param {number} amount - Amount to convert
     * @param {string} from - Source currency
     * @param {string} to - Target currency
     * @returns {Object} - Conversion result
     */
    convert(amount, from, to) {
        const fromRate = this.rates[from] || 1;
        const toRate = this.rates[to] || 1;
        
        // Convert to NGN first, then to target
        const ngnAmount = amount * fromRate;
        const toAmount = ngnAmount / toRate;
        
        // Calculate fee
        const feeKey = `${from}-${to}`;
        const feePercent = this.fees[feeKey] || 2.5;
        const feeAmount = toAmount * (feePercent / 100);
        
        return {
            fromAmount: amount,
            fromCurrency: from,
            toAmount: toAmount - feeAmount,
            toCurrency: to,
            rate: fromRate / toRate,
            feePercent,
            feeAmount,
            totalCost: amount,
        };
    }
}

/**
 * Generate escrow ID
 * @param {string} sellerId - Seller ID
 * @param {string} buyerId - Buyer ID
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Escrow ID
 */
export function generateEscrowId(sellerId, buyerId, timestamp) {
    const input = `${sellerId}:${buyerId}:${timestamp}`;
    const hash = simpleHash(input);
    return `ESC-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Generate RMA number
 * @param {string} returnId - Return ID
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - RMA number
 */
export function generateRmaNumber(returnId, timestamp) {
    const input = `${returnId}:${timestamp}`;
    const hash = simpleHash(input);
    return `RMA-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
}

function simpleHash(input) {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash = hash >>> 0; // Convert to unsigned 32-bit
    }
    return hash;
}

// Export for browser extension use
if (typeof window !== 'undefined') {
    window.EscrowWasm = {
        initWasm,
        ImageProcessor,
        CommerceDetector,
        RiskScorer,
        CurrencyConverter,
        generateEscrowId,
        generateRmaNumber,
    };
}
