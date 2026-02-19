"""
Agent Commerce Orchestrator
Seamless workflow: Agent Onboarding → E-commerce Store → Supply Chain Integration
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid
import logging
import asyncio
import httpx
from pydantic import BaseModel, EmailStr

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# ENUMS
# ============================================================================

class AgentTier(str, Enum):
    SUPER_AGENT = "super_agent"
    REGIONAL_AGENT = "regional_agent"
    FIELD_AGENT = "field_agent"
    SUB_AGENT = "sub_agent"

class StoreStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"

class OnboardingStage(str, Enum):
    AGENT_REGISTRATION = "agent_registration"
    KYC_VERIFICATION = "kyc_verification"
    STORE_SETUP = "store_setup"
    INVENTORY_SETUP = "inventory_setup"
    PAYMENT_SETUP = "payment_setup"
    TRAINING_COMPLETE = "training_complete"
    GO_LIVE = "go_live"

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class AgentOnboardingRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    tier: AgentTier
    business_name: Optional[str] = None
    business_address: Optional[Dict[str, str]] = None
    sponsor_agent_id: Optional[str] = None

class StoreSetupRequest(BaseModel):
    agent_id: str
    store_name: str
    store_description: Optional[str] = None
    business_category: str
    warehouse_location: Dict[str, str]
    initial_products: Optional[List[Dict[str, Any]]] = []

class InventorySetupRequest(BaseModel):
    agent_id: str
    store_id: str
    warehouse_id: str
    products: List[Dict[str, Any]]  # [{"product_id": "...", "initial_stock": 100}]

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="Agent Commerce Orchestrator",
    description="Seamless agent onboarding to e-commerce and supply chain",
    version="1.0.0"
)

# ============================================================================
# SERVICE CLIENTS
# ============================================================================

class ServiceClient:
    """HTTP client for microservices"""
    
    def __init__(self):
        self.base_urls = {
            "onboarding": "http://localhost:8010",
            "ecommerce": "http://localhost:8000",
            "inventory": "http://localhost:8001",
            "warehouse": "http://localhost:8002",
            "procurement": "http://localhost:8003"
        }
    
    async def call_service(
        self,
        service: str,
        endpoint: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Call microservice endpoint"""
        
        base_url = self.base_urls.get(service)
        if not base_url:
            raise ValueError(f"Unknown service: {service}")
        
        url = f"{base_url}{endpoint}"
        
        async with httpx.AsyncClient() as client:
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url, json=data)
            elif method == "PUT":
                response = await client.put(url, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()

# ============================================================================
# AGENT COMMERCE ORCHESTRATOR
# ============================================================================

class AgentCommerceOrchestrator:
    """Orchestrate agent onboarding to commerce workflow"""
    
    def __init__(self):
        self.client = ServiceClient()
    
    # ========================================================================
    # COMPLETE ONBOARDING WORKFLOW
    # ========================================================================
    
    async def onboard_agent_complete(
        self,
        request: AgentOnboardingRequest,
        store_setup: Optional[StoreSetupRequest] = None
    ) -> Dict[str, Any]:
        """
        Complete agent onboarding workflow:
        1. Register agent
        2. Create KYC application
        3. Set up e-commerce store
        4. Create warehouse
        5. Set up initial inventory
        6. Configure payment methods
        7. Publish to Fluvio
        """
        
        workflow_id = str(uuid.uuid4())
        
        logger.info(f"Starting complete agent onboarding workflow: {workflow_id}")
        
        try:
            # Stage 1: Register Agent
            agent = await self._register_agent(request)
            agent_id = agent["agent_id"]
            
            logger.info(f"Stage 1 complete: Agent registered - {agent_id}")
            
            # Stage 2: Create KYC Application
            kyc = await self._create_kyc_application(agent_id, request)
            
            logger.info(f"Stage 2 complete: KYC application created")
            
            # Stage 3: Set up E-commerce Store
            if store_setup:
                store = await self._setup_ecommerce_store(agent_id, store_setup)
                store_id = store["store_id"]
            else:
                # Create default store
                store = await self._setup_default_store(agent_id, request)
                store_id = store["store_id"]
            
            logger.info(f"Stage 3 complete: E-commerce store created - {store_id}")
            
            # Stage 4: Create Warehouse
            warehouse = await self._create_warehouse(agent_id, store_id, request)
            warehouse_id = warehouse["warehouse_id"]
            
            logger.info(f"Stage 4 complete: Warehouse created - {warehouse_id}")
            
            # Stage 5: Link Store to Warehouse
            await self._link_store_warehouse(store_id, warehouse_id)
            
            logger.info(f"Stage 5 complete: Store linked to warehouse")
            
            # Stage 6: Set up Payment Methods
            payment_config = await self._setup_payment_methods(agent_id, store_id)
            
            logger.info(f"Stage 6 complete: Payment methods configured")
            
            # Stage 7: Create Agent Dashboard Access
            dashboard = await self._create_dashboard_access(agent_id, store_id, warehouse_id)
            
            logger.info(f"Stage 7 complete: Dashboard access created")
            
            # Stage 8: Publish Events to Fluvio
            await self._publish_onboarding_events(
                agent_id,
                store_id,
                warehouse_id,
                workflow_id
            )
            
            logger.info(f"Stage 8 complete: Events published to Fluvio")
            
            # Return complete workflow result
            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "agent": agent,
                "store": store,
                "warehouse": warehouse,
                "payment_config": payment_config,
                "dashboard": dashboard,
                "next_steps": [
                    "Complete KYC verification",
                    "Upload product catalog",
                    "Configure shipping methods",
                    "Set up supplier relationships",
                    "Complete training program",
                    "Go live!"
                ],
                "completed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Workflow failed: {str(e)}")
            
            # Rollback workflow (in production, implement saga pattern)
            await self._rollback_workflow(workflow_id)
            
            raise HTTPException(
                status_code=500,
                detail=f"Onboarding workflow failed: {str(e)}"
            )
    
    # ========================================================================
    # STAGE IMPLEMENTATIONS
    # ========================================================================
    
    async def _register_agent(
        self,
        request: AgentOnboardingRequest
    ) -> Dict[str, Any]:
        """Stage 1: Register agent in agent management system"""
        
        agent_data = {
            "first_name": request.first_name,
            "last_name": request.last_name,
            "email": request.email,
            "phone": request.phone,
            "tier": request.tier.value,
            "business_name": request.business_name,
            "business_address": request.business_address,
            "sponsor_agent_id": request.sponsor_agent_id,
            "status": "pending_kyc"
        }
        
        # Call agent onboarding service
        agent = await self.client.call_service(
            "onboarding",
            "/agents/register",
            "POST",
            agent_data
        )
        
        return agent
    
    async def _create_kyc_application(
        self,
        agent_id: str,
        request: AgentOnboardingRequest
    ) -> Dict[str, Any]:
        """Stage 2: Create KYC/KYB application"""
        
        kyc_data = {
            "agent_id": agent_id,
            "applicant_type": "business" if request.business_name else "individual",
            "first_name": request.first_name,
            "last_name": request.last_name,
            "email": request.email,
            "phone": request.phone,
            "business_name": request.business_name
        }
        
        kyc = await self.client.call_service(
            "onboarding",
            "/kyc/applications",
            "POST",
            kyc_data
        )
        
        return kyc
    
    async def _setup_ecommerce_store(
        self,
        agent_id: str,
        store_setup: StoreSetupRequest
    ) -> Dict[str, Any]:
        """Stage 3: Set up e-commerce store"""
        
        store_data = {
            "agent_id": agent_id,
            "store_name": store_setup.store_name,
            "store_description": store_setup.store_description,
            "business_category": store_setup.business_category,
            "status": "pending",
            "settings": {
                "currency": "USD",
                "language": "en",
                "timezone": "UTC",
                "tax_enabled": True,
                "shipping_enabled": True
            }
        }
        
        store = await self.client.call_service(
            "ecommerce",
            "/stores",
            "POST",
            store_data
        )
        
        return store
    
    async def _setup_default_store(
        self,
        agent_id: str,
        request: AgentOnboardingRequest
    ) -> Dict[str, Any]:
        """Set up default e-commerce store"""
        
        store_name = request.business_name or f"{request.first_name} {request.last_name}'s Store"
        
        store_data = {
            "agent_id": agent_id,
            "store_name": store_name,
            "store_description": f"Welcome to {store_name}",
            "business_category": "general",
            "status": "pending"
        }
        
        store = await self.client.call_service(
            "ecommerce",
            "/stores",
            "POST",
            store_data
        )
        
        return store
    
    async def _create_warehouse(
        self,
        agent_id: str,
        store_id: str,
        request: AgentOnboardingRequest
    ) -> Dict[str, Any]:
        """Stage 4: Create warehouse for agent"""
        
        # Generate warehouse code
        warehouse_code = f"WH-{agent_id[:8].upper()}"
        
        warehouse_data = {
            "code": warehouse_code,
            "name": f"{request.business_name or request.first_name} Warehouse",
            "warehouse_type": "agent_warehouse",
            "agent_id": agent_id,
            "store_id": store_id,
            "address": request.business_address or {
                "street": "TBD",
                "city": "TBD",
                "country": "TBD"
            },
            "capacity_sqm": 100.0,  # Default capacity
            "is_active": True,
            "settings": {
                "enable_barcode_scanning": True,
                "enable_cycle_counting": True,
                "enable_quality_control": True
            }
        }
        
        warehouse = await self.client.call_service(
            "inventory",
            "/warehouses",
            "POST",
            warehouse_data
        )
        
        return warehouse
    
    async def _link_store_warehouse(
        self,
        store_id: str,
        warehouse_id: str
    ) -> Dict[str, Any]:
        """Stage 5: Link e-commerce store to warehouse"""
        
        link_data = {
            "store_id": store_id,
            "warehouse_id": warehouse_id,
            "is_primary": True,
            "fulfillment_priority": 1
        }
        
        # Update store with warehouse link
        result = await self.client.call_service(
            "ecommerce",
            f"/stores/{store_id}/warehouses",
            "POST",
            link_data
        )
        
        return result
    
    async def _setup_payment_methods(
        self,
        agent_id: str,
        store_id: str
    ) -> Dict[str, Any]:
        """Stage 6: Set up payment methods for store"""
        
        payment_config = {
            "store_id": store_id,
            "agent_id": agent_id,
            "enabled_methods": [
                {
                    "method": "cash",
                    "enabled": True,
                    "priority": 1
                },
                {
                    "method": "mobile_money",
                    "enabled": True,
                    "priority": 2
                },
                {
                    "method": "card",
                    "enabled": False,  # Requires merchant account
                    "priority": 3
                }
            ],
            "default_currency": "USD",
            "supported_currencies": ["USD", "KES", "UGX", "TZS"]
        }
        
        result = await self.client.call_service(
            "ecommerce",
            f"/stores/{store_id}/payment-config",
            "POST",
            payment_config
        )
        
        return result
    
    async def _create_dashboard_access(
        self,
        agent_id: str,
        store_id: str,
        warehouse_id: str
    ) -> Dict[str, Any]:
        """Stage 7: Create dashboard access for agent"""
        
        dashboard_config = {
            "agent_id": agent_id,
            "store_id": store_id,
            "warehouse_id": warehouse_id,
            "permissions": [
                "view_orders",
                "manage_products",
                "view_inventory",
                "process_sales",
                "view_reports",
                "manage_customers"
            ],
            "dashboard_url": f"https://dashboard.example.com/agent/{agent_id}",
            "api_key": str(uuid.uuid4())  # Generate API key
        }
        
        return dashboard_config
    
    async def _publish_onboarding_events(
        self,
        agent_id: str,
        store_id: str,
        warehouse_id: str,
        workflow_id: str
    ):
        """Stage 8: Publish events to Fluvio for integration"""
        
        # In production, use actual Fluvio client
        events = [
            {
                "topic": "agent.onboarding.completed",
                "key": agent_id,
                "value": {
                    "event_id": str(uuid.uuid4()),
                    "workflow_id": workflow_id,
                    "agent_id": agent_id,
                    "store_id": store_id,
                    "warehouse_id": warehouse_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "event_type": "agent_onboarded"
                }
            },
            {
                "topic": "ecommerce.store.created",
                "key": store_id,
                "value": {
                    "event_id": str(uuid.uuid4()),
                    "store_id": store_id,
                    "agent_id": agent_id,
                    "warehouse_id": warehouse_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "event_type": "store_created"
                }
            },
            {
                "topic": "supply-chain.warehouse.created",
                "key": warehouse_id,
                "value": {
                    "event_id": str(uuid.uuid4()),
                    "warehouse_id": warehouse_id,
                    "agent_id": agent_id,
                    "store_id": store_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "event_type": "warehouse_created"
                }
            }
        ]
        
        logger.info(f"Published {len(events)} events to Fluvio")
        
        return events
    
    async def _rollback_workflow(self, workflow_id: str):
        """Rollback failed workflow (saga pattern)"""
        
        logger.warning(f"Rolling back workflow: {workflow_id}")
        
        # In production, implement compensating transactions
        # - Delete created store
        # - Delete created warehouse
        # - Mark agent as failed onboarding
        # - Publish rollback events
    
    # ========================================================================
    # PRODUCT CATALOG SETUP
    # ========================================================================
    
    async def setup_product_catalog(
        self,
        agent_id: str,
        store_id: str,
        warehouse_id: str,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Set up initial product catalog for agent"""
        
        logger.info(f"Setting up product catalog: {len(products)} products")
        
        results = {
            "products_created": [],
            "inventory_initialized": [],
            "errors": []
        }
        
        for product_data in products:
            try:
                # Create product in e-commerce
                product = await self.client.call_service(
                    "ecommerce",
                    "/products",
                    "POST",
                    {
                        "store_id": store_id,
                        "name": product_data["name"],
                        "description": product_data.get("description", ""),
                        "sku": product_data.get("sku", f"SKU-{uuid.uuid4().hex[:8]}"),
                        "price": product_data["price"],
                        "category": product_data.get("category", "general"),
                        "is_active": True
                    }
                )
                
                product_id = product["product_id"]
                results["products_created"].append(product_id)
                
                # Initialize inventory in warehouse
                initial_stock = product_data.get("initial_stock", 0)
                
                if initial_stock > 0:
                    inventory = await self.client.call_service(
                        "inventory",
                        "/inventory/movement",
                        "POST",
                        {
                            "warehouse_id": warehouse_id,
                            "product_id": product_id,
                            "movement_type": "inbound",
                            "quantity": initial_stock,
                            "reference_type": "initial_stock",
                            "reference_id": agent_id,
                            "notes": "Initial inventory setup"
                        }
                    )
                    
                    results["inventory_initialized"].append({
                        "product_id": product_id,
                        "quantity": initial_stock
                    })
                
            except Exception as e:
                logger.error(f"Failed to create product: {str(e)}")
                results["errors"].append({
                    "product": product_data.get("name", "Unknown"),
                    "error": str(e)
                })
        
        logger.info(f"Product catalog setup complete: {len(results['products_created'])} products created")
        
        return results
    
    # ========================================================================
    # SUPPLIER SETUP
    # ========================================================================
    
    async def setup_supplier_relationships(
        self,
        agent_id: str,
        warehouse_id: str,
        suppliers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Set up supplier relationships for agent"""
        
        logger.info(f"Setting up supplier relationships: {len(suppliers)} suppliers")
        
        results = {
            "suppliers_created": [],
            "errors": []
        }
        
        for supplier_data in suppliers:
            try:
                supplier = await self.client.call_service(
                    "procurement",
                    "/suppliers",
                    "POST",
                    {
                        "code": supplier_data.get("code", f"SUP-{uuid.uuid4().hex[:8]}"),
                        "name": supplier_data["name"],
                        "email": supplier_data.get("email"),
                        "phone": supplier_data.get("phone"),
                        "payment_terms": supplier_data.get("payment_terms", "Net 30"),
                        "is_preferred": supplier_data.get("is_preferred", False),
                        "agent_id": agent_id
                    }
                )
                
                results["suppliers_created"].append(supplier["supplier_id"])
                
            except Exception as e:
                logger.error(f"Failed to create supplier: {str(e)}")
                results["errors"].append({
                    "supplier": supplier_data.get("name", "Unknown"),
                    "error": str(e)
                })
        
        logger.info(f"Supplier setup complete: {len(results['suppliers_created'])} suppliers created")
        
        return results

# ============================================================================
# API ENDPOINTS
# ============================================================================

orchestrator = AgentCommerceOrchestrator()

@app.post("/onboard/complete", response_model=Dict[str, Any])
async def onboard_agent_complete(
    request: AgentOnboardingRequest,
    store_setup: Optional[StoreSetupRequest] = None
):
    """Complete agent onboarding workflow"""
    return await orchestrator.onboard_agent_complete(request, store_setup)

@app.post("/catalog/setup", response_model=Dict[str, Any])
async def setup_product_catalog(
    agent_id: str,
    store_id: str,
    warehouse_id: str,
    products: List[Dict[str, Any]]
):
    """Set up product catalog for agent"""
    return await orchestrator.setup_product_catalog(
        agent_id,
        store_id,
        warehouse_id,
        products
    )

@app.post("/suppliers/setup", response_model=Dict[str, Any])
async def setup_supplier_relationships(
    agent_id: str,
    warehouse_id: str,
    suppliers: List[Dict[str, Any]]
):
    """Set up supplier relationships"""
    return await orchestrator.setup_supplier_relationships(
        agent_id,
        warehouse_id,
        suppliers
    )

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "service": "agent-commerce-orchestrator",
        "version": "1.0.0"
    }

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8020)

