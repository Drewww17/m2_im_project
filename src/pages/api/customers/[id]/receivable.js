/**
 * Customer Receivable API Route
 * Record manual customer balances owed to the business
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';
import { assertBusinessDayOpen } from '@/lib/businessDay';
import { assertCustomerCanCarryBalance, getCustomerExposure } from '@/lib/customerAccounts';

/**
 * POST /api/customers/[id]/receivable
 * Add a manual receivable entry for a VIP customer
 */
async function recordReceivable(req, res) {
  const { id } = req.query;
  const { amount, description } = req.body;
  const customerId = parseInt(id);
  const receivableAmount = parseFloat(amount);

  if (!receivableAmount || receivableAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid receivable amount is required'
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await assertBusinessDayOpen(tx);

      const profile = await getCustomerExposure(tx, customerId);
      assertCustomerCanCarryBalance(profile.customer, receivableAmount, {
        currentExposure: profile.totalExposure
      });

      const updatedCustomer = await tx.customers.update({
        where: { customer_id: customerId },
        data: {
          credit_balance: {
            increment: receivableAmount
          }
        }
      });

      await tx.account_ledger.create({
        data: {
          account_type: 'customer',
          account_id: customerId,
          reference_type: 'RECEIVABLE',
          reference_id: customerId,
          debit: receivableAmount,
          credit: 0
        }
      });

      await tx.agrivet_transactions.create({
        data: {
          ref_id: `CUSDUE-${Date.now()}`,
          transaction_date: new Date(),
          transaction_type: 'CUSTOMER_RECEIVABLE',
          account_name: profile.customer.customer_name || 'Customer',
          amount: receivableAmount,
          remarks: description?.trim() || 'Manual customer balance'
        }
      });

      return updatedCustomer;
    });

    return res.status(200).json({
      success: true,
      message: 'Customer balance recorded successfully',
      addedAmount: receivableAmount,
      newBalance: parseDecimal(result.credit_balance)
    });
  } catch (error) {
    console.error('Customer receivable error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record customer balance'
    });
  }
}

export default apiHandler({
  POST: withClerk(recordReceivable)
});
