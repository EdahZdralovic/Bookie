# Archived SQLite baseline

These files preserve the previous SQLite schema, seed and four migrations.
They are historical reference, not part of the active PostgreSQL migration chain.
The original `../dev.db` is retained unchanged and remains ignored by Git.

The PostgreSQL setup creates a separate database with consistent demo fixtures.
It does not import or delete SQLite rows. Any future import of real records needs
an explicit transformation for required names/book fields, legacy statuses,
normalized reviews and invalid aggregate values; do not replay SQLite SQL on PostgreSQL.
