/**
 * Multi-lingual E-commerce Product List
 * Example implementation with Nigerian languages support
 */

import React, { useState } from 'react';
import { TranslationProvider, useTranslation, LanguageSelector } from '../../../shared/useTranslation';

function ProductListContent() {
  const { t } = useTranslation('ecommerce');
  const { t: tCommon } = useTranslation('common');
  const { t: tMessages } = useTranslation('messages');
  
  const [products] = useState([
    { id: 1, name: 'Rice (50kg)', price: 45000, stock: 20 },
    { id: 2, name: 'Vegetable Oil (5L)', price: 8500, stock: 15 },
    { id: 3, name: 'Sugar (2kg)', price: 2500, stock: 30 },
    { id: 4, name: 'Flour (10kg)', price: 12000, stock: 0 }
  ]);

  const [cart, setCart] = useState([]);

  const addToCart = (product) => {
    if (product.stock === 0) {
      alert(tMessages('error'));
      return;
    }
    
    setCart([...cart, product]);
    alert(tMessages('success'));
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  };

  return (
    <div className="ecommerce-container">
      {/* Header */}
      <header className="ecommerce-header">
        <h1>{t('products')}</h1>
        <div className="header-actions">
          <LanguageSelector />
          <button className="cart-btn">
            {t('cart')} ({cart.length})
          </button>
        </div>
      </header>

      {/* Product Grid */}
      <div className="product-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <div className="product-image">
              <span className="product-icon">📦</span>
            </div>
            <div className="product-info">
              <h3 className="product-name">{product.name}</h3>
              <div className="product-price">
                {t('price')}: ₦{product.price.toLocaleString('en-NG')}
              </div>
              <div className="product-stock">
                {product.stock > 0 ? (
                  <span className="in-stock">
                    ✓ {t('in_stock', 'In Stock')} ({product.stock})
                  </span>
                ) : (
                  <span className="out-of-stock">
                    ✗ {t('out_of_stock', 'Out of Stock')}
                  </span>
                )}
              </div>
              <button
                className="add-to-cart-btn"
                onClick={() => addToCart(product)}
                disabled={product.stock === 0}
              >
                {t('add_to_cart')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Shopping Cart */}
      {cart.length > 0 && (
        <div className="cart-summary">
          <h2>{t('cart')}</h2>
          <div className="cart-items">
            {cart.map((item, index) => (
              <div key={index} className="cart-item">
                <span>{item.name}</span>
                <span>₦{item.price.toLocaleString('en-NG')}</span>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <strong>{t('total')}:</strong>
            <strong>₦{getTotalPrice().toLocaleString('en-NG')}</strong>
          </div>
          <button className="checkout-btn">
            {t('checkout')}
          </button>
        </div>
      )}

      <style jsx>{`
        .ecommerce-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .ecommerce-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .cart-btn {
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .product-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
          transition: transform 0.2s;
        }

        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .product-image {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .product-icon {
          font-size: 64px;
        }

        .product-info {
          padding: 20px;
        }

        .product-name {
          margin: 0 0 10px 0;
          font-size: 18px;
        }

        .product-price {
          font-size: 20px;
          font-weight: bold;
          color: #667eea;
          margin-bottom: 10px;
        }

        .product-stock {
          margin-bottom: 15px;
        }

        .in-stock {
          color: #10b981;
          font-weight: 500;
        }

        .out-of-stock {
          color: #ef4444;
          font-weight: 500;
        }

        .add-to-cart-btn {
          width: 100%;
          padding: 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .add-to-cart-btn:hover:not(:disabled) {
          background: #5568d3;
        }

        .add-to-cart-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .cart-summary {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          position: sticky;
          bottom: 20px;
        }

        .cart-items {
          margin: 15px 0;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }

        .cart-total {
          display: flex;
          justify-content: space-between;
          padding: 15px 0;
          font-size: 18px;
          border-top: 2px solid #667eea;
          margin-top: 10px;
        }

        .checkout-btn {
          width: 100%;
          padding: 15px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 15px;
        }

        .checkout-btn:hover {
          background: #059669;
        }
      `}</style>
    </div>
  );
}

export default function MultilingualProductList() {
  return (
    <TranslationProvider module="ecommerce" defaultLanguage="en">
      <ProductListContent />
    </TranslationProvider>
  );
}

