// Application-facing book shape. Database entities are defined in prisma/schema.prisma.
function toPublicBook(book, statistics) {
  return {
    ...book,
    ...statistics,
    price: Number(book.price),
    owner: {
      ...book.owner,
      name: `${book.owner.firstName} ${book.owner.lastName}`,
    },
  };
}

module.exports = { toPublicBook };
