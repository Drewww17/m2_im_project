import prisma from '@/lib/prisma';
import { withManager, apiHandler } from '@/middleware/withAuth';
import {
  buildBusinessDaySnapshot,
  formatBusinessDayRecord,
  getBusinessDateString,
  reconcileBalanceSheet
} from '@/lib/businessDay';
import { parseDecimal } from '@/lib/utils';

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAuditFields(user, mode) {
  const prefix = mode === 'closed' ? 'closed' : 'opened';

  return {
    [`${prefix}_by_user_id`]: user?.userId || null,
    [`${prefix}_by_username`]: user?.username || null,
    [`${prefix}_by_name`]: user?.fullName || null
  };
}

async function getBusinessDay(req, res) {
  const businessDate = getBusinessDateString(req.query.date || new Date());

  try {
    const result = await prisma.$transaction(async (tx) => {
      const day = await tx.business_days.findUnique({
        where: { business_date: businessDate }
      });

      const snapshot = await buildBusinessDaySnapshot(tx, businessDate, {
        openingCash: parseDecimal(day?.opening_cash)
      });

      return {
        day,
        snapshot
      };
    });

    return res.status(200).json({
      success: true,
      businessDay: formatBusinessDayRecord(result.day),
      snapshot: result.day?.snapshot || result.snapshot,
      liveSnapshot: result.snapshot
    });
  } catch (error) {
    console.error('Get business day error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch business day'
    });
  }
}

async function openBusinessDay(req, res) {
  const businessDate = getBusinessDateString(req.body?.date || new Date());
  const openingCash = toNumber(req.body?.openingCash);
  const openingNote = String(req.body?.openingNote || '').trim() || null;

  if (openingCash === null || openingCash < 0) {
    return res.status(400).json({
      success: false,
      error: 'Opening cash must be a valid non-negative amount'
    });
  }

  try {
    const day = await prisma.$transaction(async (tx) => {
      const existing = await tx.business_days.findUnique({
        where: { business_date: businessDate }
      });

      if (existing?.status === 'CLOSED') {
        throw new Error(`Business day ${businessDate} is already closed`);
      }

      if (existing) {
        return tx.business_days.update({
          where: { business_date: businessDate },
          data: {
            opening_cash: openingCash,
            opening_note: openingNote,
            ...getAuditFields(req.user, 'opened')
          }
        });
      }

      return tx.business_days.create({
        data: {
          business_date: businessDate,
          opening_cash: openingCash,
          opening_note: openingNote,
          ...getAuditFields(req.user, 'opened')
        }
      });
    });

    return res.status(200).json({
      success: true,
      businessDay: formatBusinessDayRecord(day)
    });
  } catch (error) {
    console.error('Open business day error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to open business day'
    });
  }
}

async function closeBusinessDay(req, res) {
  const businessDate = getBusinessDateString(req.body?.date || new Date());
  const closingNote = String(req.body?.closingNote || '').trim() || null;
  const actualCashOnHand = toNumber(req.body?.actualCashOnHand);

  if (actualCashOnHand !== null && actualCashOnHand < 0) {
    return res.status(400).json({
      success: false,
      error: 'Actual cash on hand must be a valid non-negative amount'
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.business_days.findUnique({
        where: { business_date: businessDate }
      });

      const snapshot = await buildBusinessDaySnapshot(tx, businessDate, {
        openingCash: parseDecimal(existing?.opening_cash)
      });
      const expectedCashOnHand = snapshot.summary.expected_cash_on_hand;
      const cashVariance =
        actualCashOnHand === null ? null : actualCashOnHand - expectedCashOnHand;
      const snapshotForStorage = JSON.parse(JSON.stringify(snapshot));
      snapshotForStorage.balanceSheet = reconcileBalanceSheet(
        snapshot.balanceSheet,
        actualCashOnHand
      );

      const data = {
        status: 'CLOSED',
        opening_cash: parseDecimal(existing?.opening_cash),
        opening_note: existing?.opening_note || null,
        closing_note: closingNote,
        actual_cash_on_hand: actualCashOnHand,
        expected_cash_on_hand: expectedCashOnHand,
        cash_variance: cashVariance,
        sales_total: snapshot.summary.sales_total,
        cash_sales_total: snapshot.summary.cash_sales_total,
        online_sales_total: snapshot.summary.online_sales_total,
        credit_sales_total: snapshot.summary.credit_sales_total,
        customer_payments_total: snapshot.summary.customer_payments_total,
        supplier_payments_total: snapshot.summary.supplier_payments_total,
        purchase_orders_total: snapshot.summary.purchase_orders_total,
        supplies_total: snapshot.summary.supplies_total,
        total_cash_inflows: snapshot.summary.total_cash_inflows,
        total_cash_outflows: snapshot.summary.total_cash_outflows,
        total_transactions: snapshot.summary.total_transactions,
        snapshot: snapshotForStorage,
        closed_at: new Date(),
        ...getAuditFields(req.user, 'closed')
      };

      const day = existing
        ? await tx.business_days.update({
            where: { business_date: businessDate },
            data
          })
        : await tx.business_days.create({
            data: {
              business_date: businessDate,
              ...getAuditFields(req.user, 'opened'),
              ...data
            }
          });

      return {
        day,
        snapshot: snapshotForStorage
      };
    });

    return res.status(200).json({
      success: true,
      businessDay: formatBusinessDayRecord(result.day),
      snapshot: result.snapshot
    });
  } catch (error) {
    console.error('Close business day error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to close business day'
    });
  }
}

export default apiHandler({
  GET: withManager(getBusinessDay),
  POST: withManager(openBusinessDay),
  PUT: withManager(closeBusinessDay)
});
