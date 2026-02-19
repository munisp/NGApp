import datetime
from typing import List, Optional

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, Index
from sqlalchemy.orm import relationship, DeclarativeBase
from pydantic import BaseModel, Field

# --- SQLAlchemy Base ---

class Base(DeclarativeBase):
    """Base class which provides automated table name
    and common columns like id and created_at/updated_at.
    """
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<{self.__class__.__name__}(id={self.id})>"

# --- SQLAlchemy Models ---

class Category(Base):
    """
    Represents a product category.
    """
    __tablename__ = "categories"

    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    products = relationship("Product", back_populates="category")

    __table_args__ = (
        Index("ix_category_name_lower", name.lower()),
    )

class Product(Base):
    """
    Represents a product in the e-commerce platform.
    """
    __tablename__ = "products"

    name = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    # Relationships
    category = relationship("Category", back_populates="products")

    __table_args__ = (
        Index("ix_product_name_price", name, price),
    )

class ActivityLog(Base):
    """
    Logs significant activities within the system (e.g., product creation, update, deletion).
    """
    __tablename__ = "activity_logs"

    entity_type = Column(String(50), nullable=False) # e.g., 'Product', 'Category'
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False) # e.g., 'CREATE', 'UPDATE', 'DELETE', 'STOCK_CHANGE'
    user_id = Column(Integer, nullable=True) # Assuming a User model exists, but not defining it for simplicity
    details = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_activity_log_entity", entity_type, entity_id),
        Index("ix_activity_log_action", action),
    )

# --- Pydantic Schemas (Base) ---

class CategoryBase(BaseModel):
    """Base schema for Category."""
    name: str = Field(..., max_length=100, description="The name of the product category.")
    description: Optional[str] = Field(None, description="A brief description of the category.")

class ProductBase(BaseModel):
    """Base schema for Product."""
    name: str = Field(..., max_length=255, description="The name of the product.")
    description: Optional[str] = Field(None, description="A detailed description of the product.")
    price: float = Field(..., gt=0, description="The price of the product. Must be greater than 0.")
    stock_quantity: int = Field(0, ge=0, description="The current stock quantity of the product.")
    is_active: bool = Field(True, description="Whether the product is currently active and visible.")
    category_id: int = Field(..., description="The ID of the category the product belongs to.")

class ActivityLogBase(BaseModel):
    """Base schema for ActivityLog."""
    entity_type: str = Field(..., max_length=50, description="The type of entity affected (e.g., 'Product').")
    entity_id: int = Field(..., description="The ID of the entity affected.")
    action: str = Field(..., max_length=50, description="The action performed (e.g., 'CREATE', 'UPDATE').")
    user_id: Optional[int] = Field(None, description="The ID of the user who performed the action.")
    details: Optional[str] = Field(None, description="Additional details about the action.")

# --- Pydantic Schemas (Create) ---

class CategoryCreate(CategoryBase):
    """Schema for creating a new Category."""
    pass

class ProductCreate(ProductBase):
    """Schema for creating a new Product."""
    pass

# --- Pydantic Schemas (Update) ---

class CategoryUpdate(CategoryBase):
    """Schema for updating an existing Category."""
    name: Optional[str] = Field(None, max_length=100, description="The name of the product category.")
    description: Optional[str] = Field(None, description="A brief description of the category.")

class ProductUpdate(ProductBase):
    """Schema for updating an existing Product."""
    name: Optional[str] = Field(None, max_length=255, description="The name of the product.")
    description: Optional[str] = Field(None, description="A detailed description of the product.")
    price: Optional[float] = Field(None, gt=0, description="The price of the product. Must be greater than 0.")
    stock_quantity: Optional[int] = Field(None, ge=0, description="The current stock quantity of the product.")
    is_active: Optional[bool] = Field(None, description="Whether the product is currently active and visible.")
    category_id: Optional[int] = Field(None, description="The ID of the category the product belongs to.")

# --- Pydantic Schemas (Response) ---

class CategoryResponse(CategoryBase):
    """Schema for returning a Category."""
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

class ProductResponse(ProductBase):
    """Schema for returning a Product."""
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    category: CategoryResponse # Nested response for category

    class Config:
        from_attributes = True

class ActivityLogResponse(ActivityLogBase):
    """Schema for returning an ActivityLog entry."""
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Utility to create tables (for initial setup) ---
def create_all_tables(engine):
    """Creates all defined tables in the database."""
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    from config import engine
    print("Creating all tables...")
    create_all_tables(engine)
    print("Tables created successfully.")
