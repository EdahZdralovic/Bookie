const prisma = require('../config/database');
const repository = require('../repositories/marketplace.repository');
const { sendOrderNotification, sendExchangeOfferStatusEmail } = require('../utils/mailer');
const MAIL = require('../constants/mail-strings');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
async function cart(userId) {
  return repository.getCart(userId);
}
async function add(userId, bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || book.status !== 'ACTIVE')
    throw new AppException('CART_BOOK_INVALID', HTTP.UNPROCESSABLE);
  if (book.ownerId === userId) throw new AppException('CART_OWNER', HTTP.FORBIDDEN);
  return repository.addToCart(userId, bookId);
}
async function remove(userId, bookId) {
  return repository.removeFromCart(userId, bookId);
}
async function checkout(userId) {
  const current = await repository.getCart(userId);
  if (!current?.items.length) throw new AppException('CART_EMPTY', HTTP.UNPROCESSABLE);
  const buyer = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });

  const groups = new Map();
  current.items.forEach(({ book }) => {
    if (book.status !== 'ACTIVE') throw new AppException('CART_BOOK_INVALID', HTTP.UNPROCESSABLE);
    if (book.ownerId === userId) throw new AppException('CART_OWNER', HTTP.FORBIDDEN);
    if (!groups.has(book.ownerId)) groups.set(book.ownerId, []);
    groups.get(book.ownerId).push(book);
  });
  const orders = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const [sellerId, books] of groups)
      created.push(
        await repository.createOrder(
          {
            orderNumber: `BK-${Date.now()}-${sellerId}`,
            buyerId: userId,
            sellerId,
            totalAmount: books.reduce((sum, book) => sum + Number(book.price), 0),
            items: {
              create: books.map((book) => ({
                bookId: book.id,
                price: book.price,
                bookTitle: book.title,
                bookAuthor: book.author,
              })),
            },
          },
          tx,
        ),
      );
    await tx.cartItem.deleteMany({ where: { cartId: current.id } });
    return created;
  });
  for (const order of orders) {
    const books = groups.get(order.sellerId) || [];
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
  const order = await repository.findOrder(orderId);
  if (!order || (order.sellerId !== userId && order.buyerId !== userId))
    throw new AppException('ORDER_FORBIDDEN', HTTP.FORBIDDEN);
  if (status === 'CANCELLED' && (order.buyerId !== userId || order.status !== 'PENDING'))
    throw new AppException('ORDER_TRANSITION', HTTP.UNPROCESSABLE);
  if (['ACCEPTED', 'REJECTED', 'COMPLETED'].includes(status) && order.sellerId !== userId)
    throw new AppException('ORDER_FORBIDDEN', HTTP.FORBIDDEN);
  const allowed = { PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['COMPLETED'] };
  if (!allowed[order.status]?.includes(status))
    throw new AppException('ORDER_TRANSITION', HTTP.UNPROCESSABLE);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const update = {
      status,
      ...(status === 'ACCEPTED' ? { acceptedAt: now } : {}),
      ...(status === 'REJECTED' ? { rejectedAt: now } : {}),
      ...(status === 'COMPLETED' ? { completedAt: now } : {}),
      ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
    };
    const result = await repository.updateOrder(orderId, update, tx);
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: status, changedById: userId },
    });
    if (status === 'ACCEPTED') {
      const ids = order.items.map((item) => item.bookId);
      if (order.exchangeOffer)
        ids.push(...order.exchangeOffer.offeredBooks.map((item) => item.bookId));
      const available = await tx.book.count({ where: { id: { in: ids }, status: 'ACTIVE' } });
      if (available !== ids.length) throw new AppException('CART_BOOK_INVALID', HTTP.CONFLICT);
      await tx.bookReservation.createMany({ data: ids.map((bookId) => ({ bookId, orderId })) });
      await tx.book.updateMany({ where: { id: { in: ids } }, data: { status: 'RESERVED' } });
    }
    if (status === 'COMPLETED')
      await tx.book.updateMany({
        where: { id: { in: order.items.map((item) => item.bookId) } },
        data: { status: order.type === 'EXCHANGE' ? 'EXCHANGED' : 'SOLD' },
      });
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
  const target = await prisma.book.findUnique({ where: { id: bookId } });
  const offered = await prisma.book.findMany({
    where: { id: { in: offeredBookIds }, ownerId: userId, allowExchange: true, status: 'ACTIVE' },
  });
  if (
    !user ||
    user.role !== 'BUYER' ||
    user.status !== 'ACTIVE' ||
    !target ||
    target.ownerId !== sellerId ||
    target.status !== 'ACTIVE' ||
    !target.allowExchange ||
    offered.length !== offeredBookIds.length
  )
    throw new AppException('EXCHANGE_BOOK_INVALID', HTTP.UNPROCESSABLE);
  return repository.createExchange({
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
    comment: comment?.trim() || null,
    editableUntil: new Date(Date.now() + 86400000),
  });
}
async function editReview(userId, id, rating, comment) {
  const existing = await repository.findReview(id);
  if (
    !existing ||
    existing.orderItem.order.buyerId !== userId ||
    existing.editableUntil < new Date()
  )
    throw new AppException('REVIEW_NOT_ALLOWED', HTTP.FORBIDDEN);
  return prisma.review.update({
    where: { id },
    data: { rating, comment: comment?.trim() || null },
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
