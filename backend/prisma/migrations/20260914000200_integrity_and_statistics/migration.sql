-- Prisma does not express CHECK constraints or these aggregate views.
-- Keep this migration when creating new databases; do not replace it with db push.
ALTER TABLE "User"
  ADD CONSTRAINT "User_names_not_blank" CHECK (length(btrim("firstName")) > 0 AND length(btrim("lastName")) > 0),
  ADD CONSTRAINT "User_email_normalized" CHECK (email = lower(btrim(email)) AND position('@' in email) > 1),
  ADD CONSTRAINT "User_password_not_blank" CHECK (length(btrim("passwordHash")) > 0),
  ADD CONSTRAINT "User_block_expiry_status" CHECK ("blockedUntil" IS NULL OR status = 'BLOCKED'),
  ADD CONSTRAINT "User_archive_status" CHECK ((status = 'ARCHIVED') = ("archivedAt" IS NOT NULL));

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_token_hash_format" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "Session_expiry_after_creation" CHECK ("expiresAt" > "createdAt");

ALTER TABLE "Book"
  ADD CONSTRAINT "Book_details_not_blank" CHECK (
    length(btrim(title)) > 0 AND length(btrim(author)) > 0 AND
    length(btrim(publisher)) > 0 AND length(btrim(description)) > 0),
  ADD CONSTRAINT "Book_publication_year_range" CHECK ("publicationYear" BETWEEN 1 AND 9999),
  ADD CONSTRAINT "Book_price_valid" CHECK (price >= 0 AND (price > 0 OR "allowExchange")),
  ADD CONSTRAINT "Book_views_nonnegative" CHECK ("viewCount" >= 0);

