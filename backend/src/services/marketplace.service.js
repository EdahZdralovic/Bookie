const { randomUUID } = require('node:crypto');
const prisma = require('../config/database');
const repository = require('../repositories/marketplace.repository');
const { sendOrderNotification, sendExchangeOfferStatusEmail } = require('../utils/mailer');
const MAIL = require('../constants/mail-strings');
const COMMUNITY = require('../constants/community');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
async function cart(userId) {
  return repository.getCart(userId);
}
async function add(userId, bookId) {
  if (!Number.isInteger(bookId) || bookId < 1 || bookId > 2147483647)
    throw new AppException('CART_BOOK_INVALID', HTTP.UNPROCESSABLE);
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { owner: { select: { status: true } } },
  });
  if (
    !book ||
    book.status !== 'ACTIVE' ||
    Number(book.price) <= 0 ||
    book.owner.status !== 'ACTIVE'
  )
    throw new AppException('CART_BOOK_INVALID', HTTP.UNPROCESSABLE);
  if (book.ownerId === userId) throw new AppException('CART_OWNER', HTTP.FORBIDDEN);
  return repository.addToCart(userId, bookId);
}
async function remove(userId, bookId) {
  return repository.removeFromCart(userId, bookId);
}
async function checkout(userId) {
  const orders = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Cart" WHERE "userId" = ${userId} FOR UPDATE`;
    const current = await repository.getCart(userId, tx);
    if (!current?.items.length) throw new AppException('CART_EMPTY', HTTP.UNPROCESSABLE);
    const groups = new Map();
    for (const { book } of current.items) {
      if (book.status !== 'ACTIVE' || Number(book.price) <= 0 || book.owner.status !== 'ACTIVE')
        throw new AppException('CART_BOOK_INVALID', HTTP.UNPROCESSABLE);
      if (book.ownerId === userId) throw new AppException('CART_OWNER', HTTP.FORBIDDEN);
      if (!groups.has(book.ownerId)) groups.set(book.ownerId, []);
      groups.get(book.ownerId).push(book);
    }
    const created = [];
    for (const [sellerId, books] of groups) {
      const order = await repository.createOrder(
        {
          orderNumber: `BK-${randomUUID()}`,
          buyerId: userId,
          sellerId,
          totalAmount:
            books.reduce((sum, book) => sum + Math.round(Number(book.price) * 100), 0) / 100,
          items: {
            create: books.map((book) => ({
              bookId: book.id,
              price: book.price,
              bookTitle: book.title,
              bookAuthor: book.author,
            })),
          },
          statusHistory: { create: { toStatus: 'PENDING', changedById: userId } },
        },
        tx,
      );
      await tx.notification.create({
        data: {
          userId: sellerId,
          type: 'ORDER',
          title: COMMUNITY.NEW_ORDER,
          body: COMMUNITY.NEW_ORDER_BODY,
          link: '/orders',
        },
      });
      created.push(order);
    }
    await tx.cartItem.deleteMany({ where: { id: { in: current.items.map((item) => item.id) } } });
    return created;
  });
  const buyer = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });
  for (const order of orders) {
    const books = order.items.map((item) => ({ title: item.bookTitle, price: item.price }));
    sendOrderNotification({ order, buyer, seller: order.seller, books }).catch((error) =>
      console.error(MAIL.DELIVERY_FAILED, error.message),
    );
  }
  return orders;
}

