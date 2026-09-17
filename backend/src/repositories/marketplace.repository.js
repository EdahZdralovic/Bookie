const prisma = require('../config/database');
async function getCart(userId, db = prisma) {
  return db.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          book: {
            include: {
              owner: { select: { id: true, firstName: true, lastName: true } },
              genre: true,
            },
          },
        },
      },
    },
  });
}
async function addToCart(userId, bookId, db = prisma) {
  return db.cart.upsert({
    where: { userId },
    create: { userId, items: { create: { bookId } } },
    update: { items: { create: { bookId } } },
  });
}
async function removeFromCart(userId, bookId, db = prisma) {
  const cart = await db.cart.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return db.cartItem.delete({ where: { cartId_bookId: { cartId: cart.id, bookId } } });
}
async function createOrder(data, db = prisma) {
  return db.order.create({ data, include: { items: true, seller: true } });
}
async function findOrders(userId, role, db = prisma) {
  return db.order.findMany({
    where: { [role === 'SELLER' ? 'sellerId' : 'buyerId']: userId },
    include: {
      items: true,
      buyer: true,
      seller: true,
      exchangeOffer: { include: { offeredBooks: { include: { book: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
async function findOrder(id, db = prisma) {
  return db.order.findUnique({
    where: { id },
    include: { items: true, exchangeOffer: { include: { offeredBooks: true } } },
  });
}
async function updateOrder(id, data, db = prisma) {
  return db.order.update({ where: { id }, data });
}
async function createExchange(data, db = prisma) {
  return db.order.create({ data, include: { exchangeOffer: true } });
}
async function createReview(data, db = prisma) {
  return db.review.create({ data });
}
async function findReview(id, db = prisma) {
  return db.review.findUnique({
    where: { id },
    include: { orderItem: { include: { order: true } } },
  });
}
module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  createOrder,
  findOrders,
  findOrder,
  updateOrder,
  createExchange,
  createReview,
  findReview,
};
