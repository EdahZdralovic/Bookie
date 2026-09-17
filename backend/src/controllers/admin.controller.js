const adminService = require('../services/admin.service');
const HTTP = require('../constants/http');

async function dashboard(req, res, next) {
  try {
    return res.render('pages/admin-dashboard', {
      title: 'Admin panel',
      query: req.query,
      users: await adminService.users(req.query),
      reports: await adminService.reports('OPEN'),
    });
  } catch (error) {
    return next(error);
  }
}
async function userStatus(req, res, next) {
  try {
    const until =
      req.body.status === 'BLOCKED' && req.body.duration === '15'
        ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        : null;
    await adminService.changeUserStatus(req.user.id, Number(req.params.id), req.body.status, until);
    return res.redirect(HTTP.REDIRECT, '/admin');
  } catch (error) {
    return next(error);
  }
}
async function catalog(req, res, next) {
  try {
    const type = req.params.type;
    return res.render('pages/admin-catalog', {
      title: 'Catalog management',
      type,
      items: await adminService.catalog(type),
      formError: null,
    });
  } catch (error) {
    return next(error);
  }
}
async function addCatalog(req, res, next) {
  try {
    await adminService.addCatalog(req.params.type, req.body);
    return res.redirect(HTTP.REDIRECT, `/admin/catalog/${req.params.type}`);
  } catch (error) {
    return next(error);
  }
}
async function editCatalog(req, res, next) {
  try {
    await adminService.editCatalog(req.params.type, Number(req.params.id), req.body);
    return res.redirect(HTTP.REDIRECT, `/admin/catalog/${req.params.type}`);
  } catch (error) {
    return next(error);
  }
}
async function reports(req, res, next) {
  try {
    return res.render('pages/admin-reports', {
      title: 'Reports',
      reports: await adminService.reports(req.query.status),
    });
  } catch (error) {
    return next(error);
  }
}
async function resolveReport(req, res, next) {
  try {
    await adminService.resolveReport(req.user.id, Number(req.params.id), req.body.status);
    return res.redirect(HTTP.REDIRECT, '/admin/reports');
  } catch (error) {
    return next(error);
  }
}
async function notify(req, res, next) {
  try {
    await adminService.notify(Number(req.params.id), req.body.title, req.body.body, req.body.link);
    return res.redirect(HTTP.REDIRECT, '/admin');
  } catch (error) {
    return next(error);
  }
}
async function reviews(req, res, next) {
  try {
    return res.render('pages/admin-reviews', {
      title: 'Review moderation',
      rating: req.query.rating || '',
      reviews: await adminService.reviews(req.query.rating),
    });
  } catch (error) {
    return next(error);
  }
}
async function removeReview(req, res, next) {
  try {
    await adminService.removeReview(Number(req.params.id));
    return res.redirect(HTTP.REDIRECT, '/admin/reviews');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  userStatus,
  catalog,
  addCatalog,
  editCatalog,
  reports,
  resolveReport,
  notify,
  reviews,
  removeReview,
};
