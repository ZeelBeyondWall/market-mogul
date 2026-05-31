import type { Book, Order } from './types';

export function makeBook(): Book {
  return { bids: [], asks: [] };
}

export function insertOrder(book: Book, side: 'bids' | 'asks', order: Order): void {
  if (!order || order.qty <= 0 || !isFinite(order.px) || order.px <= 0) return;
  const arr = book[side];
  if (side === 'bids') {
    let i = 0; while (i < arr.length && arr[i].px > order.px) i++;
    arr.splice(i, 0, order);
  } else {
    let i = 0; while (i < arr.length && arr[i].px < order.px) i++;
    arr.splice(i, 0, order);
  }
  if (arr.length > 40) arr.length = 40;
}

export function removeOrder(book: Book, side: 'bids' | 'asks', orderId: number): void {
  const arr = book[side];
  const i = arr.findIndex(o => o.id === orderId);
  if (i >= 0) arr.splice(i, 1);
}

export function bestBid(book: Book): number {
  return book.bids[0]?.px || 0;
}

export function bestAsk(book: Book): number {
  return book.asks[0]?.px || Infinity;
}

export function midPrice(book: Book): number {
  const b = bestBid(book), a = bestAsk(book);
  if (b > 0 && isFinite(a)) return (b + a) / 2;
  if (b > 0) return b;
  if (isFinite(a)) return a;
  return 0;
}
