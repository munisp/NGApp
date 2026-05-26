package inventory

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Product represents a product in the inventory system
type Product struct {
	ID                uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProductNumber     string          `json:"product_number" gorm:"uniqueIndex;not null"`
	Name              string          `json:"name" gorm:"not null;index"`
	Description       string          `json:"description"`
	ShortDescription  string          `json:"short_description"`
	SKU               string          `json:"sku" gorm:"uniqueIndex;not null"`
	Barcode           string          `json:"barcode" gorm:"index"`
	UPC               string          `json:"upc" gorm:"index"`
	EAN               string          `json:"ean" gorm:"index"`
	ISBN              string          `json:"isbn" gorm:"index"`
	
	// Product Classification
	CategoryID        *uuid.UUID      `json:"category_id" gorm:"type:uuid;index"`
	Category          *Category       `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
	BrandID           *uuid.UUID      `json:"brand_id" gorm:"type:uuid;index"`
	Brand             *Brand          `json:"brand,omitempty" gorm:"foreignKey:BrandID"`
	ManufacturerID    *uuid.UUID      `json:"manufacturer_id" gorm:"type:uuid;index"`
	Manufacturer      *Manufacturer   `json:"manufacturer,omitempty" gorm:"foreignKey:ManufacturerID"`
	
	// Product Type and Status
	Type              ProductType     `json:"type" gorm:"not null;index"`
	Status            ProductStatus   `json:"status" gorm:"not null;index;default:'active'"`
	Condition         ProductCondition `json:"condition" gorm:"not null;default:'new'"`
	
	// Pricing Information
	CostPrice         decimal.Decimal `json:"cost_price" gorm:"type:decimal(15,4);default:0"`
	ListPrice         decimal.Decimal `json:"list_price" gorm:"type:decimal(15,4);default:0"`
	SalePrice         decimal.Decimal `json:"sale_price" gorm:"type:decimal(15,4);default:0"`
	MinPrice          decimal.Decimal `json:"min_price" gorm:"type:decimal(15,4);default:0"`
	MaxPrice          decimal.Decimal `json:"max_price" gorm:"type:decimal(15,4);default:0"`
	Currency          string          `json:"currency" gorm:"default:'USD'"`
	
	// Physical Properties
	Weight            decimal.Decimal `json:"weight" gorm:"type:decimal(10,4);default:0"`
	WeightUnit        string          `json:"weight_unit" gorm:"default:'kg'"`
	Length            decimal.Decimal `json:"length" gorm:"type:decimal(10,4);default:0"`
	Width             decimal.Decimal `json:"width" gorm:"type:decimal(10,4);default:0"`
	Height            decimal.Decimal `json:"height" gorm:"type:decimal(10,4);default:0"`
	DimensionUnit     string          `json:"dimension_unit" gorm:"default:'cm'"`
	Volume            decimal.Decimal `json:"volume" gorm:"type:decimal(10,4);default:0"`
	VolumeUnit        string          `json:"volume_unit" gorm:"default:'cm3'"`
	
	// Inventory Management
	TrackInventory    bool            `json:"track_inventory" gorm:"default:true"`
	StockQuantity     int64           `json:"stock_quantity" gorm:"default:0"`
	ReorderLevel      int64           `json:"reorder_level" gorm:"default:0"`
	ReorderQuantity   int64           `json:"reorder_quantity" gorm:"default:0"`
	MaxStockLevel     int64           `json:"max_stock_level" gorm:"default:0"`
	MinStockLevel     int64           `json:"min_stock_level" gorm:"default:0"`
	
	// Sales Information
	IsSellable        bool            `json:"is_sellable" gorm:"default:true"`
	IsPurchasable     bool            `json:"is_purchasable" gorm:"default:true"`
	IsShippable       bool            `json:"is_shippable" gorm:"default:true"`
	IsDigital         bool            `json:"is_digital" gorm:"default:false"`
	IsSubscription    bool            `json:"is_subscription" gorm:"default:false"`
	IsBundle          bool            `json:"is_bundle" gorm:"default:false"`
	IsVariant         bool            `json:"is_variant" gorm:"default:false"`
	
	// Variant Information
	ParentProductID   *uuid.UUID      `json:"parent_product_id" gorm:"type:uuid;index"`
	ParentProduct     *Product        `json:"parent_product,omitempty" gorm:"foreignKey:ParentProductID"`
	VariantAttributes map[string]interface{} `json:"variant_attributes" gorm:"type:jsonb"`
	
	// SEO and Marketing
	MetaTitle         string          `json:"meta_title"`
	MetaDescription   string          `json:"meta_description"`
	MetaKeywords      string          `json:"meta_keywords"`
	URLSlug           string          `json:"url_slug" gorm:"index"`
	
	// Media and Assets
	Images            []ProductImage  `json:"images,omitempty" gorm:"foreignKey:ProductID"`
	Documents         []ProductDocument `json:"documents,omitempty" gorm:"foreignKey:ProductID"`
	
	// Supplier Information
	PrimarySupplierID *uuid.UUID      `json:"primary_supplier_id" gorm:"type:uuid;index"`
	PrimarySupplier   *Supplier       `json:"primary_supplier,omitempty" gorm:"foreignKey:PrimarySupplierID"`
	SupplierProducts  []SupplierProduct `json:"supplier_products,omitempty" gorm:"foreignKey:ProductID"`
	
	// Lifecycle Dates
	LaunchDate        *time.Time      `json:"launch_date"`
	DiscontinueDate   *time.Time      `json:"discontinue_date"`
	
	// Additional Information
	Tags              []string        `json:"tags" gorm:"type:text[]"`
	Notes             string          `json:"notes"`
	CustomFields      map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt         time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	CreatedBy         *uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	UpdatedBy         *uuid.UUID      `json:"updated_by" gorm:"type:uuid"`
	DeletedAt         gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Category represents a product category
type Category struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name             string          `json:"name" gorm:"not null;index"`
	Description      string          `json:"description"`
	ParentID         *uuid.UUID      `json:"parent_id" gorm:"type:uuid;index"`
	Parent           *Category       `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children         []Category      `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Level            int             `json:"level" gorm:"default:0"`
	Path             string          `json:"path" gorm:"index"`
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	SortOrder        int             `json:"sort_order" gorm:"default:0"`
	ImageURL         string          `json:"image_url"`
	IconURL          string          `json:"icon_url"`
	MetaTitle        string          `json:"meta_title"`
	MetaDescription  string          `json:"meta_description"`
	URLSlug          string          `json:"url_slug" gorm:"index"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Brand represents a product brand
type Brand struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name             string          `json:"name" gorm:"not null;uniqueIndex"`
	Description      string          `json:"description"`
	LogoURL          string          `json:"logo_url"`
	Website          string          `json:"website"`
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	SortOrder        int             `json:"sort_order" gorm:"default:0"`
	MetaTitle        string          `json:"meta_title"`
	MetaDescription  string          `json:"meta_description"`
	URLSlug          string          `json:"url_slug" gorm:"index"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Manufacturer represents a product manufacturer
type Manufacturer struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name             string          `json:"name" gorm:"not null;uniqueIndex"`
	Description      string          `json:"description"`
	Website          string          `json:"website"`
	Email            string          `json:"email"`
	Phone            string          `json:"phone"`
	Address          string          `json:"address"`
	City             string          `json:"city"`
	State            string          `json:"state"`
	PostalCode       string          `json:"postal_code"`
	Country          string          `json:"country"`
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Supplier represents a supplier
type Supplier struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SupplierNumber   string          `json:"supplier_number" gorm:"uniqueIndex;not null"`
	Name             string          `json:"name" gorm:"not null;index"`
	LegalName        string          `json:"legal_name"`
	Type             SupplierType    `json:"type" gorm:"not null;index"`
	Status           SupplierStatus  `json:"status" gorm:"not null;index;default:'active'"`
	
	// Contact Information
	Email            string          `json:"email" gorm:"index"`
	Phone            string          `json:"phone"`
	Website          string          `json:"website"`
	
	// Address Information
	BillingAddress   Address         `json:"billing_address" gorm:"embedded;embeddedPrefix:billing_"`
	ShippingAddress  Address         `json:"shipping_address" gorm:"embedded;embeddedPrefix:shipping_"`
	
	// Business Information
	TaxID            string          `json:"tax_id"`
	BusinessLicense  string          `json:"business_license"`
	CertificationLevel SupplierCertification `json:"certification_level" gorm:"default:'none'"`
	
	// Financial Information
	PaymentTerms     string          `json:"payment_terms"`
	CreditLimit      decimal.Decimal `json:"credit_limit" gorm:"type:decimal(15,4);default:0"`
	Currency         string          `json:"currency" gorm:"default:'USD'"`
	
	// Performance Metrics
	Rating           decimal.Decimal `json:"rating" gorm:"type:decimal(3,2);default:0"`
	OnTimeDelivery   decimal.Decimal `json:"on_time_delivery" gorm:"type:decimal(5,2);default:0"`
	QualityScore     decimal.Decimal `json:"quality_score" gorm:"type:decimal(5,2);default:0"`
	
	// Relationships
	ContactPersons   []SupplierContact `json:"contact_persons,omitempty" gorm:"foreignKey:SupplierID"`
	Products         []SupplierProduct `json:"products,omitempty" gorm:"foreignKey:SupplierID"`
	
	// Additional Information
	Notes            string          `json:"notes"`
	Tags             []string        `json:"tags" gorm:"type:text[]"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	CreatedBy        *uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	UpdatedBy        *uuid.UUID      `json:"updated_by" gorm:"type:uuid"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// SupplierContact represents a contact person at a supplier
type SupplierContact struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SupplierID       uuid.UUID       `json:"supplier_id" gorm:"type:uuid;not null;index"`
	FirstName        string          `json:"first_name" gorm:"not null"`
	LastName         string          `json:"last_name" gorm:"not null"`
	Title            string          `json:"title"`
	Department       string          `json:"department"`
	Email            string          `json:"email" gorm:"index"`
	Phone            string          `json:"phone"`
	Mobile           string          `json:"mobile"`
	IsPrimary        bool            `json:"is_primary" gorm:"default:false"`
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	Notes            string          `json:"notes"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// SupplierProduct represents the relationship between supplier and product
type SupplierProduct struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	SupplierID       uuid.UUID       `json:"supplier_id" gorm:"type:uuid;not null;index"`
	Supplier         *Supplier       `json:"supplier,omitempty" gorm:"foreignKey:SupplierID"`
	ProductID        uuid.UUID       `json:"product_id" gorm:"type:uuid;not null;index"`
	Product          *Product        `json:"product,omitempty" gorm:"foreignKey:ProductID"`
	
	// Supplier-specific product information
	SupplierSKU      string          `json:"supplier_sku" gorm:"index"`
	SupplierName     string          `json:"supplier_name"`
	SupplierDescription string       `json:"supplier_description"`
	
	// Pricing and Terms
	CostPrice        decimal.Decimal `json:"cost_price" gorm:"type:decimal(15,4);default:0"`
	Currency         string          `json:"currency" gorm:"default:'USD'"`
	MinOrderQuantity int64           `json:"min_order_quantity" gorm:"default:1"`
	MaxOrderQuantity int64           `json:"max_order_quantity" gorm:"default:0"`
	LeadTime         int             `json:"lead_time" gorm:"default:0"` // in days
	
	// Status and Availability
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	IsPrimary        bool            `json:"is_primary" gorm:"default:false"`
	IsPreferred      bool            `json:"is_preferred" gorm:"default:false"`
	Availability     SupplierProductAvailability `json:"availability" gorm:"default:'available'"`
	
	// Quality and Performance
	QualityRating    decimal.Decimal `json:"quality_rating" gorm:"type:decimal(3,2);default:0"`
	DeliveryRating   decimal.Decimal `json:"delivery_rating" gorm:"type:decimal(3,2);default:0"`
	
	// Additional Information
	Notes            string          `json:"notes"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Warehouse represents a warehouse or storage location
type Warehouse struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WarehouseNumber  string          `json:"warehouse_number" gorm:"uniqueIndex;not null"`
	Name             string          `json:"name" gorm:"not null;index"`
	Type             WarehouseType   `json:"type" gorm:"not null;index"`
	Status           WarehouseStatus `json:"status" gorm:"not null;index;default:'active'"`
	
	// Location Information
	Address          Address         `json:"address" gorm:"embedded"`
	Latitude         *decimal.Decimal `json:"latitude" gorm:"type:decimal(10,8)"`
	Longitude        *decimal.Decimal `json:"longitude" gorm:"type:decimal(11,8)"`
	Timezone         string          `json:"timezone"`
	
	// Capacity Information
	TotalCapacity    decimal.Decimal `json:"total_capacity" gorm:"type:decimal(15,4);default:0"`
	UsedCapacity     decimal.Decimal `json:"used_capacity" gorm:"type:decimal(15,4);default:0"`
	AvailableCapacity decimal.Decimal `json:"available_capacity" gorm:"type:decimal(15,4);default:0"`
	CapacityUnit     string          `json:"capacity_unit" gorm:"default:'m3'"`
	
	// Contact Information
	ManagerName      string          `json:"manager_name"`
	ManagerEmail     string          `json:"manager_email"`
	ManagerPhone     string          `json:"manager_phone"`
	
	// Operating Information
	OperatingHours   map[string]interface{} `json:"operating_hours" gorm:"type:jsonb"`
	IsDefault        bool            `json:"is_default" gorm:"default:false"`
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	
	// Relationships
	Locations        []Location      `json:"locations,omitempty" gorm:"foreignKey:WarehouseID"`
	StockItems       []StockItem     `json:"stock_items,omitempty" gorm:"foreignKey:WarehouseID"`
	
	// Additional Information
	Description      string          `json:"description"`
	Notes            string          `json:"notes"`
	Tags             []string        `json:"tags" gorm:"type:text[]"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	CreatedBy        *uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	UpdatedBy        *uuid.UUID      `json:"updated_by" gorm:"type:uuid"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Location represents a specific location within a warehouse
type Location struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WarehouseID      uuid.UUID       `json:"warehouse_id" gorm:"type:uuid;not null;index"`
	Warehouse        *Warehouse      `json:"warehouse,omitempty" gorm:"foreignKey:WarehouseID"`
	LocationCode     string          `json:"location_code" gorm:"not null;index"`
	Name             string          `json:"name" gorm:"not null"`
	Type             LocationType    `json:"type" gorm:"not null;index"`
	
	// Hierarchical Structure
	ParentLocationID *uuid.UUID      `json:"parent_location_id" gorm:"type:uuid;index"`
	ParentLocation   *Location       `json:"parent_location,omitempty" gorm:"foreignKey:ParentLocationID"`
	Children         []Location      `json:"children,omitempty" gorm:"foreignKey:ParentLocationID"`
	Level            int             `json:"level" gorm:"default:0"`
	Path             string          `json:"path" gorm:"index"`
	
	// Physical Properties
	Zone             string          `json:"zone"`
	Aisle            string          `json:"aisle"`
	Rack             string          `json:"rack"`
	Shelf            string          `json:"shelf"`
	Bin              string          `json:"bin"`
	
	// Capacity Information
	MaxCapacity      decimal.Decimal `json:"max_capacity" gorm:"type:decimal(15,4);default:0"`
	UsedCapacity     decimal.Decimal `json:"used_capacity" gorm:"type:decimal(15,4);default:0"`
	CapacityUnit     string          `json:"capacity_unit" gorm:"default:'units'"`
	
	// Status and Configuration
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	IsPickable       bool            `json:"is_pickable" gorm:"default:true"`
	IsReceivable     bool            `json:"is_receivable" gorm:"default:true"`
	IsCountable      bool            `json:"is_countable" gorm:"default:true"`
	
	// Relationships
	StockItems       []StockItem     `json:"stock_items,omitempty" gorm:"foreignKey:LocationID"`
	
	// Additional Information
	Description      string          `json:"description"`
	Notes            string          `json:"notes"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// StockItem represents inventory stock for a product at a specific location
type StockItem struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProductID        uuid.UUID       `json:"product_id" gorm:"type:uuid;not null;index"`
	Product          *Product        `json:"product,omitempty" gorm:"foreignKey:ProductID"`
	WarehouseID      uuid.UUID       `json:"warehouse_id" gorm:"type:uuid;not null;index"`
	Warehouse        *Warehouse      `json:"warehouse,omitempty" gorm:"foreignKey:WarehouseID"`
	LocationID       *uuid.UUID      `json:"location_id" gorm:"type:uuid;index"`
	Location         *Location       `json:"location,omitempty" gorm:"foreignKey:LocationID"`
	
	// Stock Quantities
	QuantityOnHand   int64           `json:"quantity_on_hand" gorm:"default:0"`
	QuantityReserved int64           `json:"quantity_reserved" gorm:"default:0"`
	QuantityAvailable int64          `json:"quantity_available" gorm:"default:0"`
	QuantityOnOrder  int64           `json:"quantity_on_order" gorm:"default:0"`
	QuantityAllocated int64          `json:"quantity_allocated" gorm:"default:0"`
	
	// Reorder Information
	ReorderLevel     int64           `json:"reorder_level" gorm:"default:0"`
	ReorderQuantity  int64           `json:"reorder_quantity" gorm:"default:0"`
	MaxStockLevel    int64           `json:"max_stock_level" gorm:"default:0"`
	MinStockLevel    int64           `json:"min_stock_level" gorm:"default:0"`
	
	// Cost Information
	AverageCost      decimal.Decimal `json:"average_cost" gorm:"type:decimal(15,4);default:0"`
	LastCost         decimal.Decimal `json:"last_cost" gorm:"type:decimal(15,4);default:0"`
	StandardCost     decimal.Decimal `json:"standard_cost" gorm:"type:decimal(15,4);default:0"`
	
	// Dates
	LastReceived     *time.Time      `json:"last_received"`
	LastIssued       *time.Time      `json:"last_issued"`
	LastCounted      *time.Time      `json:"last_counted"`
	NextCountDate    *time.Time      `json:"next_count_date"`
	
	// Status and Configuration
	IsActive         bool            `json:"is_active" gorm:"default:true"`
	IsTracked        bool            `json:"is_tracked" gorm:"default:true"`
	
	// Additional Information
	Notes            string          `json:"notes"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// StockMovement represents inventory movements
type StockMovement struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	MovementNumber   string          `json:"movement_number" gorm:"uniqueIndex;not null"`
	ProductID        uuid.UUID       `json:"product_id" gorm:"type:uuid;not null;index"`
	Product          *Product        `json:"product,omitempty" gorm:"foreignKey:ProductID"`
	WarehouseID      uuid.UUID       `json:"warehouse_id" gorm:"type:uuid;not null;index"`
	Warehouse        *Warehouse      `json:"warehouse,omitempty" gorm:"foreignKey:WarehouseID"`
	LocationID       *uuid.UUID      `json:"location_id" gorm:"type:uuid;index"`
	Location         *Location       `json:"location,omitempty" gorm:"foreignKey:LocationID"`
	
	// Movement Details
	MovementType     MovementType    `json:"movement_type" gorm:"not null;index"`
	Direction        MovementDirection `json:"direction" gorm:"not null;index"`
	Quantity         int64           `json:"quantity" gorm:"not null"`
	UnitCost         decimal.Decimal `json:"unit_cost" gorm:"type:decimal(15,4);default:0"`
	TotalCost        decimal.Decimal `json:"total_cost" gorm:"type:decimal(15,4);default:0"`
	
	// Reference Information
	ReferenceType    string          `json:"reference_type"`
	ReferenceID      *uuid.UUID      `json:"reference_id" gorm:"type:uuid;index"`
	ReferenceNumber  string          `json:"reference_number" gorm:"index"`
	
	// Batch and Serial Information
	BatchNumber      string          `json:"batch_number" gorm:"index"`
	SerialNumber     string          `json:"serial_number" gorm:"index"`
	ExpiryDate       *time.Time      `json:"expiry_date"`
	
	// Movement Date and User
	MovementDate     time.Time       `json:"movement_date" gorm:"not null;index"`
	MovedBy          *uuid.UUID      `json:"moved_by" gorm:"type:uuid"`
	MovedByName      string          `json:"moved_by_name"`
	
	// Additional Information
	Reason           string          `json:"reason"`
	Notes            string          `json:"notes"`
	CustomFields     map[string]interface{} `json:"custom_fields" gorm:"type:jsonb"`
	
	// Audit Fields
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// ProductImage represents product images
type ProductImage struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProductID        uuid.UUID       `json:"product_id" gorm:"type:uuid;not null;index"`
	URL              string          `json:"url" gorm:"not null"`
	AltText          string          `json:"alt_text"`
	Title            string          `json:"title"`
	Type             ImageType       `json:"type" gorm:"default:'product'"`
	IsPrimary        bool            `json:"is_primary" gorm:"default:false"`
	SortOrder        int             `json:"sort_order" gorm:"default:0"`
	FileSize         int64           `json:"file_size" gorm:"default:0"`
	Width            int             `json:"width" gorm:"default:0"`
	Height           int             `json:"height" gorm:"default:0"`
	Format           string          `json:"format"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// ProductDocument represents product documents
type ProductDocument struct {
	ID               uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProductID        uuid.UUID       `json:"product_id" gorm:"type:uuid;not null;index"`
	Name             string          `json:"name" gorm:"not null"`
	Description      string          `json:"description"`
	URL              string          `json:"url" gorm:"not null"`
	Type             DocumentType    `json:"type" gorm:"not null"`
	FileSize         int64           `json:"file_size" gorm:"default:0"`
	Format           string          `json:"format"`
	Version          string          `json:"version" gorm:"default:'1.0'"`
	IsPublic         bool            `json:"is_public" gorm:"default:false"`
	SortOrder        int             `json:"sort_order" gorm:"default:0"`
	CreatedAt        time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// Address represents an address
type Address struct {
	Street     string  `json:"street"`
	Street2    string  `json:"street2"`
	City       string  `json:"city"`
	State      string  `json:"state"`
	PostalCode string  `json:"postal_code"`
	Country    string  `json:"country"`
	Latitude   *decimal.Decimal `json:"latitude" gorm:"type:decimal(10,8)"`
	Longitude  *decimal.Decimal `json:"longitude" gorm:"type:decimal(11,8)"`
}

// Enums

// ProductType represents the type of product
type ProductType string

const (
	ProductTypeSimple      ProductType = "simple"
	ProductTypeConfigurable ProductType = "configurable"
	ProductTypeBundle      ProductType = "bundle"
	ProductTypeGrouped     ProductType = "grouped"
	ProductTypeVirtual     ProductType = "virtual"
	ProductTypeDownloadable ProductType = "downloadable"
	ProductTypeSubscription ProductType = "subscription"
	ProductTypeService     ProductType = "service"
)

// ProductStatus represents the status of a product
type ProductStatus string

const (
	ProductStatusActive      ProductStatus = "active"
	ProductStatusInactive    ProductStatus = "inactive"
	ProductStatusDraft       ProductStatus = "draft"
	ProductStatusDiscontinued ProductStatus = "discontinued"
	ProductStatusOutOfStock  ProductStatus = "out_of_stock"
)

// ProductCondition represents the condition of a product
type ProductCondition string

const (
	ProductConditionNew         ProductCondition = "new"
	ProductConditionUsed        ProductCondition = "used"
	ProductConditionRefurbished ProductCondition = "refurbished"
	ProductConditionDamaged     ProductCondition = "damaged"
)

// SupplierType represents the type of supplier
type SupplierType string

const (
	SupplierTypeManufacturer SupplierType = "manufacturer"
	SupplierTypeDistributor  SupplierType = "distributor"
	SupplierTypeWholesaler   SupplierType = "wholesaler"
	SupplierTypeRetailer     SupplierType = "retailer"
	SupplierTypeDropshipper  SupplierType = "dropshipper"
	SupplierTypeService      SupplierType = "service"
)

// SupplierStatus represents the status of a supplier
type SupplierStatus string

const (
	SupplierStatusActive    SupplierStatus = "active"
	SupplierStatusInactive  SupplierStatus = "inactive"
	SupplierStatusSuspended SupplierStatus = "suspended"
	SupplierStatusBlacklisted SupplierStatus = "blacklisted"
	SupplierStatusPending   SupplierStatus = "pending"
)

// SupplierCertification represents supplier certification level
type SupplierCertification string

const (
	SupplierCertificationNone     SupplierCertification = "none"
	SupplierCertificationBasic    SupplierCertification = "basic"
	SupplierCertificationStandard SupplierCertification = "standard"
	SupplierCertificationPremium  SupplierCertification = "premium"
	SupplierCertificationGold     SupplierCertification = "gold"
)

// SupplierProductAvailability represents supplier product availability
type SupplierProductAvailability string

const (
	SupplierProductAvailable      SupplierProductAvailability = "available"
	SupplierProductUnavailable    SupplierProductAvailability = "unavailable"
	SupplierProductBackorder      SupplierProductAvailability = "backorder"
	SupplierProductDiscontinued   SupplierProductAvailability = "discontinued"
	SupplierProductSpecialOrder   SupplierProductAvailability = "special_order"
)

// WarehouseType represents the type of warehouse
type WarehouseType string

const (
	WarehouseTypeMain        WarehouseType = "main"
	WarehouseTypeBranch      WarehouseType = "branch"
	WarehouseTypeDistribution WarehouseType = "distribution"
	WarehouseTypeRetail      WarehouseType = "retail"
	WarehouseTypeVirtual     WarehouseType = "virtual"
	WarehouseTypeTransit     WarehouseType = "transit"
)

// WarehouseStatus represents the status of a warehouse
type WarehouseStatus string

const (
	WarehouseStatusActive    WarehouseStatus = "active"
	WarehouseStatusInactive  WarehouseStatus = "inactive"
	WarehouseStatusMaintenance WarehouseStatus = "maintenance"
	WarehouseStatusClosed    WarehouseStatus = "closed"
)

// LocationType represents the type of location
type LocationType string

const (
	LocationTypeZone     LocationType = "zone"
	LocationTypeAisle    LocationType = "aisle"
	LocationTypeRack     LocationType = "rack"
	LocationTypeShelf    LocationType = "shelf"
	LocationTypeBin      LocationType = "bin"
	LocationTypeFloor    LocationType = "floor"
	LocationTypeReceiving LocationType = "receiving"
	LocationTypeShipping LocationType = "shipping"
	LocationTypePicking  LocationType = "picking"
	LocationTypeStaging  LocationType = "staging"
)

// MovementType represents the type of stock movement
type MovementType string

const (
	MovementTypeReceipt      MovementType = "receipt"
	MovementTypeIssue        MovementType = "issue"
	MovementTypeTransfer     MovementType = "transfer"
	MovementTypeAdjustment   MovementType = "adjustment"
	MovementTypeReturn       MovementType = "return"
	MovementTypeReservation  MovementType = "reservation"
	MovementTypeAllocation   MovementType = "allocation"
	MovementTypeCycleCount   MovementType = "cycle_count"
	MovementTypePhysicalCount MovementType = "physical_count"
	MovementTypeDamage       MovementType = "damage"
	MovementTypeExpiry       MovementType = "expiry"
	MovementTypeProduction   MovementType = "production"
	MovementTypeConsumption  MovementType = "consumption"
)

// MovementDirection represents the direction of stock movement
type MovementDirection string

const (
	MovementDirectionIn  MovementDirection = "in"
	MovementDirectionOut MovementDirection = "out"
)

// ImageType represents the type of image
type ImageType string

const (
	ImageTypeProduct     ImageType = "product"
	ImageTypeThumbnail   ImageType = "thumbnail"
	ImageTypeGallery     ImageType = "gallery"
	ImageTypeZoom        ImageType = "zoom"
	ImageTypePackaging   ImageType = "packaging"
	ImageTypeInstruction ImageType = "instruction"
)

// DocumentType represents the type of document
type DocumentType string

const (
	DocumentTypeManual       DocumentType = "manual"
	DocumentTypeSpecification DocumentType = "specification"
	DocumentTypeDatasheet    DocumentType = "datasheet"
	DocumentTypeCertificate  DocumentType = "certificate"
	DocumentTypeWarranty     DocumentType = "warranty"
	DocumentTypeInstallation DocumentType = "installation"
	DocumentTypeMaintenance  DocumentType = "maintenance"
	DocumentTypeSafety       DocumentType = "safety"
	DocumentTypeCompliance   DocumentType = "compliance"
)

// Model hooks and methods

// BeforeCreate hook for Product
func (p *Product) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.ProductNumber == "" {
		p.ProductNumber = generateProductNumber()
	}
	if p.URLSlug == "" {
		p.URLSlug = generateSlug(p.Name)
	}
	return nil
}

// BeforeUpdate hook for Product
func (p *Product) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = time.Now().UTC()
	return nil
}

