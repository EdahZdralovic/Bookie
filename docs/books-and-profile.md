# Books and profile workflows

## Publish a book

`GET /books/new` renders the seller form. `POST /books` validates and creates one
active physical listing. The route requires a current `SELLER` with `ACTIVE` account
status, authentication, and CSRF protection. Buyers and administrators receive a
forbidden response. A seller cannot choose an inactive or nonexistent lookup row.

Required fields are title, author, publisher, publication year, description, price,
genre, language, condition and pickup city. ISBN and cover URL are optional. Price
must be a nonnegative value with at most two decimal places. A zero price is allowed
only when exchange is enabled. The cover URL must use HTTP or HTTPS. The server
rechecks all lookup IDs and ownership rules after browser validation.

On success the book is created with the authenticated seller as owner, its selected
pickup city, and an optional `BookImage` row. It redirects to `/account?bookCreated=1`.
Failures render the form again with safe values, field-specific centralized messages,
and no internal database details. No file upload dependency is needed because the
database contract already supports URLs; multipart storage can be added later.

## Profile

`GET /profile` loads the current user's avatar and saved genre/language interests.
`POST /profile` replaces those interests atomically and updates only that user's
avatar. At least one active genre and one active language must remain selected. Avatar
URLs are optional and must use HTTP or HTTPS. Deactivated lookup values cannot be
saved. CSRF protection and authentication apply to the update.

The profile form preserves selections after validation failures and previews the
avatar URL. Successful updates redirect to `/profile?saved=1`; the account header
and account page use the saved avatar when available.

The shared English copy for both pages is in
`backend/src/constants/strings.js`. Domain errors are named values in
`backend/src/constants/exceptions.js`; controllers do not hardcode validation text.
