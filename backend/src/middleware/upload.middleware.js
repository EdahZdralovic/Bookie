const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../frontend/public/users');
function storage(folder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(root, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) =>
      cb(
        null,
        `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`,
      ),
  });
}
const imageFilter = (req, file, cb) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    ? cb(null, true)
    : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
const profileUpload = multer({
  storage: storage('profile-pictures'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar');
const bookUpload = multer({
  storage: storage('books-images'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');
module.exports = { profileUpload, bookUpload };