// CalculateAvailableQuantity calculates available quantity for stock item
func (s *StockItem) CalculateAvailableQuantity() {
	s.QuantityAvailable = s.QuantityOnHand - s.QuantityReserved - s.QuantityAllocated
}

// IsLowStock checks if stock is below reorder level
func (s *StockItem) IsLowStock() bool {
	return s.QuantityAvailable <= s.ReorderLevel
}

// IsOutOfStock checks if stock is out of stock
func (s *StockItem) IsOutOfStock() bool {
	return s.QuantityAvailable <= 0
}

// Helper functions

// generateProductNumber generates a unique product number
func generateProductNumber() string {
	return "PROD-" + time.Now().Format("20060102") + "-" + uuid.New().String()[:8]
}

// generateSlug generates a URL slug from a string
func generateSlug(text string) string {
	// This would implement proper slug generation
	return text // Simplified for now
}

// TableName methods for custom table names
func (Product) TableName() string {
	return "products"
}

func (Category) TableName() string {
	return "categories"
}

func (Brand) TableName() string {
	return "brands"
}

func (Manufacturer) TableName() string {
	return "manufacturers"
}

func (Supplier) TableName() string {
	return "suppliers"
}

func (SupplierContact) TableName() string {
	return "supplier_contacts"
}

func (SupplierProduct) TableName() string {
	return "supplier_products"
}

func (Warehouse) TableName() string {
	return "warehouses"
}

func (Location) TableName() string {
	return "locations"
}

func (StockItem) TableName() string {
	return "stock_items"
}

func (StockMovement) TableName() string {
	return "stock_movements"
}

func (ProductImage) TableName() string {
	return "product_images"
}

func (ProductDocument) TableName() string {
	return "product_documents"
}

