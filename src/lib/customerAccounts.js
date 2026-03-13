import { parseDecimal } from '@/lib/utils';

const DEFAULT_CUSTOMER_TYPE = 'WALK_IN';
const ALLOWED_CUSTOMER_TYPES = new Set(['WALK_IN', 'REGULAR', 'VIP']);

export function normalizeCustomerType(customerType) {
  const normalized = String(customerType || DEFAULT_CUSTOMER_TYPE).toUpperCase();
  return ALLOWED_CUSTOMER_TYPES.has(normalized) ? normalized : DEFAULT_CUSTOMER_TYPE;
}

export function isVipCustomer(customerType) {
  return normalizeCustomerType(customerType) === 'VIP';
}

export function normalizeCreditLimit(customerType, creditLimit) {
  const parsedLimit = Math.max(0, parseDecimal(creditLimit));
  return isVipCustomer(customerType) ? parsedLimit : 0;
}

export async function getOpenPurchaseOrderBalance(tx, customerId) {
  const result = await tx.purchase_orders.aggregate({
    where: {
      customer_id: customerId,
      po_status: 'PENDING'
    },
    _sum: {
      outstanding_balance: true
    }
  });

  return parseDecimal(result._sum.outstanding_balance);
}

export async function getCustomerExposure(tx, customerId) {
  const customer = await tx.customers.findUnique({
    where: { customer_id: customerId }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const creditBalance = parseDecimal(customer.credit_balance);
  const openPurchaseOrderBalance = await getOpenPurchaseOrderBalance(tx, customerId);
  const creditLimit = parseDecimal(customer.credit_limit);

  return {
    customer,
    creditBalance,
    openPurchaseOrderBalance,
    creditLimit,
    totalExposure: creditBalance + openPurchaseOrderBalance
  };
}

export function assertCustomerCanCarryBalance(customer, additionalAmount = 0, options = {}) {
  if (!customer) {
    throw new Error('Customer not found');
  }

  if (!isVipCustomer(customer.customer_type)) {
    throw new Error('Only VIP customers can carry a balance with the business');
  }

  const creditLimit = parseDecimal(customer.credit_limit);
  if (creditLimit <= 0) {
    throw new Error('This VIP customer needs a credit limit before using account balance');
  }

  const baseExposure =
    options.currentExposure !== undefined
      ? Math.max(0, parseDecimal(options.currentExposure))
      : Math.max(0, parseDecimal(customer.credit_balance));
  const requestedAmount = Math.max(0, parseDecimal(additionalAmount));
  const nextExposure = baseExposure + requestedAmount;

  if (nextExposure > creditLimit) {
    const availableCredit = Math.max(0, creditLimit - baseExposure);
    throw new Error(`Credit limit exceeded. Available credit: ${availableCredit.toFixed(2)}`);
  }

  return {
    creditLimit,
    baseExposure,
    nextExposure,
    availableCredit: Math.max(0, creditLimit - nextExposure)
  };
}