ALTER TABLE "BookImage"
  ADD CONSTRAINT "BookImage_url_not_blank" CHECK (length(btrim(url)) > 0),
  ADD CONSTRAINT "BookImage_sort_order_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "BookCondition"
  ADD CONSTRAINT "BookCondition_sort_order_nonnegative" CHECK ("sortOrder" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_distinct_parties" CHECK ("buyerId" <> "sellerId"),
  ADD CONSTRAINT "Order_amount_by_type" CHECK (
    (type = 'PURCHASE' AND "totalAmount" > 0) OR (type = 'EXCHANGE' AND "totalAmount" = 0)),
  ADD CONSTRAINT "Order_currency_bam" CHECK (currency = 'BAM'),
  ADD CONSTRAINT "Order_number_not_blank" CHECK (length(btrim("orderNumber")) > 0),
  ADD CONSTRAINT "Order_status_timestamps" CHECK (
    (status = 'PENDING' AND "acceptedAt" IS NULL AND "rejectedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL) OR
    (status = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "rejectedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL) OR
    (status = 'REJECTED' AND "acceptedAt" IS NULL AND "rejectedAt" IS NOT NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL) OR
    (status = 'COMPLETED' AND "acceptedAt" IS NOT NULL AND "rejectedAt" IS NULL AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
    (status = 'CANCELLED' AND "acceptedAt" IS NULL AND "rejectedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NOT NULL)),
  ADD CONSTRAINT "Order_timestamp_order" CHECK (
    ("acceptedAt" IS NULL OR "acceptedAt" >= "createdAt") AND
    ("completedAt" IS NULL OR "completedAt" >= "acceptedAt") AND
    ("rejectedAt" IS NULL OR "rejectedAt" >= "createdAt") AND
    ("cancelledAt" IS NULL OR "cancelledAt" >= "createdAt"));

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_price_nonnegative" CHECK (price >= 0),
  ADD CONSTRAINT "OrderItem_snapshot_not_blank" CHECK (length(btrim("bookTitle")) > 0 AND length(btrim("bookAuthor")) > 0);
ALTER TABLE "OrderStatusHistory"
  ADD CONSTRAINT "OrderStatusHistory_transition_differs" CHECK ("fromStatus" IS NULL OR "fromStatus" <> "toStatus");
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK (rating BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_edit_window" CHECK ("editableUntil" >= "createdAt");
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_body_not_blank" CHECK (length(btrim(body)) > 0);
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_content_not_blank" CHECK (length(btrim(title)) > 0 AND length(btrim(body)) > 0);
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_exactly_one_target" CHECK (("reportedUserId" IS NOT NULL)::int + ("bookId" IS NOT NULL)::int = 1),
  ADD CONSTRAINT "Report_reason_not_blank" CHECK (length(btrim(reason)) > 0),
  ADD CONSTRAINT "Report_resolution_status" CHECK (
    (status IN ('RESOLVED', 'REJECTED') AND "resolvedById" IS NOT NULL AND "resolvedAt" IS NOT NULL) OR
    (status IN ('OPEN', 'IN_REVIEW') AND "resolvedById" IS NULL AND "resolvedAt" IS NULL));
ALTER TABLE "WishlistAlert"
  ADD CONSTRAINT "WishlistAlert_has_criteria" CHECK (
    coalesce(length(btrim(query)), 0) > 0 OR coalesce(length(btrim(author)), 0) > 0 OR
    coalesce(length(btrim(isbn)), 0) > 0 OR "genreId" IS NOT NULL OR "languageId" IS NOT NULL);
ALTER TABLE "Badge"
  ADD CONSTRAINT "Badge_thresholds_valid" CHECK (
    "minimumCompletedOrders" >= 0 AND "minimumAverageRating" BETWEEN 0 AND 5 AND
    ("maximumResponseHours" IS NULL OR "maximumResponseHours" > 0));

-- Reviews carry only orderItemId: book, buyer and seller cannot disagree with it.
-- Eligibility is also checked for direct database writes.
CREATE FUNCTION "checkReviewEligibility"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE i.id = NEW."orderItemId" AND o.status = 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'Reviews require a completed order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Review_completed_order" BEFORE INSERT OR UPDATE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION "checkReviewEligibility"();

-- Derived statistics stay accurate after review edits/deletes, without cached totals.
-- Count both requested and offered physical books in a completed exchange.
CREATE VIEW "BookStatistics" AS
WITH completed_books AS (
  SELECT i."bookId", o.id AS "orderId"
  FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o.status = 'COMPLETED'
  UNION
  SELECT eb."bookId", o.id AS "orderId"
  FROM "ExchangeOfferBook" eb JOIN "ExchangeOffer" e ON e.id = eb."exchangeOfferId"
  JOIN "Order" o ON o.id = e."orderId" WHERE o.status = 'COMPLETED'
), completed_counts AS (
  SELECT "bookId", count(*)::int AS total FROM completed_books GROUP BY "bookId"
), ratings AS (
  SELECT i."bookId", count(r.id)::int AS total, avg(r.rating)::double precision AS average
  FROM "Review" r JOIN "OrderItem" i ON i.id = r."orderItemId"
  JOIN "Order" o ON o.id = i."orderId" WHERE o.status = 'COMPLETED' GROUP BY i."bookId"
)
SELECT b.id AS "bookId", coalesce(c.total, 0) AS "completedOrderCount",
  coalesce(r.total, 0) AS "ratingCount", coalesce(r.average, 0) AS "averageRating",
  coalesce(r.average, 0) * 10 + coalesce(c.total, 0) AS "popularityScore"
FROM "Book" b LEFT JOIN completed_counts c ON c."bookId" = b.id
LEFT JOIN ratings r ON r."bookId" = b.id;

CREATE VIEW "SellerStatistics" AS
SELECT u.id AS "sellerId",
  (SELECT count(*)::int FROM "Book" b WHERE b."ownerId" = u.id) AS "bookCount",
  (SELECT count(*)::int FROM "Book" b WHERE b."ownerId" = u.id AND b.status = 'ACTIVE') AS "activeBookCount",
  (SELECT count(*)::int FROM "Order" o WHERE o."sellerId" = u.id AND o.status = 'COMPLETED') AS "completedOrderCount",
  (SELECT count(*)::int FROM "Review" r JOIN "OrderItem" i ON i.id = r."orderItemId"
    JOIN "Order" o ON o.id = i."orderId" WHERE o."sellerId" = u.id AND o.status = 'COMPLETED') AS "ratingCount",
  coalesce((SELECT avg(r.rating)::double precision FROM "Review" r JOIN "OrderItem" i ON i.id = r."orderItemId"
    JOIN "Order" o ON o.id = i."orderId" WHERE o."sellerId" = u.id AND o.status = 'COMPLETED'), 0) AS "averageRating"
FROM "User" u WHERE u.role = 'SELLER';
