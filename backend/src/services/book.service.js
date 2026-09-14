const bookRepository = require('../repositories/book.repository');
const catalogRepository = require('../repositories/catalog.repository');
const statisticsRepository = require('../repositories/statistics.repository');
const { toPublicBook } = require('../models/book.model');

async function getLandingData(search = '') {
  const [activeBooks, genres, marketplaceCounts] = await Promise.all([
    bookRepository.findActiveBooks(search),
    catalogRepository.findActiveGenres(),
    statisticsRepository.getMarketplaceCounts(),
  ]);

  const statistics = await bookRepository.findStatisticsByBookIds(activeBooks.map((book) => book.id));
  const statisticsByBook = new Map(statistics.map((row) => [row.bookId, row]));
  const normalized = activeBooks.map((book) => toPublicBook(book, statisticsByBook.get(book.id)));
  const popularBooks = [...normalized]
    .sort((a, b) => ((b.averageRating * 10) + b.completedOrderCount) - ((a.averageRating * 10) + a.completedOrderCount))
    .slice(0, 4);
  const randomBooks = [...normalized].sort(() => Math.random() - 0.5).slice(0, 4);
  const recommendedBooks = normalized
    .filter((book) => ['professional-literature', 'novel'].includes(book.genre?.slug))
    .slice(0, 4);

  return {
    popularBooks,
    randomBooks,
    recommendedBooks,
    genres,
    search,
    stats: { activeBooks: normalized.length, ...marketplaceCounts },
  };
}

module.exports = { getLandingData };
