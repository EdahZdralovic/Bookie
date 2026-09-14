const bookRepository = require('../repositories/book.repository');
const { toPublicBook } = require('../models/book.model');

async function getBook(publicId) {
  const book = await bookRepository.findByPublicId(publicId);
  if (!book || book.status === 'ARCHIVED') return null;
  const statistics = (await bookRepository.findStatisticsByBookIds([book.id]))[0];
  return { ...toPublicBook(book, statistics), reviews: book.orderItems.map((item) => ({ ...item.review, buyer: item.order.buyer })) };
}

module.exports = { getBook };
