export interface Category {
  id: number
  name: string
  slug: string
  code: string
  parentId: number | null
  image: string | null
  level: number
  productCount: number
  subcategories?: Category[]
}

export interface CategoryTree extends Category {
  children: CategoryTree[]
}
