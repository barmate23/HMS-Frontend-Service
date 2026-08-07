export type IngredientCategory = 'Dairy' | 'Produce' | 'Spices & Condiments' | 'Poultry & Meat' | 'Oils & Ghee' | 'Dry Grocery' | 'Beverage Raw';

export type StorageType = 'PERISHABLE' | 'CHILLED' | 'FROZEN' | 'DRY_STORE';

export interface IngredientMaster {
  id: number;
  code: string;
  name: string;
  category: IngredientCategory;
  baseUnit: string; // e.g. GRAM, ML, PCS
  purchaseUnit: string; // e.g. KG, LITER, BOX, PACKET
  conversionFactor: number; // 1 Purchase Unit = N Base Units (e.g. 1 KG = 1000 GRAM)
  yieldPercentage: number; // e.g. 95% yield after prep/trimming
  costPerPurchaseUnit: number; // e.g. ₹350 per KG
  costPerBaseUnit: number; // Computed: costPerPurchaseUnit / conversionFactor
  currentStock: number; // in Base Units
  reorderLevel: number; // in Base Units
  reorderQuantity: number; // in Base Units
  storageType: StorageType;
  supplierName?: string;
  isActive: boolean;
  categoryId?: number;
  baseUnitId?: number;
  purchaseUnitId?: number;
  storageTypeId?: number;
}

export interface RecipeIngredient {
  id?: number;
  ingredientId: number;
  ingredientCode: string;
  ingredientName: string;
  category?: IngredientCategory;
  netQuantity: number; // Qty required in Base Unit (e.g., 200 Grams)
  unit: string; // Base Unit
  wastePercent: number; // Recipe specific prep waste allowance
  grossQuantity: number; // Net Qty / (Yield % / 100)
  unitCost: number; // Cost per Base Unit
  lineCost: number; // grossQuantity * unitCost
}

export interface RecipeMaster {
  id: number;
  menuItemId: number;
  recipeCode: string;
  recipeName: string;
  portionSize: number; // e.g., 1 Plate
  portionUnit: string; // e.g., PLATE, BOWL, PORTION
  prepTimeMins: number;
  ingredients: RecipeIngredient[];
  totalPortionCost: number; // Sum of lineCost for all ingredients
  sellingPrice: number; // From Menu Item
  foodCostPercent: number; // (totalPortionCost / sellingPrice) * 100
  grossMarginPercent: number; // ((sellingPrice - totalPortionCost) / sellingPrice) * 100
  instructions?: string;
  isActive: boolean;
}
