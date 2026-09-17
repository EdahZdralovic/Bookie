const adminRepository = require('../repositories/admin.repository');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
const EXCEPTIONS = require('../constants/exceptions');

async function users(filters) {
  return adminRepository.listUsers(filters);
}
async function changeUserStatus(adminId, userId, status, blockedUntil = null) {
  if (adminId === userId) throw new AppException('FORBIDDEN', HTTP.FORBIDDEN);
  if (!['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'].includes(status))
    throw new AppException('BAD_REQUEST', HTTP.BAD_REQUEST);
  return adminRepository.updateUser(userId, {
    status,
    blockedUntil,
    archivedAt: status === 'ARCHIVED' ? new Date() : null,
  });
}
async function catalog(type) {
  if (!Object.hasOwn(adminRepository.catalogModels, type))
    throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  return adminRepository.listCatalog(type);
}
async function addCatalog(type, input) {
  if (!Object.hasOwn(adminRepository.catalogModels, type))
    throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  const name = String(input.name || '').trim();
  if (!name)
    throw new AppException('REQUIRED_FIELD', HTTP.UNPROCESSABLE, {
      name: EXCEPTIONS.REQUIRED_FIELD,
    });
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const data = { name, isActive: true };
  if (['genres', 'conditions', 'tags'].includes(type)) data.slug = slug;
  if (type === 'languages')
    data.code = String(input.code || name.slice(0, 2))
      .trim()
      .toUpperCase();
  return adminRepository.createCatalog(type, data);
}
async function editCatalog(type, id, input) {
  if (!Object.hasOwn(adminRepository.catalogModels, type))
    throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  const name = String(input.name || '').trim();
  if (!name)
    throw new AppException('REQUIRED_FIELD', HTTP.UNPROCESSABLE, {
      name: EXCEPTIONS.REQUIRED_FIELD,
    });
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const data = {
    name,
    ...(['genres', 'conditions', 'tags'].includes(type) ? { slug } : {}),
    isActive: input.isActive === 'on',
  };
  return adminRepository.updateCatalog(type, id, data);
}
async function deleteCatalog(type, id) {
  if (!Object.hasOwn(adminRepository.catalogModels, type))
    throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  return adminRepository.deleteCatalog(type, id);
}
async function reports(status) {
  return adminRepository.listReports(status);
}
async function resolveReport(adminId, id, status) {
  if (!['IN_REVIEW', 'RESOLVED', 'REJECTED'].includes(status))
    throw new AppException('BAD_REQUEST', HTTP.BAD_REQUEST);
  return adminRepository.resolveReport(id, {
    status,
    resolvedById: ['RESOLVED', 'REJECTED'].includes(status) ? adminId : null,
    resolvedAt: ['RESOLVED', 'REJECTED'].includes(status) ? new Date() : null,
  });
}
async function notify(userId, title, body, link) {
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle || !cleanBody) throw new AppException('REQUIRED_FIELD', HTTP.UNPROCESSABLE);
  return adminRepository.createNotification({
    userId,
    type: 'SYSTEM',
    title: cleanTitle,
    body: cleanBody,
    link: String(link || '').trim() || null,
  });
}
async function reviews(rating) {
  return adminRepository.listReviews(rating);
}
async function removeReview(id) {
  return adminRepository.deleteReview(id);
}

module.exports = {
  users,
  changeUserStatus,
  catalog,
  addCatalog,
  editCatalog,
  deleteCatalog,
  reports,
  resolveReport,
  notify,
  reviews,
  removeReview,
};
