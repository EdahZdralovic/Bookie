function toPublicBook(book, statistics) {
  return {
    ...book,
    averageRating: Number(statistics?.averageRating || 0),
    ratingCount: Number(statistics?.ratingCount || 0),
    completedOrderCount: Number(statistics?.completedOrderCount || 0),
    price: Number(book.price),
    owner: {
      ...book.owner,
      name: `${book.owner.firstName} ${book.owner.lastName}`,
    },
  };
}

module.exports = { toPublicBook };
