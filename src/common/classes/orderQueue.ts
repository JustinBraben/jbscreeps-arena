import { Order } from './order';

export class OrderQueue {
  private static _orders: Order[] = [];

  public static get(): Order[] {
    return this._orders;
  }

  public static add(order: Order) {
    this._orders.push(order);
  }

  public static remove(order: Order) {
    this._orders = this._orders.filter(
      o => o.role !== order.role && o.level !== order.level && o.priority !== order.priority
    );
  }

  public static getFirst(): Order | undefined {
    return this._orders[0];
  }

  public static hasOrder(): boolean {
    return this._orders.length > 0;
  }

  public static sortByPriority() {
    this._orders.sort((a, b) => a.priority - b.priority);
  }

  public static reset() {
    this._orders = [];
  }
}
