import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const AgentEcommerceDashboard = ({ agentId }) => {
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const response = await fetch(`http://localhost:8010/stores/agent/${agentId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch stores');
                }
                const data = await response.json();
                setStores(data);
                if (data.length > 0) {
                    setSelectedStore(data[0]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStores();
    }, [agentId]);

    useEffect(() => {
        if (selectedStore) {
            const fetchStoreData = async () => {
                try {
                    setLoading(true);
                    const [productsResponse, analyticsResponse] = await Promise.all([
                        fetch(`http://localhost:8010/stores/${selectedStore.id}/products`),
                        fetch(`http://localhost:8010/stores/${selectedStore.id}/analytics`)
                    ]);

                    if (!productsResponse.ok || !analyticsResponse.ok) {
                        throw new Error('Failed to fetch store data');
                    }

                    const productsData = await productsResponse.json();
                    const analyticsData = await analyticsResponse.json();

                    setProducts(productsData);
                    setAnalytics(analyticsData);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };

            fetchStoreData();
        }
    }, [selectedStore]);

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
            className="p-6 bg-gray-100 min-h-screen"
        >
            <h1 className="text-3xl font-bold mb-6">Agent E-commerce Dashboard</h1>

            <div className="mb-6">
                <label htmlFor="store-select" className="block text-sm font-medium text-gray-700">Select Store:</label>
                <select 
                    id="store-select"
                    value={selectedStore ? selectedStore.id : ''}
                    onChange={(e) => setSelectedStore(stores.find(s => s.id === e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    {stores.map(store => (
                        <option key={store.id} value={store.id}>{store.store_name}</option>
                    ))}
                </select>
            </div>

            {selectedStore && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-medium text-gray-700">Total Products</h3>
                            <p className="text-3xl font-bold mt-2">{analytics ? analytics.total_products : 'N/A'}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-medium text-gray-700">Total Orders</h3>
                            <p className="text-3xl font-bold mt-2">{analytics ? analytics.total_orders : 'N/A'}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-medium text-gray-700">Total Revenue</h3>
                            <p className="text-3xl font-bold mt-2">${analytics ? analytics.total_revenue.toFixed(2) : 'N/A'}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-medium text-gray-700">Recent Orders (30 days)</h3>
                            <p className="text-3xl font-bold mt-2">{analytics ? analytics.recent_orders_30_days : 'N/A'}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                        <h2 className="text-2xl font-bold mb-4">Sales Analytics</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={products.map(p => ({ name: p.name, sales: p.inventory_count * p.price }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="sales" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold mb-4">Product Inventory</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inventory</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {products.map(product => (
                                        <tr key={product.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        <img className="h-10 w-10 rounded-full" src={product.images ? product.images[0] : 'https://via.placeholder.com/150'} alt={product.name} />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                        <div className="text-sm text-gray-500">{product.category}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">${product.price.toFixed(2)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{product.inventory_count}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default AgentEcommerceDashboard;