async function orders(userId, role) {
  return repository.findOrders(userId, role);
}
async function changeOrder(userId, orderId, status) {
  return prisma.$transaction(async (tx) => {
    const order = await repository.findOrder(orderId, tx);
    if (!order || (order.sellerId !== userId && order.buyerId !== userId))
      throw new AppException('ORDER_FORBIDDEN', HTTP.FORBIDDEN);
    if (status === 'CANCELLED' && (order.buyerId !== userId || order.status !== 'PENDING'))
      throw new AppException('ORDER_TRANSITION', HTTP.UNPROCESSABLE);
    if (['ACCEPTED', 'REJECTED', 'COMPLETED'].includes(status) && order.sellerId !== userId)
      throw new AppException('ORDER_FORBIDDEN', HTTP.FORBIDDEN);
    const allowed = { PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['COMPLETED'] };
    if (!allowed[order.status]?.includes(status))
      throw new AppException('ORDER_TRANSITION', HTTP.UNPROCESSABLE);
    const now = new Date();
    const update = {
      status,
      ...(status === 'ACCEPTED' ? { acceptedAt: now } : {}),
      ...(status === 'REJECTED' ? { rejectedAt: now } : {}),
      ...(status === 'COMPLETED' ? { completedAt: now } : {}),
      ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
    };
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: update,
    });
    if (changed.count !== 1) throw new AppException('ORDER_TRANSITION', HTTP.CONFLICT);
    const result = await tx.order.findUnique({ where: { id: orderId } });
    const ids = [
      ...new Set([
        ...order.items.map((item) => item.bookId),
        ...(order.exchangeOffer?.offeredBooks.map((item) => item.bookId) || []),
      ]),
    ];
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: status, changedById: userId },
    });
    if (status === 'ACCEPTED') {
      const reserved = await tx.book.updateMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        data: { status: 'RESERVED' },
      });
      if (reserved.count !== ids.length) throw new AppException('CART_BOOK_INVALID', HTTP.CONFLICT);
      await tx.bookReservation.createMany({ data: ids.map((bookId) => ({ bookId, orderId })) });
    }
    if (status === 'COMPLETED')
      await tx.book.updateMany({
        where: { id: { in: ids } },
        data: { status: order.type === 'EXCHANGE' ? 'EXCHANGED' : 'SOLD' },
      });
    if (status === 'COMPLETED') await tx.bookReservation.deleteMany({ where: { orderId } });
    return result;
  });
}
async function exchange(userId, sellerId, bookId, offeredBookIds) {
  if (![sellerId, bookId].every((id) => Number.isSafeInteger(id) && id > 0))
    throw new AppException('EXCHANGE_BOOK_INVALID', HTTP.UNPROCESSABLE);
  offeredBookIds = [...new Set(offeredBookIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!offeredBookIds.length) throw new AppException('EXCHANGE_BOOK_INVALID', HTTP.UNPROCESSABLE);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  const target = await prisma.book.findUnique({
    where: { id: bookId },
    include: { owner: { select: { status: true } } },
  });
  const offered = await prisma.book.findMany({
    where: { id: { in: offeredBookIds }, ownerId: userId, allowExchange: true, status: 'ACTIVE' },
  });
  if (
    !user ||
    user.role !== 'BUYER' ||
    user.status !== 'ACTIVE' ||
    sellerId === userId ||
    !target ||
    target.ownerId !== sellerId ||
    target.status !== 'ACTIVE' ||
    !target.allowExchange ||
    target.owner.status !== 'ACTIVE' ||
    offered.length !== offeredBookIds.length
  )
    throw new AppException('EXCHANGE_BOOK_INVALID', HTTP.UNPROCESSABLE);
  const order = await repository.createExchange({
    orderNumber: `BK-${randomUUID()}`,
    statusHistory: { create: { toStatus: 'PENDING', changedById: userId } },
    type: 'EXCHANGE',
    buyerId: userId,
    sellerId,
    totalAmount: 0,
    items: {
      create: [{ bookId: target.id, price: 0, bookTitle: target.title, bookAuthor: target.author }],
    },
    exchangeOffer: {
      create: { offeredBooks: { create: offered.map((book) => ({ bookId: book.id })) } },
    },
  });
  require('../utils/mailer')
    .sendExchangeOfferEmail(order)
    .catch((error) => console.error(MAIL.DELIVERY_FAILED, error.message));
  return order;
}
async function review(userId, orderItemId, rating, comment) {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true, review: true },
  });
  if (!item || item.order.buyerId !== userId || item.order.status !== 'COMPLETED')
    throw new AppException('REVIEW_NOT_ALLOWED', HTTP.FORBIDDEN);
  if (item.review) throw new AppException('REVIEW_EXISTS', HTTP.CONFLICT);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new AppException('REVIEW_INVALID', HTTP.UNPROCESSABLE);
  return repository.createReview({
    orderItemId,
    rating,
    comment: typeof comment === 'string' ? comment.trim().slice(0, 5000) || null : null,
    editableUntil: new Date(Date.now() + 86400000),
  });
}
async function editReview(userId, id, rating, comment) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new AppException('REVIEW_INVALID', HTTP.UNPROCESSABLE);
  const existing = await repository.findReview(id);
  if (
    !existing ||
    existing.orderItem.order.buyerId !== userId ||
    existing.editableUntil < new Date()
  )
    throw new AppException('REVIEW_NOT_ALLOWED', HTTP.FORBIDDEN);
  return prisma.review.update({
    where: { id },
    data: {
      rating,
      comment: typeof comment === 'string' ? comment.trim().slice(0, 5000) || null : null,
    },
  });
}
async function deleteReview(userId, id) {
  const existing = await repository.findReview(id);
  if (
    !existing ||
    existing.orderItem.order.buyerId !== userId ||
    existing.editableUntil < new Date()
  )
    throw new AppException('REVIEW_NOT_ALLOWED', HTTP.FORBIDDEN);
  return prisma.review.delete({ where: { id } });
}
async function notifyExchangeStatus(orderId, status) {
  if (!['ACCEPTED', 'REJECTED'].includes(status)) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      seller: true,
      items: true,
      exchangeOffer: { include: { offeredBooks: { include: { book: true } } } },
    },
  });
  if (!order || order.type !== 'EXCHANGE') return;
  sendExchangeOfferStatusEmail({
    order,
    buyer: order.buyer,
    seller: order.seller,
    accepted: status === 'ACCEPTED',
  }).catch((error) => console.error(MAIL.DELIVERY_FAILED, error.message));
}
module.exports = {
  cart,
  add,
  remove,
  checkout,
  orders,
  changeOrder,
  exchange,
  review,
  editReview,
  deleteReview,
  notifyExchangeStatus,
};
