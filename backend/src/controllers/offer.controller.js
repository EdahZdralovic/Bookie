const service = require('../services/marketplace.service');
async function list(req, res, next) {
  try {
    const orders = (await service.orders(req.user.id, 'SELLER')).filter(
      (order) => order.type === 'EXCHANGE' && order.sellerId === req.user.id,
    );
    return res.render('pages/exchange-offers', { title: 'Exchange offers', orders });
  } catch (error) {
    return next(error);
  }
}
module.exports = { list };
