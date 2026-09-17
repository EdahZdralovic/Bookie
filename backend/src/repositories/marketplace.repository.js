const prisma = require('../config/database');
async function getCart(userId, db = prisma) {
  return db.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          book: {
            include: {
              owner: { select: { id: true, firstName: true, lastName: true, status: true } },
              genre: true,
            },
          },
        },
      },
    },
  });
}
async function addToCart(userId, bookId, db = prisma) {
  const cart = await db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return db.cartItem.upsert({
    where: { cartId_bookId: { cartId: cart.id, bookId } },
    create: { cartId: cart.id, bookId },
    update: {},
  });
}
async function removeFromCart(userId, bookId, db = prisma) {
  return db.cartItem.deleteMany({ where: { bookId, cart: { userId } } });
}

async function createOrder(data, db = prisma) {
  return db.order.create({ data, include: { items: true, seller: true } });
}
async function findOrders(userId, role, db = prisma) {
  return db.order.findMany({
    where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    include: {
      items: { include: { review: true } },
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
  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data,
      include: {
        buyer: true,
        seller: true,
        items: true,
        exchangeOffer: { include: { offeredBooks: { include: { book: true } } } },
      },
    });
    const TEXT = require('../constants/community');
    await tx.notification.create({
      data: {
        userId: data.sellerId,
        type: 'ORDER',
        title: TEXT.NEW_ORDER,
        body: TEXT.NEW_ORDER_BODY,
        link: '/exchange-offers',
      },
    });
    return order;
  });
}
async function createReview(data, db = prisma) {
  return db.$transaction(async (tx) => {
    const review = await tx.review.create({ data });
    const item = await tx.orderItem.findUnique({
      where: { id: data.orderItemId },
      include: { order: true },
    });
    const TEXT = require('../constants/community');
    await tx.notification.create({
      data: {
        userId: item.order.sellerId,
        type: 'REVIEW',
        title: TEXT.NEW_REVIEW,
        body: TEXT.NEW_REVIEW_BODY,
        link: `/books/${item.bookId}`,
      },
    });
    return review;
  });
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
