/**
 * Supplier Payable API Route
 * Record manual payable adjustments against suppliers
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';
import { assertBusinessDayOpen } from '@/lib/businessDay';

/**
 * POST /api/suppliers/[id]/payable
 * Add a manual payable entry for a supplier
 */
async function recordPayable(req, res) {
  const { id } = req.query;
  const { amount, description } = req.body;
  const supplierId = parseInt(id);
  const payableAmount = parseFloat(amount);

  if (!payableAmount || payableAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid payable amount is required'
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await assertBusinessDayOpen(tx);

      const supplier = await tx.suppliers.findUnique({
        where: { supplier_id: supplierId }
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const updatedSupplier = await tx.suppliers.update({
        where: { supplier_id: supplierId },
        data: {
          payable_balance: {
            increment: payableAmount
          }
        }
      });

      await tx.account_ledger.create({
        data: {
          account_type: 'supplier',
          account_id: supplierId,
          reference_type: 'PAYABLE',
          reference_id: supplierId,
          debit: payableAmount,
          credit: 0
        }
      });

      await tx.agrivet_transactions.create({
        data: {
          ref_id: `SUPDUE-${Date.now()}`,
          transaction_date: new Date(),
          transaction_type: 'SUPPLIER_PAYABLE',
          account_name: supplier.supplier_name || 'Supplier',
          amount: payableAmount,
          remarks: description?.trim() || 'Manual supplier payable'
        }
      });

      return updatedSupplier;
    });

    return res.status(200).json({
      success: true,
      message: 'Supplier payable recorded successfully',
      addedAmount: payableAmount,
      newBalance: parseDecimal(result.payable_balance)
    });
  } catch (error) {
    console.error('Supplier payable error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record supplier payable'
    });
  }
}

export default apiHandler({
  POST: withClerk(recordPayable)
});
