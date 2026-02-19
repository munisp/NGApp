import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from . import models
from .config import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["e-commerce"],
    responses={404: {"description": "Not found"}},
)

# --- Helper Functions ---

def log_activity(db: Session, entity_type: str, entity_id: int, action: str, details: Optional[str] = None):
    """Logs an activity to the database."""
    log_entry = models.ActivityLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    logger.info(f"Activity logged: {action} on {entity_type} ID {entity_id}")

# --- Category Endpoints ---

@router.post("/categories/", response_model=models.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: models.CategoryCreate, db: Session = Depends(get_db)):
    """
    **Create a new product category.**
    
    Ensures the category name is unique.
    """
    logger.info(f"Attempting to create category: {category.name}")
    
    # Check for existing category with the same name (case-insensitive)
    existing_category = db.query(models.Category).filter(
        func.lower(models.Category.name) == func.lower(category.name)
    ).first()
    
    if existing_category:
        logger.warning(f"Category creation failed: Name '{category.name}' already exists.")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category with name '{category.name}' already exists."
        )

    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    log_activity(db, "Category", db_category.id, "CREATE", f"Category '{db_category.name}' created.")
    return db_category

@router.get("/categories/", response_model=List[models.CategoryResponse])
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    **Retrieve a list of all product categories.**
    
    Supports pagination via `skip` and `limit` query parameters.
    """
    categories = db.query(models.Category).offset(skip).limit(limit).all()
    return categories

@router.get("/categories/{category_id}", response_model=models.CategoryResponse)
def read_category(category_id: int, db: Session = Depends(get_db)):
    """
    **Retrieve a single product category by ID.**
    """
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if category is None:
        logger.warning(f"Category read failed: ID {category_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category

@router.put("/categories/{category_id}", response_model=models.CategoryResponse)
def update_category(category_id: int, category: models.CategoryUpdate, db: Session = Depends(get_db)):
    """
    **Update an existing product category.**
    
    Allows partial updates.
    """
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category is None:
        logger.warning(f"Category update failed: ID {category_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data = category.model_dump(exclude_unset=True)
    
    # Check for name conflict if name is being updated
    if 'name' in update_data and update_data['name'] != db_category.name:
        existing_category = db.query(models.Category).filter(
            func.lower(models.Category.name) == func.lower(update_data['name']),
            models.Category.id != category_id
        ).first()
        if existing_category:
            logger.warning(f"Category update failed: Name '{update_data['name']}' already exists.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category with name '{update_data['name']}' already exists."
            )

    for key, value in update_data.items():
        setattr(db_category, key, value)

    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    log_activity(db, "Category", db_category.id, "UPDATE", f"Category '{db_category.name}' updated.")
    return db_category

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """
    **Delete a product category.**
    
    Note: Deleting a category does not automatically delete associated products. 
    Products linked to this category will have an invalid `category_id`.
    A proper system would handle this with a foreign key constraint (e.g., ON DELETE SET NULL).
    """
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category is None:
        logger.warning(f"Category delete failed: ID {category_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    db.delete(db_category)
    db.commit()
    
    log_activity(db, "Category", category_id, "DELETE", f"Category '{db_category.name}' deleted.")
    return

# --- Product Endpoints ---

@router.post("/products/", response_model=models.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: models.ProductCreate, db: Session = Depends(get_db)):
    """
    **Create a new product.**
    
    Requires a valid `category_id`.
    """
    logger.info(f"Attempting to create product: {product.name}")
    
    # Check if category exists
    category = db.query(models.Category).filter(models.Category.id == product.category_id).first()
    if category is None:
        logger.warning(f"Product creation failed: Category ID {product.category_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with ID {product.category_id} not found."
        )

    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Eager load the category for the response model
    db_product = db.query(models.Product).options(joinedload(models.Product.category)).filter(models.Product.id == db_product.id).first()
    
    log_activity(db, "Product", db_product.id, "CREATE", f"Product '{db_product.name}' created in category {category.name}.")
    return db_product

@router.get("/products/", response_model=List[models.ProductResponse])
def list_products(
    search: Optional[str] = Query(None, description="Search term for product name or description."),
    category_id: Optional[int] = Query(None, description="Filter by category ID."),
    min_price: Optional[float] = Query(None, ge=0, description="Filter by minimum price."),
    max_price: Optional[float] = Query(None, ge=0, description="Filter by maximum price."),
    is_active: Optional[bool] = Query(True, description="Filter by active status."),
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    **Retrieve a list of products with filtering and search capabilities.**
    
    Supports filtering by search term, category, price range, and active status.
    """
    query = db.query(models.Product).options(joinedload(models.Product.category))
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (func.lower(models.Product.name).like(search_term)) | 
            (func.lower(models.Product.description).like(search_term))
        )
        
    if category_id is not None:
        query = query.filter(models.Product.category_id == category_id)
        
    if min_price is not None:
        query = query.filter(models.Product.price >= min_price)
        
    if max_price is not None:
        query = query.filter(models.Product.price <= max_price)
        
    if is_active is not None:
        query = query.filter(models.Product.is_active == is_active)

    products = query.offset(skip).limit(limit).all()
    return products

