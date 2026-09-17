const id = (value) =>
  typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647
    ? Number(value)
    : undefined;
const price = (value) =>
  typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 99999999.99
    ? Number(value)
    : undefined;

function parseFilters(query = {}) {
  const filters = {
    genreId: id(query.genreId),
    languageId: id(query.languageId),
    conditionId: id(query.conditionId),
    cityId: id(query.cityId),
    minPrice: price(query.minPrice),
    maxPrice: price(query.maxPrice),
    exchangeOnly: query.exchangeOnly === '1',
    sort: ['newest', 'oldest', 'price-asc', 'price-desc', 'popularity'].includes(query.sort)
      ? query.sort
      : 'newest',
  };
  if (filters.minPrice > filters.maxPrice)
    [filters.minPrice, filters.maxPrice] = [filters.maxPrice, filters.minPrice];
  return filters;
}
module.exports = { parseFilters };
