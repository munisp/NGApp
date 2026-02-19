import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const InventoryManagement = ({ storeId }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch(`http://localhost:8010/stores/${storeId}/products`);
                if (!response.ok) {
                    throw new Error('Failed to fetch products');
                }
                const data = await response.json();
                setProducts(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [storeId]);

    const handleUpdateInventory = async (productId, newInventory) => {
        try {
            const response = await fetch(`http://localhost:8010/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inventory_count: newInventory }),
            });

            if (!response.ok) {
                throw new Error('Failed to update inventory');
            }

            setProducts(products.map(p => p.id === productId ? { ...p, inventory_count: newInventory } : p));
            setEditingProduct(null);
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (error) {
        return <div className="text-red-500 text-center mt-10">Error: {error}</div>;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 bg-white rounded-lg shadow-md"
        >
            <h2 className="text-2xl font-bold mb-4">Inventory Management</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inventory</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.map(product => (
                            <tr key={product.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{product.sku}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingProduct === product.id ? (
                                        <input 
                                            type="number"
                                            defaultValue={product.inventory_count}
                                            onBlur={(e) => handleUpdateInventory(product.id, parseInt(e.target.value))}
                                            className="w-20 p-1 border border-gray-300 rounded-md"
                                        />
                                    ) : (
                                        <div className="text-sm text-gray-900">{product.inventory_count}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button 
                                        onClick={() => setEditingProduct(product.id)}
                                        className="text-indigo-600 hover:text-indigo-900"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default InventoryManagement;

