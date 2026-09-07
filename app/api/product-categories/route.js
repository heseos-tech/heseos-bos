// Read-only, unauthenticated list of the product catalogue categories (managed at
// Admin -> Products, see lib/productCategories.js). Just slug+label pairs — no PII, safe to
// expose to anything that needs a category picker or label lookup, starting with the partner
// app's catalogue (components/partner/CatalogueScreen.jsx). Adding/removing categories stays
// admin-only at /api/admin/product-categories — mirrors app/api/cities/route.js exactly.
import { getProductCategories } from '@/lib/productCategories';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ categories: await getProductCategories() });
}
