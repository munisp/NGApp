"""
FalkorDB service for graph database integration.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Union, Tuple
import falkordb
import redis.asyncio as redis
from datetime import datetime
from uuid import UUID, uuid4

from ..config.config import config
from ..models.base_models import (
    GraphNode, GraphEdge, GraphQuery, GraphQueryResult,
    CustomerProfile, CustomerEvent, TransactionEvent,
    FraudEvent, CustomerInsight, CustomerRecommendation
)

logger = logging.getLogger(__name__)

class FalkorDBService:
    """Service for interacting with FalkorDB graph database."""
    
    def __init__(self):
        """Initialize the FalkorDB service."""
        self.host = config.falkordb.host
        self.port = config.falkordb.port
        self.password = config.falkordb.password
        self.db = config.falkordb.db
        self.client = None
        self.pool = None
        self.graph_name = "banking_crm_graph"
        
    async def connect(self):
        """Connect to FalkorDB."""
        try:
            # Create connection pool
            self.pool = redis.ConnectionPool(
                host=self.host,
                port=self.port,
                password=self.password,
                db=self.db,
                decode_responses=True
            )
            
            # Create Redis client
            redis_client = redis.Redis(connection_pool=self.pool)
            
            # Test connection
            await redis_client.ping()
            
            # Create FalkorDB client
            self.client = falkordb.FalkorDB(redis_client)
            
            logger.info(f"Connected to FalkorDB at {self.host}:{self.port}")
            
            # Initialize graph schema
            await self.initialize_schema()
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to FalkorDB: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from FalkorDB."""
        if self.pool:
            await self.pool.disconnect()
            logger.info("Disconnected from FalkorDB")
    
    async def initialize_schema(self):
        """Initialize the graph schema."""
        try:
            # Define indices for efficient querying
            indices = [
                "CREATE INDEX ON :Customer(customer_id)",
                "CREATE INDEX ON :Account(account_id)",
                "CREATE INDEX ON :Transaction(transaction_id)",
                "CREATE INDEX ON :Product(product_id)",
                "CREATE INDEX ON :Agent(agent_id)",
                "CREATE INDEX ON :Campaign(campaign_id)",
                "CREATE INDEX ON :FraudAlert(alert_id)",
                "CREATE INDEX ON :Interaction(interaction_id)",
                "CREATE INDEX ON :Device(device_id)",
                "CREATE INDEX ON :Location(location_id)",
                "CREATE INDEX ON :Merchant(merchant_id)",
                "CREATE INDEX ON :Recommendation(recommendation_id)",
                "CREATE INDEX ON :Insight(insight_id)",
                "CREATE INDEX ON :Risk(risk_id)",
                "CREATE INDEX ON :Segment(segment_id)",
                "CREATE INDEX ON :Journey(journey_id)",
                "CREATE INDEX ON :Event(event_id)",
                "CREATE INDEX ON :Platform(platform_id)"
            ]
            
            # Execute schema creation queries
            for index_query in indices:
                try:
                    await self.execute_query(index_query)
                except Exception as e:
                    # Index might already exist, which is fine
                    if "already exists" not in str(e):
                        logger.warning(f"Failed to create index: {e}")
            
            logger.info("FalkorDB schema initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize FalkorDB schema: {e}")
            return False
    
    async def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a Cypher query against FalkorDB.
        
        Args:
            query: Cypher query string
            params: Query parameters
            
        Returns:
            Query result
        """
        if not self.client:
            await self.connect()
        
        try:
            # Execute query
            result = await self.client.graph.query(self.graph_name, query, params or {})
            return result
        except Exception as e:
            logger.error(f"Failed to execute query: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            raise
    
    async def create_node(self, node: GraphNode) -> str:
        """
        Create a node in the graph.
        
        Args:
            node: Node to create
            
        Returns:
            Node ID
        """
        # Convert node to dictionary
        node_dict = node.dict()
        
        # Extract node type and properties
        node_type = node_dict.pop("node_type")
        properties = node_dict.pop("properties", {})
        
        # Merge node properties with remaining fields
        properties.update(node_dict)
        
        # Convert datetime objects to ISO format strings
        for key, value in properties.items():
            if isinstance(value, datetime):
                properties[key] = value.isoformat()
            elif isinstance(value, UUID):
                properties[key] = str(value)
        
        # Create Cypher query
        query = f"""
        CREATE (n:{node_type} $properties)
        RETURN n.node_id as node_id
        """
        
        # Execute query
        result = await self.execute_query(query, {"properties": properties})
        
        # Return node ID
        return result[0]["node_id"]
    
    async def create_edge(self, edge: GraphEdge) -> str:
        """
        Create an edge in the graph.
        
        Args:
            edge: Edge to create
            
        Returns:
            Edge ID
        """
        # Convert edge to dictionary
        edge_dict = edge.dict()
        
        # Extract edge type and properties
        edge_type = edge_dict.pop("edge_type")
        properties = edge_dict.pop("properties", {})
        source_id = edge_dict.pop("source_id")
        target_id = edge_dict.pop("target_id")
        
        # Merge edge properties with remaining fields
        properties.update(edge_dict)
        
        # Convert datetime objects to ISO format strings
        for key, value in properties.items():
            if isinstance(value, datetime):
                properties[key] = value.isoformat()
            elif isinstance(value, UUID):
                properties[key] = str(value)
        
        # Create Cypher query
        query = f"""
        MATCH (source), (target)
        WHERE source.node_id = $source_id AND target.node_id = $target_id
        CREATE (source)-[r:{edge_type} $properties]->(target)
        RETURN r.edge_id as edge_id
        """
        
        # Execute query
        result = await self.execute_query(query, {
            "source_id": source_id,
            "target_id": target_id,
            "properties": properties
        })
        
        # Return edge ID
        return result[0]["edge_id"]
    
    async def get_node(self, node_id: str) -> Optional[GraphNode]:
        """
        Get a node from the graph.
        
        Args:
            node_id: Node ID
            
        Returns:
            Node or None if not found
        """
        # Create Cypher query
        query = """
        MATCH (n)
        WHERE n.node_id = $node_id
        RETURN n
        """
        
        # Execute query
        result = await self.execute_query(query, {"node_id": node_id})
        
        # Return node
        if result:
            node_data = result[0]["n"]
            node_type = list(node_data.labels)[0]
            properties = dict(node_data.properties)
            
            # Convert ISO format strings to datetime objects
            for key, value in properties.items():
                if isinstance(value, str) and "T" in value and "Z" in value:
                    try:
                        properties[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        pass
            
            return GraphNode(
                node_id=properties.pop("node_id"),
                node_type=node_type,
                properties=properties
            )
        
        return None
    
    async def get_edge(self, edge_id: str) -> Optional[GraphEdge]:
        """
        Get an edge from the graph.
        
        Args:
            edge_id: Edge ID
            
        Returns:
            Edge or None if not found
        """
        # Create Cypher query
        query = """
        MATCH (source)-[r]->(target)
        WHERE r.edge_id = $edge_id
        RETURN source, r, target
        """
        
        # Execute query
        result = await self.execute_query(query, {"edge_id": edge_id})
        
        # Return edge
        if result:
            source_data = result[0]["source"]
            edge_data = result[0]["r"]
            target_data = result[0]["target"]
            
            edge_type = type(edge_data).__name__
            properties = dict(edge_data.properties)
            
            # Convert ISO format strings to datetime objects
            for key, value in properties.items():
                if isinstance(value, str) and "T" in value and "Z" in value:
                    try:
                        properties[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        pass
            
            return GraphEdge(
                edge_id=properties.pop("edge_id"),
                edge_type=edge_type,
                source_id=source_data.properties["node_id"],
                target_id=target_data.properties["node_id"],
                properties=properties
            )
        
        return None
    
    async def delete_node(self, node_id: str) -> bool:
        """
        Delete a node from the graph.
        
        Args:
            node_id: Node ID
            
        Returns:
            True if deleted, False otherwise
        """
        # Create Cypher query
        query = """
        MATCH (n)
        WHERE n.node_id = $node_id
        DETACH DELETE n
        RETURN count(n) as deleted
        """
        
        # Execute query
        result = await self.execute_query(query, {"node_id": node_id})
        
        # Return result
        return result[0]["deleted"] > 0
    
    async def delete_edge(self, edge_id: str) -> bool:
        """
        Delete an edge from the graph.
        
        Args:
            edge_id: Edge ID
            
        Returns:
            True if deleted, False otherwise
        """
        # Create Cypher query
        query = """
        MATCH ()-[r]->()
        WHERE r.edge_id = $edge_id
        DELETE r
        RETURN count(r) as deleted
        """
        
        # Execute query
        result = await self.execute_query(query, {"edge_id": edge_id})
        
        # Return result
        return result[0]["deleted"] > 0
    
    async def execute_graph_query(self, graph_query: GraphQuery) -> GraphQueryResult:
        """
        Execute a graph query.
        
        Args:
            graph_query: Graph query
            
        Returns:
            Graph query result
        """
        try:
            # Execute query
            start_time = datetime.utcnow()
            result = await self.execute_query(
                graph_query.query_text,
                graph_query.parameters
            )
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds()
            
            # Process result
            nodes = []
            edges = []
            
            # Extract nodes and edges from result
            for record in result:
                for key, value in record.items():
                    if hasattr(value, "labels"):
                        # Node
                        node_type = list(value.labels)[0]
                        properties = dict(value.properties)
                        
                        # Convert ISO format strings to datetime objects
                        for prop_key, prop_value in properties.items():
                            if isinstance(prop_value, str) and "T" in prop_value and "Z" in prop_value:
                                try:
                                    properties[prop_key] = datetime.fromisoformat(prop_value.replace("Z", "+00:00"))
                                except ValueError:
                                    pass
                        
                        nodes.append(GraphNode(
                            node_id=properties.pop("node_id", str(uuid4())),
                            node_type=node_type,
                            properties=properties
                        ))
                    elif hasattr(value, "properties"):
                        # Edge
                        edge_type = type(value).__name__
                        properties = dict(value.properties)
                        
                        # Convert ISO format strings to datetime objects
                        for prop_key, prop_value in properties.items():
                            if isinstance(prop_value, str) and "T" in prop_value and "Z" in prop_value:
                                try:
                                    properties[prop_key] = datetime.fromisoformat(prop_value.replace("Z", "+00:00"))
                                except ValueError:
                                    pass
                        
                        # Extract source and target IDs
                        source_id = None
                        target_id = None
                        
                        # Try to find source and target in the record
                        for other_key, other_value in record.items():
                            if hasattr(other_value, "labels"):
                                if other_key == "source":
                                    source_id = other_value.properties.get("node_id")
                                elif other_key == "target":
                                    target_id = other_value.properties.get("node_id")
                        
                        if source_id and target_id:
                            edges.append(GraphEdge(
                                edge_id=properties.pop("edge_id", str(uuid4())),
                                edge_type=edge_type,
                                source_id=source_id,
                                target_id=target_id,
                                properties=properties
                            ))
            
            # Create query result
            query_result = GraphQueryResult(
                query_id=graph_query.query_id,
                nodes=nodes,
                edges=edges,
                execution_time=execution_time,
                is_complete=True,
                has_more=False,
                metadata=graph_query.metadata
            )
            
            return query_result
        except Exception as e:
            logger.error(f"Failed to execute graph query: {e}")
            
            # Create error result
            query_result = GraphQueryResult(
                query_id=graph_query.query_id,
                nodes=[],
                edges=[],
                execution_time=0.0,
                is_complete=False,
                has_more=False,
                metadata={
                    "error": str(e),
                    "query": graph_query.query_text,
                    "parameters": graph_query.parameters
                }
            )
            
            return query_result
    
    async def create_customer_node(self, customer: CustomerProfile) -> str:
        """
        Create a customer node in the graph.
        
        Args:
            customer: Customer profile
            
        Returns:
            Node ID
        """
        # Convert customer to dictionary
        customer_dict = customer.dict()
        
        # Extract nested objects
        personal_info = customer_dict.pop("personal_info", {})
        contact_info = customer_dict.pop("contact_info", {})
        risk_profile = customer_dict.pop("risk_profile", {})
        preferences = customer_dict.pop("preferences", {})
        
        # Flatten customer dictionary
        customer_dict["first_name"] = personal_info.get("first_name")
        customer_dict["middle_name"] = personal_info.get("middle_name")
        customer_dict["last_name"] = personal_info.get("last_name")
        customer_dict["date_of_birth"] = personal_info.get("date_of_birth")
        customer_dict["gender"] = personal_info.get("gender")
        customer_dict["nationality"] = personal_info.get("nationality")
        customer_dict["email"] = contact_info.get("email")
        customer_dict["phone"] = contact_info.get("phone")
        customer_dict["risk_level"] = risk_profile.get("risk_level")
        customer_dict["risk_score"] = risk_profile.get("risk_score")
        customer_dict["preferred_language"] = preferences.get("preferred_language")
        
        # Create node
        node = GraphNode(
            node_id=customer.customer_id,
            node_type="Customer",
            properties=customer_dict
        )
        
        # Create node in graph
        node_id = await self.create_node(node)
        
        # Create platform node if it doesn't exist
        platform_node = GraphNode(
            node_id=customer.platform_id,
            node_type="Platform",
            properties={
                "platform_type": customer.platform_type,
                "platform_id": customer.platform_id,
                "name": f"{customer.platform_type} Platform"
            }
        )
        
        try:
            await self.create_node(platform_node)
        except Exception:
            # Platform node might already exist
            pass
        
        # Create edge between customer and platform
        edge = GraphEdge(
            edge_id=str(uuid4()),
            edge_type="BELONGS_TO",
            source_id=customer.customer_id,
            target_id=customer.platform_id,
            properties={
                "created_at": datetime.utcnow()
            }
        )
        
        await self.create_edge(edge)
        
        # Create nodes and edges for identification documents
        for doc in personal_info.get("identification_documents", []):
            doc_node = GraphNode(
                node_id=f"{customer.customer_id}_doc_{doc.get('document_type')}_{doc.get('document_number')}",
                node_type="IdentificationDocument",
                properties=doc
            )
            
            try:
                await self.create_node(doc_node)
                
                # Create edge between customer and document
                doc_edge = GraphEdge(
                    edge_id=str(uuid4()),
                    edge_type="HAS_DOCUMENT",
                    source_id=customer.customer_id,
                    target_id=doc_node.node_id,
                    properties={
                        "created_at": datetime.utcnow()
                    }
                )
                
                await self.create_edge(doc_edge)
            except Exception as e:
                logger.warning(f"Failed to create document node: {e}")
        
        # Create nodes and edges for addresses
        for addr in contact_info.get("addresses", []):
            addr_node = GraphNode(
                node_id=f"{customer.customer_id}_addr_{addr.get('address_type')}_{addr.get('postal_code', 'unknown')}",
                node_type="Address",
                properties=addr
            )
            
            try:
                await self.create_node(addr_node)
                
                # Create edge between customer and address
                addr_edge = GraphEdge(
                    edge_id=str(uuid4()),
                    edge_type="HAS_ADDRESS",
                    source_id=customer.customer_id,
                    target_id=addr_node.node_id,
                    properties={
                        "created_at": datetime.utcnow(),
                        "is_primary": addr.get("is_primary", False)
                    }
                )
                
                await self.create_edge(addr_edge)
            except Exception as e:
                logger.warning(f"Failed to create address node: {e}")
        
        return node_id
    
    async def create_transaction_node(self, transaction: TransactionEvent) -> str:
        """
        Create a transaction node in the graph.
        
        Args:
            transaction: Transaction event
            
        Returns:
            Node ID
        """
        # Convert transaction to dictionary
        transaction_dict = transaction.dict()
        
        # Extract event data
        event_data = transaction_dict.pop("event_data", {})
        
        # Merge transaction dictionary with event data
        transaction_dict.update(event_data)
        
        # Create node
        node = GraphNode(
            node_id=transaction.transaction_id,
            node_type="Transaction",
            properties=transaction_dict
        )
        
        # Create node in graph
        node_id = await self.create_node(node)
        
        # Create edge between transaction and customer
        customer_edge = GraphEdge(
            edge_id=str(uuid4()),
            edge_type="PERFORMED_BY",
            source_id=transaction.transaction_id,
            target_id=transaction.customer_id,
            properties={
                "created_at": datetime.utcnow()
            }
        )
        
        await self.create_edge(customer_edge)
        
        # Create edge between transaction and account
        account_edge = GraphEdge(
            edge_id=str(uuid4()),
            edge_type="BELONGS_TO",
            source_id=transaction.transaction_id,
            target_id=transaction.account_id,
            properties={
                "created_at": datetime.utcnow()
            }
        )
        
        await self.create_edge(account_edge)
        
        # Create merchant node if merchant_id is provided
        merchant_id = event_data.get("merchant_id")
        if merchant_id:
            merchant_node = GraphNode(
                node_id=merchant_id,
                node_type="Merchant",
                properties={
                    "merchant_id": merchant_id,
                    "merchant_name": event_data.get("merchant_name", "Unknown Merchant"),
                    "merchant_category": event_data.get("merchant_category"),
                    "merchant_location": event_data.get("merchant_location")
                }
            )
            
            try:
                await self.create_node(merchant_node)
            except Exception:
                # Merchant node might already exist
                pass
            
            # Create edge between transaction and merchant
            merchant_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="AT_MERCHANT",
                source_id=transaction.transaction_id,
                target_id=merchant_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(merchant_edge)
        
        # Create location node if location data is provided
        location_data = event_data.get("location")
        if location_data:
            location_id = f"loc_{location_data.get('latitude')}_{location_data.get('longitude')}"
            location_node = GraphNode(
                node_id=location_id,
                node_type="Location",
                properties=location_data
            )
            
            try:
                await self.create_node(location_node)
            except Exception:
                # Location node might already exist
                pass
            
            # Create edge between transaction and location
            location_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="AT_LOCATION",
                source_id=transaction.transaction_id,
                target_id=location_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(location_edge)
        
        # Create device node if device data is provided
        device_data = event_data.get("device")
        if device_data:
            device_id = device_data.get("device_id", f"dev_{device_data.get('device_fingerprint', str(uuid4()))}")
            device_node = GraphNode(
                node_id=device_id,
                node_type="Device",
                properties=device_data
            )
            
            try:
                await self.create_node(device_node)
            except Exception:
                # Device node might already exist
                pass
            
            # Create edge between transaction and device
            device_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="FROM_DEVICE",
                source_id=transaction.transaction_id,
                target_id=device_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(device_edge)
        
        return node_id
    
    async def create_fraud_alert_node(self, fraud_alert: FraudEvent) -> str:
        """
        Create a fraud alert node in the graph.
        
        Args:
            fraud_alert: Fraud event
            
        Returns:
            Node ID
        """
        # Convert fraud alert to dictionary
        fraud_dict = fraud_alert.dict()
        
        # Extract event data
        event_data = fraud_dict.pop("event_data", {})
        
        # Merge fraud dictionary with event data
        fraud_dict.update(event_data)
        
        # Create node
        node = GraphNode(
            node_id=fraud_alert.alert_id,
            node_type="FraudAlert",
            properties=fraud_dict
        )
        
        # Create node in graph
        node_id = await self.create_node(node)
        
        # Create edges between fraud alert and related entities
        if fraud_alert.customer_id:
            customer_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="AFFECTS",
                source_id=fraud_alert.alert_id,
                target_id=fraud_alert.customer_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(customer_edge)
        
        if fraud_alert.account_id:
            account_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="AFFECTS",
                source_id=fraud_alert.alert_id,
                target_id=fraud_alert.account_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(account_edge)
        
        if fraud_alert.transaction_id:
            transaction_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="AFFECTS",
                source_id=fraud_alert.alert_id,
                target_id=fraud_alert.transaction_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(transaction_edge)
        
        return node_id
    
    async def create_customer_insight_node(self, insight: CustomerInsight) -> str:
        """
        Create a customer insight node in the graph.
        
        Args:
            insight: Customer insight
            
        Returns:
            Node ID
        """
        # Convert insight to dictionary
        insight_dict = insight.dict()
        
        # Generate node ID
        node_id = f"insight_{insight.customer_id}_{insight.insight_type}_{str(uuid4())[:8]}"
        
        # Create node
        node = GraphNode(
            node_id=node_id,
            node_type="Insight",
            properties=insight_dict
        )
        
        # Create node in graph
        node_id = await self.create_node(node)
        
        # Create edge between insight and customer
        edge = GraphEdge(
            edge_id=str(uuid4()),
            edge_type="ABOUT",
            source_id=node_id,
            target_id=insight.customer_id,
            properties={
                "created_at": datetime.utcnow()
            }
        )
        
        await self.create_edge(edge)
        
        return node_id
    
    async def create_customer_recommendation_node(self, recommendation: CustomerRecommendation) -> str:
        """
        Create a customer recommendation node in the graph.
        
        Args:
            recommendation: Customer recommendation
            
        Returns:
            Node ID
        """
        # Convert recommendation to dictionary
        recommendation_dict = recommendation.dict()
        
        # Create node
        node = GraphNode(
            node_id=recommendation.recommendation_id,
            node_type="Recommendation",
            properties=recommendation_dict
        )
        
        # Create node in graph
        node_id = await self.create_node(node)
        
        # Create edge between recommendation and customer
        customer_edge = GraphEdge(
            edge_id=str(uuid4()),
            edge_type="FOR",
            source_id=recommendation.recommendation_id,
            target_id=recommendation.customer_id,
            properties={
                "created_at": datetime.utcnow()
            }
        )
        
        await self.create_edge(customer_edge)
        
        # Create edge between recommendation and product if product_id is provided
        if recommendation.product_id:
            product_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="RECOMMENDS",
                source_id=recommendation.recommendation_id,
                target_id=recommendation.product_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(product_edge)
        
        # Create edge between recommendation and campaign if campaign_id is provided
        if recommendation.campaign_id:
            campaign_edge = GraphEdge(
                edge_id=str(uuid4()),
                edge_type="PART_OF",
                source_id=recommendation.recommendation_id,
                target_id=recommendation.campaign_id,
                properties={
                    "created_at": datetime.utcnow()
                }
            )
            
            await self.create_edge(campaign_edge)
        
        return node_id
    
    async def get_customer_subgraph(self, customer_id: str, max_depth: int = 2) -> GraphQueryResult:
        """
        Get a customer subgraph.
        
        Args:
            customer_id: Customer ID
            max_depth: Maximum depth of the subgraph
            
        Returns:
            Graph query result
        """
        # Create query
        query = f"""
        MATCH path = (c:Customer {{customer_id: $customer_id}})-[*1..{max_depth}]-(related)
        RETURN path
        """
        
        # Create graph query
        graph_query = GraphQuery(
            query_id=str(uuid4()),
            query_type="customer_subgraph",
            query_text=query,
            parameters={"customer_id": customer_id},
            result_limit=1000,
            timeout=60,
            metadata={"customer_id": customer_id, "max_depth": max_depth}
        )
        
        # Execute query
        result = await self.execute_graph_query(graph_query)
        
        return result
    
    async def get_transaction_subgraph(self, transaction_id: str, max_depth: int = 2) -> GraphQueryResult:
        """
        Get a transaction subgraph.
        
        Args:
            transaction_id: Transaction ID
            max_depth: Maximum depth of the subgraph
            
        Returns:
            Graph query result
        """
        # Create query
        query = f"""
        MATCH path = (t:Transaction {{transaction_id: $transaction_id}})-[*1..{max_depth}]-(related)
        RETURN path
        """
        
        # Create graph query
        graph_query = GraphQuery(
            query_id=str(uuid4()),
            query_type="transaction_subgraph",
            query_text=query,
            parameters={"transaction_id": transaction_id},
            result_limit=1000,
            timeout=60,
            metadata={"transaction_id": transaction_id, "max_depth": max_depth}
        )
        
        # Execute query
        result = await self.execute_graph_query(graph_query)
        
        return result
    
    async def get_fraud_alert_subgraph(self, alert_id: str, max_depth: int = 3) -> GraphQueryResult:
        """
        Get a fraud alert subgraph.
        
        Args:
            alert_id: Fraud alert ID
            max_depth: Maximum depth of the subgraph
            
        Returns:
            Graph query result
        """
        # Create query
        query = f"""
        MATCH path = (f:FraudAlert {{alert_id: $alert_id}})-[*1..{max_depth}]-(related)
        RETURN path
        """
        
        # Create graph query
        graph_query = GraphQuery(
            query_id=str(uuid4()),
            query_type="fraud_alert_subgraph",
            query_text=query,
            parameters={"alert_id": alert_id},
            result_limit=1000,
            timeout=60,
            metadata={"alert_id": alert_id, "max_depth": max_depth}
        )
        
        # Execute query
        result = await self.execute_graph_query(graph_query)
        
        return result
    
    async def find_similar_customers(self, customer_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find similar customers based on transaction patterns.
        
        Args:
            customer_id: Customer ID
            limit: Maximum number of similar customers to return
            
        Returns:
            List of similar customers with similarity scores
        """
        # Create query
        query = """
        MATCH (c1:Customer {customer_id: $customer_id})-[:PERFORMED_BY]-(t1:Transaction)-[:AT_MERCHANT]->(m:Merchant)
        WITH c1, m, count(t1) AS c1_count
        MATCH (c2:Customer)-[:PERFORMED_BY]-(t2:Transaction)-[:AT_MERCHANT]->(m)
        WHERE c1 <> c2
        WITH c1, c2, m, c1_count, count(t2) AS c2_count
        RETURN c2.customer_id AS similar_customer_id,
               c2.first_name AS first_name,
               c2.last_name AS last_name,
               count(m) AS common_merchants,
               sum(c1_count * c2_count) AS similarity_score
        ORDER BY similarity_score DESC
        LIMIT $limit
        """
        
        # Execute query
        result = await self.execute_query(query, {"customer_id": customer_id, "limit": limit})
        
        # Process result
        similar_customers = []
        for record in result:
            similar_customers.append({
                "customer_id": record["similar_customer_id"],
                "first_name": record["first_name"],
                "last_name": record["last_name"],
                "common_merchants": record["common_merchants"],
                "similarity_score": record["similarity_score"]
            })
        
        return similar_customers
    
    async def find_potential_fraud_connections(self, alert_id: str, max_depth: int = 3) -> List[Dict[str, Any]]:
        """
        Find potential fraud connections based on a fraud alert.
        
        Args:
            alert_id: Fraud alert ID
            max_depth: Maximum depth of the connections
            
        Returns:
            List of potential fraud connections
        """
        # Create query
        query = f"""
        MATCH (f:FraudAlert {{alert_id: $alert_id}})-[:AFFECTS]->(entity)
        MATCH path = (entity)-[*1..{max_depth}]-(connected:Transaction)
        WHERE connected.transaction_type = "WITHDRAWAL" OR connected.transaction_type = "TRANSFER"
        WITH connected, length(path) AS distance
        RETURN connected.transaction_id AS transaction_id,
               connected.transaction_type AS transaction_type,
               connected.amount AS amount,
               connected.currency AS currency,
               connected.timestamp AS timestamp,
               distance
        ORDER BY distance, timestamp DESC
        LIMIT 20
        """
        
        # Execute query
        result = await self.execute_query(query, {"alert_id": alert_id})
        
        # Process result
        connections = []
        for record in result:
            connections.append({
                "transaction_id": record["transaction_id"],
                "transaction_type": record["transaction_type"],
                "amount": record["amount"],
                "currency": record["currency"],
                "timestamp": record["timestamp"],
                "distance": record["distance"]
            })
        
        return connections
    
    async def get_customer_transaction_summary(self, customer_id: str) -> Dict[str, Any]:
        """
        Get a summary of customer transactions.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Transaction summary
        """
        # Create query
        query = """
        MATCH (c:Customer {customer_id: $customer_id})<-[:PERFORMED_BY]-(t:Transaction)
        WITH c, t
        RETURN count(t) AS total_transactions,
               sum(t.amount) AS total_amount,
               avg(t.amount) AS average_amount,
               min(t.amount) AS min_amount,
               max(t.amount) AS max_amount,
               count(DISTINCT t.transaction_type) AS transaction_types
        """
        
        # Execute query
        result = await self.execute_query(query, {"customer_id": customer_id})
        
        # Process result
        if result:
            summary = {
                "total_transactions": result[0]["total_transactions"],
                "total_amount": result[0]["total_amount"],
                "average_amount": result[0]["average_amount"],
                "min_amount": result[0]["min_amount"],
                "max_amount": result[0]["max_amount"],
                "transaction_types": result[0]["transaction_types"]
            }
            
            # Get transaction type breakdown
            type_query = """
            MATCH (c:Customer {customer_id: $customer_id})<-[:PERFORMED_BY]-(t:Transaction)
            RETURN t.transaction_type AS type, count(t) AS count, sum(t.amount) AS amount
            ORDER BY count DESC
            """
            
            type_result = await self.execute_query(type_query, {"customer_id": customer_id})
            
            # Process type result
            type_breakdown = []
            for record in type_result:
                type_breakdown.append({
                    "type": record["type"],
                    "count": record["count"],
                    "amount": record["amount"]
                })
            
            summary["type_breakdown"] = type_breakdown
            
            # Get merchant breakdown
            merchant_query = """
            MATCH (c:Customer {customer_id: $customer_id})<-[:PERFORMED_BY]-(t:Transaction)-[:AT_MERCHANT]->(m:Merchant)
            RETURN m.merchant_id AS merchant_id,
                   m.merchant_name AS merchant_name,
                   count(t) AS count,
                   sum(t.amount) AS amount
            ORDER BY count DESC
            LIMIT 10
            """
            
            merchant_result = await self.execute_query(merchant_query, {"customer_id": customer_id})
            
            # Process merchant result
            merchant_breakdown = []
            for record in merchant_result:
                merchant_breakdown.append({
                    "merchant_id": record["merchant_id"],
                    "merchant_name": record["merchant_name"],
                    "count": record["count"],
                    "amount": record["amount"]
                })
            
            summary["merchant_breakdown"] = merchant_breakdown
            
            return summary
        
        return {
            "total_transactions": 0,
            "total_amount": 0,
            "average_amount": 0,
            "min_amount": 0,
            "max_amount": 0,
            "transaction_types": 0,
            "type_breakdown": [],
            "merchant_breakdown": []
        }
    
    async def get_customer_insights(self, customer_id: str) -> List[Dict[str, Any]]:
        """
        Get insights for a customer.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            List of customer insights
        """
        # Create query
        query = """
        MATCH (i:Insight)-[:ABOUT]->(c:Customer {customer_id: $customer_id})
        RETURN i.insight_type AS type,
               i.insight_value AS value,
               i.confidence AS confidence,
               i.timestamp AS timestamp,
               i.source AS source
        ORDER BY i.timestamp DESC
        """
        
        # Execute query
        result = await self.execute_query(query, {"customer_id": customer_id})
        
        # Process result
        insights = []
        for record in result:
            insights.append({
                "type": record["type"],
                "value": record["value"],
                "confidence": record["confidence"],
                "timestamp": record["timestamp"],
                "source": record["source"]
            })
        
        return insights
    
    async def get_customer_recommendations(self, customer_id: str) -> List[Dict[str, Any]]:
        """
        Get recommendations for a customer.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            List of customer recommendations
        """
        # Create query
        query = """
        MATCH (r:Recommendation)-[:FOR]->(c:Customer {customer_id: $customer_id})
        OPTIONAL MATCH (r)-[:RECOMMENDS]->(p)
        RETURN r.recommendation_id AS id,
               r.recommendation_type AS type,
               r.score AS score,
               r.reason AS reason,
               r.valid_from AS valid_from,
               r.valid_to AS valid_to,
               r.is_presented AS is_presented,
               r.is_accepted AS is_accepted,
               p.product_id AS product_id,
               p.product_name AS product_name
        ORDER BY r.score DESC
        """
        
        # Execute query
        result = await self.execute_query(query, {"customer_id": customer_id})
        
        # Process result
        recommendations = []
        for record in result:
            recommendations.append({
                "id": record["id"],
                "type": record["type"],
                "score": record["score"],
                "reason": record["reason"],
                "valid_from": record["valid_from"],
                "valid_to": record["valid_to"],
                "is_presented": record["is_presented"],
                "is_accepted": record["is_accepted"],
                "product_id": record["product_id"],
                "product_name": record["product_name"]
            })
        
        return recommendations