@router.get("/products/{product_id}", response_model=models.ProductResponse)
def read_product(product_id: int, db: Session = Depends(get_db)):
    """
    **Retrieve a single product by ID.**
    """
    product = db.query(models.Product).options(joinedload(models.Product.category)).filter(models.Product.id == product_id).first()
    if product is None:
        logger.warning(f"Product read failed: ID {product_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product

@router.put("/products/{product_id}", response_model=models.ProductResponse)
def update_product(product_id: int, product: models.ProductUpdate, db: Session = Depends(get_db)):
    """
    **Update an existing product.**
    
    Allows partial updates. Validates `category_id` if provided.
    """
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product is None:
        logger.warning(f"Product update failed: ID {product_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = product.model_dump(exclude_unset=True)
    
    # Validate category_id if it's being updated
    if 'category_id' in update_data and update_data['category_id'] != db_product.category_id:
        category = db.query(models.Category).filter(models.Category.id == update_data['category_id']).first()
        if category is None:
            logger.warning(f"Product update failed: New Category ID {update_data['category_id']} not found.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {update_data['category_id']} not found."
            )

    for key, value in update_data.items():
        setattr(db_product, key, value)

    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Eager load the category for the response model
    db_product = db.query(models.Product).options(joinedload(models.Product.category)).filter(models.Product.id == db_product.id).first()
    
    log_activity(db, "Product", db_product.id, "UPDATE", f"Product '{db_product.name}' updated.")
    return db_product

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """
    **Delete a product.**
    """
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product is None:
        logger.warning(f"Product delete failed: ID {product_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    db.delete(db_product)
    db.commit()
    
    log_activity(db, "Product", product_id, "DELETE", f"Product '{db_product.name}' deleted.")
    return

# --- Business-Specific Endpoints ---

@router.post("/products/{product_id}/stock", response_model=models.ProductResponse)
def update_product_stock(
    product_id: int, 
    quantity_change: int = Query(..., description="The amount to change the stock by. Positive for increase, negative for decrease."),
    db: Session = Depends(get_db)
):
    """
    **Update the stock quantity of a product.**
    
    This is a business-specific endpoint for stock management.
    """
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product is None:
        logger.warning(f"Stock update failed: Product ID {product_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    new_stock = db_product.stock_quantity + quantity_change
    
    if new_stock < 0:
        logger.warning(f"Stock update failed: Product ID {product_id} - new stock {new_stock} is negative.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock quantity cannot be negative. Current stock: {db_product.stock_quantity}, change: {quantity_change}"
        )

    old_stock = db_product.stock_quantity
    db_product.stock_quantity = new_stock
    
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Eager load the category for the response model
    db_product = db.query(models.Product).options(joinedload(models.Product.category)).filter(models.Product.id == db_product.id).first()
    
    log_activity(
        db, 
        "Product", 
        db_product.id, 
        "STOCK_CHANGE", 
        f"Stock changed from {old_stock} to {new_stock}. Change: {quantity_change}."
    )
    return db_product

# --- Activity Log Endpoints (Read-Only for Audit) ---

@router.get("/activity-logs/", response_model=List[models.ActivityLogResponse])
def list_activity_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g., 'Product', 'Category')."),
    action: Optional[str] = Query(None, description="Filter by action (e.g., 'CREATE', 'UPDATE')."),
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    **Retrieve a list of system activity logs for auditing.**
    
    Supports filtering by entity type and action.
    """
    query = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc())
    
    if entity_type:
        query = query.filter(models.ActivityLog.entity_type == entity_type)
        
    if action:
        query = query.filter(models.ActivityLog.action == action)

    logs = query.offset(skip).limit(limit).all()
    return logs
