"""
Advanced E-commerce Features
Product Recommendations, Search, and Analytics
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal
import numpy as np
from collections import defaultdict
import json

# ============================================================================
# PRODUCT RECOMMENDATION ENGINE
# ============================================================================

class RecommendationEngine:
    """AI-powered product recommendation engine"""
    
    def __init__(self):
        self.user_item_matrix = {}
        self.item_similarity_matrix = {}
        self.popular_items = []
    
    async def get_recommendations(
        self,
        customer_id: str,
        limit: int = 10,
        strategy: str = "hybrid"
    ) -> List[Dict[str, Any]]:
        """
        Get product recommendations for customer
        
        Strategies:
        - collaborative: Based on similar users
        - content_based: Based on product attributes
        - popular: Most popular products
        - hybrid: Combination of all
        """
        
        if strategy == "collaborative":
            return await self._collaborative_filtering(customer_id, limit)
        elif strategy == "content_based":
            return await self._content_based_filtering(customer_id, limit)
        elif strategy == "popular":
            return await self._popular_products(limit)
        else:  # hybrid
            return await self._hybrid_recommendations(customer_id, limit)
    
    async def _collaborative_filtering(
        self,
        customer_id: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Collaborative filtering recommendations"""
        # Find similar users
        similar_users = await self._find_similar_users(customer_id, top_k=10)
        
        # Get products liked by similar users
        recommendations = defaultdict(float)
        
        for similar_user_id, similarity_score in similar_users:
            user_products = self.user_item_matrix.get(similar_user_id, {})
            
            for product_id, rating in user_products.items():
                # Skip products already purchased
                if product_id in self.user_item_matrix.get(customer_id, {}):
                    continue
                
                recommendations[product_id] += rating * similarity_score
        
        # Sort and return top recommendations
        sorted_recs = sorted(
            recommendations.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                "product_id": product_id,
                "score": float(score),
                "reason": "Customers like you also bought this"
            }
            for product_id, score in sorted_recs
        ]
    
    async def _content_based_filtering(
        self,
        customer_id: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Content-based filtering recommendations"""
        # Get user's purchase history
        user_products = self.user_item_matrix.get(customer_id, {})
        
        if not user_products:
            return await self._popular_products(limit)
        
        # Find similar products
        recommendations = defaultdict(float)
        
        for product_id in user_products.keys():
            similar_products = self.item_similarity_matrix.get(product_id, {})
            
            for similar_product_id, similarity_score in similar_products.items():
                # Skip already purchased
                if similar_product_id in user_products:
                    continue
                
                recommendations[similar_product_id] += similarity_score
        
        # Sort and return
        sorted_recs = sorted(
            recommendations.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                "product_id": product_id,
                "score": float(score),
                "reason": "Similar to products you've purchased"
            }
            for product_id, score in sorted_recs
        ]
    
    async def _popular_products(self, limit: int) -> List[Dict[str, Any]]:
        """Get popular products"""
        return [
            {
                "product_id": product_id,
                "score": 1.0,
                "reason": "Trending now"
            }
            for product_id in self.popular_items[:limit]
        ]
    
    async def _hybrid_recommendations(
        self,
        customer_id: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Hybrid recommendations (combine multiple strategies)"""
        # Get recommendations from each strategy
        collaborative = await self._collaborative_filtering(customer_id, limit)
        content_based = await self._content_based_filtering(customer_id, limit)
        popular = await self._popular_products(limit)
        
        # Combine with weights
        combined_scores = defaultdict(float)
        
        for rec in collaborative:
            combined_scores[rec["product_id"]] += rec["score"] * 0.4
        
        for rec in content_based:
            combined_scores[rec["product_id"]] += rec["score"] * 0.4
        
        for rec in popular:
            combined_scores[rec["product_id"]] += rec["score"] * 0.2
        
        # Sort and return
        sorted_recs = sorted(
            combined_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                "product_id": product_id,
                "score": float(score),
                "reason": "Recommended for you"
            }
            for product_id, score in sorted_recs
        ]
    
    async def _find_similar_users(
        self,
        customer_id: str,
        top_k: int = 10
    ) -> List[tuple]:
        """Find similar users using cosine similarity"""
        user_vector = self._get_user_vector(customer_id)
        
        similarities = []
        for other_user_id in self.user_item_matrix.keys():
            if other_user_id == customer_id:
                continue
            
            other_vector = self._get_user_vector(other_user_id)
            similarity = self._cosine_similarity(user_vector, other_vector)
            
            similarities.append((other_user_id, similarity))
        
        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]
    
    def _get_user_vector(self, customer_id: str) -> np.ndarray:
        """Get user purchase vector"""
        user_products = self.user_item_matrix.get(customer_id, {})
        
        # Create vector (simplified)
        all_products = set()
        for products in self.user_item_matrix.values():
            all_products.update(products.keys())
        
        vector = np.zeros(len(all_products))
        product_list = list(all_products)
        
        for i, product_id in enumerate(product_list):
            if product_id in user_products:
                vector[i] = user_products[product_id]
        
        return vector
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    async def train(self, purchase_history: List[Dict[str, Any]]):
        """Train recommendation model"""
        # Build user-item matrix
        for purchase in purchase_history:
            customer_id = purchase["customer_id"]
            product_id = purchase["product_id"]
            rating = purchase.get("rating", 1.0)
            
            if customer_id not in self.user_item_matrix:
                self.user_item_matrix[customer_id] = {}
            
            self.user_item_matrix[customer_id][product_id] = rating
        
        # Calculate item similarity matrix
        await self._calculate_item_similarity()
        
        # Calculate popular products
        await self._calculate_popular_products()
    
    async def _calculate_item_similarity(self):
        """Calculate product similarity matrix"""
        # Simplified: based on co-purchases
        product_pairs = defaultdict(int)
        product_counts = defaultdict(int)
        
        for user_products in self.user_item_matrix.values():
            products = list(user_products.keys())
            
            for i, product1 in enumerate(products):
                product_counts[product1] += 1
                
                for product2 in products[i+1:]:
                    pair = tuple(sorted([product1, product2]))
                    product_pairs[pair] += 1
        
        # Calculate similarity scores
        for (product1, product2), co_purchase_count in product_pairs.items():
            count1 = product_counts[product1]
            count2 = product_counts[product2]
            
            # Jaccard similarity
            similarity = co_purchase_count / (count1 + count2 - co_purchase_count)
            
            if product1 not in self.item_similarity_matrix:
                self.item_similarity_matrix[product1] = {}
            if product2 not in self.item_similarity_matrix:
                self.item_similarity_matrix[product2] = {}
            
            self.item_similarity_matrix[product1][product2] = similarity
            self.item_similarity_matrix[product2][product1] = similarity
    
    async def _calculate_popular_products(self):
        """Calculate popular products"""
        product_popularity = defaultdict(int)
        
        for user_products in self.user_item_matrix.values():
            for product_id in user_products.keys():
                product_popularity[product_id] += 1
        
        # Sort by popularity
        sorted_products = sorted(
            product_popularity.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        self.popular_items = [product_id for product_id, _ in sorted_products]

# ============================================================================
# PRODUCT SEARCH ENGINE
# ============================================================================

class SearchEngine:
    """Advanced product search with filters and ranking"""
    
    def __init__(self):
        self.products = []
        self.inverted_index = defaultdict(set)
    
    async def search(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "relevance",
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search products
        
        Args:
            query: Search query
            filters: {category, price_min, price_max, rating_min, etc.}
            sort_by: relevance, price_asc, price_desc, rating, newest
            limit: Results per page
            offset: Pagination offset
        """
        
        # Tokenize query
        tokens = self._tokenize(query)
        
        # Find matching products
        matching_products = self._find_matches(tokens)
        
        # Apply filters
        if filters:
            matching_products = self._apply_filters(matching_products, filters)
        
        # Rank results
        ranked_products = self._rank_results(matching_products, tokens, sort_by)
        
        # Paginate
        total = len(ranked_products)
        paginated = ranked_products[offset:offset + limit]
        
        return {
            "query": query,
            "total": total,
            "limit": limit,
            "offset": offset,
            "results": paginated,
            "facets": self._calculate_facets(matching_products)
        }
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text"""
        # Simple tokenization (in production, use proper NLP)
        return text.lower().split()
    
    def _find_matches(self, tokens: List[str]) -> List[Dict[str, Any]]:
        """Find products matching tokens"""
        matching_product_ids = set()
        
        for token in tokens:
            matching_product_ids.update(self.inverted_index.get(token, set()))
        
        # Get full product data
        matching_products = [
            product for product in self.products
            if product["id"] in matching_product_ids
        ]
        
        return matching_products
    
    def _apply_filters(
        self,
        products: List[Dict[str, Any]],
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply filters to products"""
        filtered = products
        
        if "category" in filters:
            filtered = [
                p for p in filtered
                if p.get("category") == filters["category"]
            ]
        
        if "price_min" in filters:
            filtered = [
                p for p in filtered
                if p.get("price", 0) >= filters["price_min"]
            ]
        
        if "price_max" in filters:
            filtered = [
                p for p in filtered
                if p.get("price", float('inf')) <= filters["price_max"]
            ]
        
        if "rating_min" in filters:
            filtered = [
                p for p in filtered
                if p.get("rating", 0) >= filters["rating_min"]
            ]
        
        if "in_stock" in filters and filters["in_stock"]:
            filtered = [
                p for p in filtered
                if p.get("stock", 0) > 0
            ]
        
        return filtered
    
    def _rank_results(
        self,
        products: List[Dict[str, Any]],
        tokens: List[str],
        sort_by: str
    ) -> List[Dict[str, Any]]:
        """Rank search results"""
        
        if sort_by == "relevance":
            # Calculate relevance score
            for product in products:
                product["_score"] = self._calculate_relevance(product, tokens)
            
            products.sort(key=lambda p: p["_score"], reverse=True)
        
        elif sort_by == "price_asc":
            products.sort(key=lambda p: p.get("price", 0))
        
        elif sort_by == "price_desc":
            products.sort(key=lambda p: p.get("price", 0), reverse=True)
        
        elif sort_by == "rating":
            products.sort(key=lambda p: p.get("rating", 0), reverse=True)
        
        elif sort_by == "newest":
            products.sort(
                key=lambda p: p.get("created_at", datetime.min),
                reverse=True
            )
        
        return products
    
    def _calculate_relevance(
        self,
        product: Dict[str, Any],
        tokens: List[str]
    ) -> float:
        """Calculate relevance score (TF-IDF simplified)"""
        score = 0.0
        
        # Check name
        name = product.get("name", "").lower()
        for token in tokens:
            if token in name:
                score += 2.0  # Name matches are important
        
        # Check description
        description = product.get("description", "").lower()
        for token in tokens:
            if token in description:
                score += 1.0
        
        # Check tags
        tags = product.get("tags", [])
        for token in tokens:
            if token in [t.lower() for t in tags]:
                score += 1.5
        
        # Boost by rating
        rating = product.get("rating", 0)
        score *= (1 + rating / 10)
        
        return score
    
    def _calculate_facets(
        self,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate facets for filtering"""
        facets = {
            "categories": defaultdict(int),
            "price_ranges": defaultdict(int),
            "ratings": defaultdict(int)
        }
        
        for product in products:
            # Category facet
            category = product.get("category")
            if category:
                facets["categories"][category] += 1
            
            # Price range facet
            price = product.get("price", 0)
            if price < 25:
                facets["price_ranges"]["0-25"] += 1
            elif price < 50:
                facets["price_ranges"]["25-50"] += 1
            elif price < 100:
                facets["price_ranges"]["50-100"] += 1
            else:
                facets["price_ranges"]["100+"] += 1
            
            # Rating facet
            rating = int(product.get("rating", 0))
            facets["ratings"][f"{rating}_stars"] += 1
        
        return {
            "categories": dict(facets["categories"]),
            "price_ranges": dict(facets["price_ranges"]),
            "ratings": dict(facets["ratings"])
        }
    
    async def index_products(self, products: List[Dict[str, Any]]):
        """Index products for search"""
        self.products = products
        self.inverted_index = defaultdict(set)
        
        for product in products:
            product_id = product["id"]
            
            # Index name
            name_tokens = self._tokenize(product.get("name", ""))
            for token in name_tokens:
                self.inverted_index[token].add(product_id)
            
            # Index description
            desc_tokens = self._tokenize(product.get("description", ""))
            for token in desc_tokens:
                self.inverted_index[token].add(product_id)
            
            # Index tags
            tags = product.get("tags", [])
            for tag in tags:
                tag_tokens = self._tokenize(tag)
                for token in tag_tokens:
                    self.inverted_index[token].add(product_id)

# ============================================================================
# ANALYTICS ENGINE
# ============================================================================

class AnalyticsEngine:
    """E-commerce analytics and reporting"""
    
    async def get_dashboard_metrics(
        self,
        store_id: str,
        date_range: tuple[datetime, datetime]
    ) -> Dict[str, Any]:
        """Get dashboard metrics"""
        start_date, end_date = date_range
        
        # In production, query from database
        return {
            "revenue": {
                "total": 125000.50,
                "change_percentage": 15.3,
                "trend": "up"
            },
            "orders": {
                "total": 1250,
                "change_percentage": 8.7,
                "trend": "up"
            },
            "customers": {
                "total": 850,
                "new": 120,
                "returning": 730,
                "change_percentage": 12.1
            },
            "conversion_rate": {
                "rate": 3.2,
                "change_percentage": 0.5
            },
            "average_order_value": {
                "value": 100.00,
                "change_percentage": 5.2
            },
            "top_products": await self._get_top_products(store_id, 5),
            "top_categories": await self._get_top_categories(store_id, 5),
            "revenue_by_day": await self._get_revenue_trend(store_id, start_date, end_date)
        }
    
    async def _get_top_products(self, store_id: str, limit: int) -> List[Dict]:
        """Get top selling products"""
        # Mock data
        return [
            {"product_id": "p1", "name": "Product 1", "sales": 150, "revenue": 15000},
            {"product_id": "p2", "name": "Product 2", "sales": 120, "revenue": 12000},
            {"product_id": "p3", "name": "Product 3", "sales": 100, "revenue": 10000},
        ]
    
    async def _get_top_categories(self, store_id: str, limit: int) -> List[Dict]:
        """Get top categories"""
        return [
            {"category": "Electronics", "sales": 500, "revenue": 50000},
            {"category": "Clothing", "sales": 400, "revenue": 40000},
        ]
    
    async def _get_revenue_trend(
        self,
        store_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Get revenue trend"""
        # Mock data
        days = (end_date - start_date).days
        trend = []
        
        for i in range(days + 1):
            date = start_date + timedelta(days=i)
            trend.append({
                "date": date.isoformat(),
                "revenue": 1000 + (i * 50),
                "orders": 10 + i
            })
        
        return trend

