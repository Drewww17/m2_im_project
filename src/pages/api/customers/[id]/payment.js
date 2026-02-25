/**
 * Customer Payment API Route
 * Record payments against customer credit balance
 */
import prisma from '@/lib/prisma';
import { withCashier, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * POST /api/customers/[id]/payment
 * Record a payment from customer
 */
async function recordPayment(req, res) {
  const { id } = req.query;
  const { amount, paymentMethod, description } = req.body;
  const customerId = parseInt(id);
  
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid payment amount is required'
    });
  }
  
  try {
    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get current customer
      const customer = await tx.customers.findUnique({
        where: { customer_id: customerId }
      });
      
      if (!customer) {
        throw new Error('Customer not found');
      }
      
      const currentBalance = parseDecimal(customer.credit_balance);
      const paymentAmount = Math.min(parseFloat(amount), currentBalance);
      const newBalance = currentBalance - paymentAmount;
      
      // Update customer balance
      const updatedCustomer = await tx.customers.update({
        where: { customer_id: customerId },
        data: { credit_balance: newBalance }
      });
      
      // Create ledger entry
      const ledgerEntry = await tx.account_ledger.create({
        data: {
          account_type: 'customer',
          account_id: customerId,
          reference_type: 'PAYMENT',
          reference_id: `PAY-${Date.now()}`,
          credit: paymentAmount,
          debit: 0
        }
      });
      
      // Create transaction record
      const transaction = await tx.agrivet_transactions.create({
        data: {
          ref_id: `PAY-${Date.now()}`,
          transaction_date: new Date(),
          transaction_type: 'PAYMENT',
          account_name: customer.customer_name || 'Customer',
          amount: paymentAmount,
          remarks: description || 'Customer payment'
        }
      });
      
      return {
        customer: updatedCustomer,
        ledgerEntry,
        transaction,
        paymentAmount
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      paymentAmount: result.paymentAmount,
      newBalance: parseDecimal(result.customer.credit_balance)
    });
  } catch (error) {
    console.error('Record payment error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to record payment'
    });
  }
}

export default apiHandler({
  POST: withCashier(recordPayment)
});
