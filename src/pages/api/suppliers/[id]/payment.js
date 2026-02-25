/**
 * Supplier Payment API Route
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * POST /api/suppliers/[id]/payment
 * Record payment to supplier
 */
async function recordPayment(req, res) {
  const { id } = req.query;
  const { amount, paymentMethod, description } = req.body;
  const supplierId = parseInt(id);
  
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid payment amount is required'
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.suppliers.findUnique({
        where: { supplier_id: supplierId }
      });
      
      if (!supplier) {
        throw new Error('Supplier not found');
      }
      
      const currentBalance = parseDecimal(supplier.payable_balance);
      const paymentAmount = Math.min(parseFloat(amount), currentBalance);
      const newBalance = currentBalance - paymentAmount;
      
      // Update supplier balance
      const updatedSupplier = await tx.suppliers.update({
        where: { supplier_id: supplierId },
        data: { payable_balance: newBalance }
      });
      
      // Create ledger entry
      await tx.account_ledger.create({
        data: {
          account_type: 'supplier',
          account_id: supplierId,
          reference_type: 'PAYMENT',
          credit: paymentAmount,
          debit: 0
        }
      });
      
      return {
        supplier: updatedSupplier,
        paymentAmount
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      paymentAmount: result.paymentAmount,
      newBalance: parseDecimal(result.supplier.payable_balance)
    });
  } catch (error) {
    console.error('Supplier payment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record payment'
    });
  }
}

export default apiHandler({
  POST: withClerk(recordPayment)
});
