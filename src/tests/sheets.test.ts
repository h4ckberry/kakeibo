import { describe, expect, test } from 'bun:test';
import { toSheetValues } from '../services/sheets';
import type { Transaction } from '../types';

describe('toSheetValues', () => {
  test('maps transactions to the seven sheet columns in order', () => {
    const transactions: Transaction[] = [
      {
        date: '2025-10-01',
        storeName: 'コモディイイダ 上板橋店',
        majorCategory: '変動費',
        minorCategory: '食費',
        categoryItem: '食料品',
        purchasedItem: '黒酢もずく',
        amount: 139,
      },
    ];

    expect(toSheetValues(transactions)).toEqual([
      [
        '2025-10-01',
        'コモディイイダ 上板橋店',
        '変動費',
        '食費',
        '食料品',
        '黒酢もずく',
        139,
      ],
    ]);
  });
});
