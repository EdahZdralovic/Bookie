const bookRepository = require('../repositories/book.repository');
const { toPublicBook } = require('../models/book.model');

async function getBook(id, viewerId) {
  const book = await bookRepository.findById(id);
  if (!book || book.status === 'ARCHIVED') return null;
  const statistics = (await bookRepository.findStatisticsByBookIds([book.id]))[0];
  const buyerBooks = viewerId ? await bookRepository.findBuyerExchangeBooks(viewerId) : [];
  return {
    ...toPublicBook(book, statistics),
    reviews: book.orderItems.map((item) => ({ ...item.review, buyer: item.order.buyer })),
    buyerBooks,
  };
}

module.exports = { getBook };
