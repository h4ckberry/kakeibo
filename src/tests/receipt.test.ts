import { describe, expect, test } from 'bun:test';
import {
  getFiscalYear,
  groupTransactionsByFiscalYear,
} from '../services/receipt';
import type { ProcessedReceipt } from '../types';

describe('getFiscalYear', () => {
  test('uses current calendar year for April and later', () => {
    expect(getFiscalYear('2026-04-01')).toBe('FY26');
    expect(getFiscalYear('2026-12-31')).toBe('FY26');
  });

  test('uses previous calendar year for January through March', () => {
    expect(getFiscalYear('2026-01-01')).toBe('FY25');
    expect(getFiscalYear('2026-03-31')).toBe('FY25');
  });
});

describe('groupTransactionsByFiscalYear', () => {
  test('groups processed receipt transactions by fiscal year', () => {
    const marchTransaction = {
      date: '2026-03-31',
      storeName: 'Store A',
      majorCategory: '変動費',
      minorCategory: '食費',
      categoryItem: 'カフェ',
      purchasedItem: 'Coffee',
      amount: 120,
    };
    const aprilTransaction = {
      date: '2026-04-01',
      storeName: 'Store B',
      majorCategory: '変動費',
      minorCategory: '食費',
      categoryItem: '食料品',
      purchasedItem: 'Bread',
      amount: 200,
    };
    const receipts: ProcessedReceipt[] = [
      {
        fileId: 'receipt-1',
        fileName: 'receipt-1.jpg',
        transactions: [marchTransaction, aprilTransaction],
      },
    ];

    expect(groupTransactionsByFiscalYear(receipts)).toEqual({
      FY25: [marchTransaction],
      FY26: [aprilTransaction],
    });
  });
});
