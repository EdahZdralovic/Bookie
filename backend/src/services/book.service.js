const bookRepository = require('../repositories/book.repository');
const prisma = require('../config/database');
const catalogRepository = require('../repositories/catalog.repository');
const statisticsRepository = require('../repositories/statistics.repository');
const { toPublicBook } = require('../models/book.model');

async function getLandingData(search = '', filters = {}, viewerId = null) {
  const [activeBooks, options, marketplaceCounts] = await Promise.all([
    bookRepository.findActiveBooks(search, filters),
    catalogRepository.findBookOptions(),
    statisticsRepository.getMarketplaceCounts(),
  ]);

  const statistics = await bookRepository.findStatisticsByBookIds(
    activeBooks.map((book) => book.id),
  );
  const statisticsByBook = new Map(statistics.map((row) => [row.bookId, row]));
  const normalized = activeBooks.map((book) => toPublicBook(book, statisticsByBook.get(book.id)));
  if (filters.sort === 'popularity')
    normalized.sort(
      (a, b) =>
        b.averageRating * 10 +
        b.completedOrderCount -
        (a.averageRating * 10 + a.completedOrderCount),
    );
  const popularBooks = [...normalized]
    .sort(
      (a, b) =>
        b.averageRating * 10 +
        b.completedOrderCount -
        (a.averageRating * 10 + a.completedOrderCount),
    )
    .slice(0, 4);
  const randomBooks = [...normalized].sort(() => Math.random() - 0.5).slice(0, 4);
  let recommendedBooks = normalized
    .filter((book) => ['professional-literature', 'novel'].includes(book.genre?.slug))
    .slice(0, 4);
  if (viewerId) {
    const interests = await prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        genreInterests: { select: { genreId: true } },
        languageInterests: { select: { languageId: true } },
      },
    });
    const genres = new Set(interests?.genreInterests.map((item) => item.genreId));
    const languages = new Set(interests?.languageInterests.map((item) => item.languageId));
    recommendedBooks = normalized
      .filter((book) => genres.has(book.genreId) || languages.has(book.languageId))
      .slice(0, 4);
  }

  return {
    popularBooks,
    randomBooks,
    recommendedBooks,
    genres: options.genres,
    languages: options.languages,
    conditions: options.conditions,
    cities: options.cities,
    filters,
    search,
    stats: { activeBooks: normalized.length, ...marketplaceCounts },
  };
}

async function getCatalogData(search = '', filters = {}) {
  const [books, options] = await Promise.all([
    bookRepository.findActiveBooks(search, filters),
    catalogRepository.findBookOptions(),
  ]);
  const statistics = await bookRepository.findStatisticsByBookIds(books.map((book) => book.id));
  const byId = new Map(statistics.map((row) => [row.bookId, row]));
  const normalized = books.map((book) => toPublicBook(book, byId.get(book.id)));
  if (filters.sort === 'popularity')
    normalized.sort(
      (a, b) =>
        b.averageRating * 10 +
        b.completedOrderCount -
        (a.averageRating * 10 + a.completedOrderCount),
    );
  return {
    books: normalized,
    genres: options.genres,
    languages: options.languages,
    conditions: options.conditions,
    cities: options.cities,
    search,
    filters,
  };
}

module.exports = { getLandingData, getCatalogData };
