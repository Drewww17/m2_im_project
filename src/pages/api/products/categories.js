/**
 * Categories API Route
 * Get list of product categories
 */
import prisma from '@/lib/prisma';
import { withCashier, apiHandler } from '@/middleware/withAuth';

async function getCategories(req, res) {
  try {
    const categories = await prisma.products.findMany({
      where: { 
        is_active: true,
        category: { not: null }
      },
      select: { category: true },
      distinct: ['category']
    });
    
    return res.status(200).json({
      success: true,
      categories: categories.map(c => c.category).filter(Boolean)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
}

export default apiHandler({
  GET: withCashier(getCategories)
});
