const service = require('../services/marketplace.service');
const AppException = require('../exceptions/app.exception');
async function cart(req, res, next, error = null) {
  try {
    return res.status(error?.status || 200).render('pages/cart', {
      title: 'Cart',
      cart: await service.cart(req.user.id),
      formError: error?.message || '',
    });
  } catch (e) {
    return next(e);
  }
}
async function add(req, res, next) {
  try {
    await service.add(req.user.id, Number(req.params.bookId));
    return res.redirect('/cart');
  } catch (e) {
    if (e instanceof AppException) return cart(req, res, next, e);
    return next(e);
  }
}
async function remove(req, res, next) {
  try {
    await service.remove(req.user.id, Number(req.params.bookId));
    return res.redirect('/cart');
  } catch (e) {
    if (e instanceof AppException) return cart(req, res, next, e);
    return next(e);
  }
}
async function checkout(req, res, next) {
  try {
    await service.checkout(req.user.id);
    return res.redirect('/orders');
  } catch (e) {
    if (e instanceof AppException) return cart(req, res, next, e);
    return next(e);
  }
}
async function orders(req, res, next, error = null) {
  try {
    return res.status(error?.status || 200).render('pages/orders', {
      formError: error?.message || '',
      title: 'Orders',
      orders: await service.orders(req.user.id, req.user.role),
    });
  } catch (e) {
    return next(e);
  }
}
async function changeOrder(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    await service.changeOrder(req.user.id, orderId, req.body.status);
    await service.notifyExchangeStatus(orderId, req.body.status);
    return res.redirect('/orders');
  } catch (e) {
    if (e instanceof AppException) return orders(req, res, next, e);
    return next(e);
  }
}
async function exchange(req, res, next) {
  try {
    const ids = Array.isArray(req.body.offeredBookIds)
      ? req.body.offeredBookIds.map(Number)
      : [Number(req.body.offeredBookIds)];
    await service.exchange(req.user.id, Number(req.body.sellerId), Number(req.body.bookId), ids);
    return res.redirect('/orders');
  } catch (e) {
    if (e instanceof AppException)
      return res.redirect(303, `/books/${Number(req.body.bookId)}?exchangeError=1`);
    return next(e);
  }
}
async function review(req, res, next) {
  try {
    await service.review(
      req.user.id,
      Number(req.params.itemId),
      Number(req.body.rating),
      req.body.comment,
    );
    return res.redirect(303, '/orders');
  } catch (e) {
    if (e instanceof AppException) return orders(req, res, next, e);
    return next(e);
  }
}
async function editReview(req, res, next) {
  try {
    await service.editReview(
      req.user.id,
      Number(req.params.id),
      Number(req.body.rating),
      req.body.comment,
    );
    return res.redirect(303, '/orders');
  } catch (e) {
    if (e instanceof AppException) return orders(req, res, next, e);
    return next(e);
  }
}
async function deleteReview(req, res, next) {
  try {
    await service.deleteReview(req.user.id, Number(req.params.id));
    return res.redirect(303, '/orders');
  } catch (e) {
    if (e instanceof AppException) return orders(req, res, next, e);
    return next(e);
  }
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
};
