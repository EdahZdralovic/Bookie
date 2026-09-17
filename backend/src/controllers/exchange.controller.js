const profileService = require('../services/profile.service');
async function inventory(req, res, next) {
  try {
    return res.render('pages/exchange-books', {
      title: 'Exchange books',
      books: await profileService.exchangeBooks(req.user.id),
    });
  } catch (error) {
    return next(error);
  }
}
async function archive(req, res, next) {
  try {
    await profileService.archiveExchangeBook(req.user.id, Number(req.params.id));
    return res.redirect('/exchange-books');
  } catch (error) {
    return next(error);
  }
}
async function remove(req, res, next) {
  try {
    await profileService.deleteArchivedExchangeBook(req.user.id, Number(req.params.id));
    return res.redirect('/exchange-books');
  } catch (error) {
    return next(error);
  }
}
async function editForm(req, res) {
  return res.redirect(303, `/books/${req.params.id}/edit`);
}

async function edit(req, res, next) {
  try {
    await profileService.editExchangeBook(req.user.id, Number(req.params.id), {
      title: String(req.body.title || '').trim(),
      author: String(req.body.author || '').trim(),
      publisher: String(req.body.publisher || '').trim(),
      description: String(req.body.description || '').trim(),
    });
    return res.redirect('/exchange-books');
  } catch (error) {
    return next(error);
  }
}
module.exports = { inventory, archive, remove, editForm, edit };
