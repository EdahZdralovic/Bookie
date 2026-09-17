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
        `${crypto.randomBytes(16).toString('hex')}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype]}`,
      ),
  });
}
const imageFilter = (req, file, cb) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    ? cb(null, true)
    : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));

function upload(folder, field) {
  const parser = multer({
    storage: storage(folder),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 150, fieldSize: 16384 },
  }).single(field);
  return (req, res, next) =>
    parser(req, res, async (error) => {
      if (error) return next(error);
      if (!req.file) return next();
      try {
        const bytes = await fs.promises.readFile(req.file.path);
        const valid = {
          'image/jpeg':
            bytes.length > 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
          'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          'image/webp':
            bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
        }[req.file.mimetype];
        if (!valid) {
          await require('../utils/upload').removeUploadedFile(req.file);
          return next(new multer.MulterError('LIMIT_UNEXPECTED_FILE', field));
        }
        return next();
      } catch (failure) {
        return next(failure);
      }
    });
}
const profileUpload = upload('profile-pictures', 'avatar');
const bookUpload = upload('books-images', 'image');
module.exports = { profileUpload, bookUpload };
